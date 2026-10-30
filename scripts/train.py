"""Pipeline completo: features -> validacao walk-forward -> modelos -> simulacao.

Uso:
    python scripts/train.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import joblib
import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance

from brasileirao_ml import plots
from brasileirao_ml.config import (
    CLASSES,
    FEATURES_FILE,
    METRICS_FILE,
    MODEL_FILE,
    MODELS,
    PREDICTIONS_FILE,
    RANDOM_STATE,
    REPORTS,
    SIM_FILE,
)
from brasileirao_ml.data import current_season, load_matches, season_table
from brasileirao_ml.evaluate import (
    MARKET_NAME,
    calibration_table,
    metrics_by_season,
    metrics_summary,
    walk_forward,
)
from brasileirao_ml.features import FEATURES, build_features, latest_states
from brasileirao_ml.models import MODEL_SPECS, _hist_gb, _logreg, AverageBlend
from brasileirao_ml.poisson import (
    fit_poisson,
    remaining_fixtures,
    simulate_season,
    walk_forward_poisson,
)

pd.set_option("display.width", 160)
pd.set_option("display.max_columns", 30)


def _print_summary(summary: pd.DataFrame) -> None:
    show = summary.copy()
    show = show.rename(
        columns={
            "rank": "#",
            "model": "Modelo",
            "n": "Jogos",
            "accuracy": "Acurácia",
            "log_loss": "Log loss",
            "brier": "Brier",
            "rps": "RPS",
        }
    )
    for col in ("Acurácia",):
        show[col] = (show[col] * 100).round(1)
    for col in ("Log loss", "Brier", "RPS"):
        show[col] = show[col].round(4)
    print(show.to_string(index=False))


def main() -> int:
    REPORTS.mkdir(parents=True, exist_ok=True)
    MODELS.mkdir(parents=True, exist_ok=True)
    FEATURES_FILE.parent.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ dados
    df = load_matches()
    season = current_season(df)
    print(
        f"[dados] {len(df)} partidas | {df.season.min()}-{season} | "
        f"ultima partida: {df.date.max():%d/%m/%Y}"
    )
    print(
        f"[dados] odds de mercado em {df.p_home_mkt.notna().mean():.1%} das partidas "
        f"(overround medio {df.market_overround.mean():.2%})"
    )

    base = df["result"].value_counts(normalize=True)
    print(
        f"[dados] resultados: casa {base.get('H', 0):.1%} | "
        f"empate {base.get('D', 0):.1%} | fora {base.get('A', 0):.1%}"
    )

    # --------------------------------------------------------------- features
    feat = build_features(df)
    feat.to_csv(FEATURES_FILE, index=False, float_format="%.4f")
    print(f"[features] {len(FEATURES)} features | {len(feat)} partidas -> {FEATURES_FILE.name}")

    # ------------------------------------------------------- walk-forward
    print("\n[validacao] walk-forward (treina no passado, preve a temporada inteira):")
    preds = walk_forward(feat)
    preds_poisson = walk_forward_poisson(feat)
    preds_all = pd.concat([preds, preds_poisson], ignore_index=True)

    summary = metrics_summary(preds_all)
    by_season = metrics_by_season(preds_all)

    print("\n=== Desempenho out-of-fold (2016-2026) ===")
    _print_summary(summary)

    always_home = (preds_all[preds_all["model"] == MODEL_SPECS[0].name]["y"] == "H").mean()
    print(f"\nReferência 'sempre casa': acurácia {always_home:.1%} (mas log loss alto)")

    summary.to_csv(METRICS_FILE, index=False, float_format="%.5f")
    by_season.to_csv(REPORTS / "metrics_by_season.csv", index=False, float_format="%.5f")
    preds_all.to_csv(PREDICTIONS_FILE, index=False, float_format="%.5f")
    print(f"[saida] metricas -> {METRICS_FILE.name}, {PREDICTIONS_FILE.name}")

    # ------------------------------------------------------------ graficos
    hgb = "HistGradientBoosting"
    shown = [MARKET_NAME, hgb, "Blend LogReg + HGB", "LogReg", "Poisson (gols)", "Frequência do treino"]
    plots.plot_logloss_by_season(by_season, shown, plots.FIGURE_FILES["logloss"])

    pooled = preds_all[preds_all["season"] >= 2020]
    calib_model = calibration_table(
        pooled[pooled["model"] == hgb]["y"], pooled[pooled["model"] == hgb]["p_H"]
    )
    calib_market = calibration_table(
        pooled[pooled["model"] == MARKET_NAME]["y"], pooled[pooled["model"] == MARKET_NAME]["p_H"]
    )
    plots.plot_calibration(calib_model, calib_market, plots.FIGURE_FILES["calibracao"])

    best_rows = preds_all[preds_all["model"] == hgb]
    y_pred = [CLASSES[i] for i in best_rows[["p_H", "p_D", "p_A"]].to_numpy().argmax(axis=1)]
    plots.plot_confusion(best_rows["y"], y_pred, plots.FIGURE_FILES["confusao"])

    # ------------------------------------- importancia (modelo honesto: 2026)
    last_season = season
    train_imp = feat[feat["season"] < last_season]
    test_imp = feat[feat["season"] == last_season]
    if len(test_imp) > 50:
        model_imp = _hist_gb().fit(train_imp[FEATURES], train_imp["result"])
        perm = permutation_importance(
            model_imp,
            test_imp[FEATURES],
            test_imp["result"],
            scoring="neg_log_loss",
            n_repeats=15,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
        importance = (
            pd.DataFrame(
                {"feature": FEATURES, "importance": perm.importances_mean, "std": perm.importances_std}
            )
            .sort_values("importance", ascending=False)
            .reset_index(drop=True)
        )
        importance.to_csv(REPORTS / "feature_importance.csv", index=False, float_format="%.5f")
        plots.plot_importance(importance, plots.FIGURE_FILES["importancia"])

    # ------------------------------------------------ simulacao da temporada
    table = season_table(df, season)
    fixtures = remaining_fixtures(df, season)
    poisson_current = fit_poisson(df, ref_date=df.date.max())
    sim = simulate_season(poisson_current, table, fixtures, n_sims=10_000)
    sim.to_csv(SIM_FILE, index=False, float_format="%.5f")
    print(
        f"\n[simulacao] {len(fixtures)} jogos restantes | "
        f"{len(table)} times | 10.000 simulacoes -> {SIM_FILE.name}"
    )

    top = sim.head(5)
    for row in top.itertuples(index=False):
        print(
            f"   {row.team:<14} titulo {row.prob_title:6.1%} | "
            f"G4 {row.prob_top4:6.1%} | queda {row.prob_relegation:6.1%} | "
            f"{row.points_mean:5.1f} pts"
        )
    plots.plot_simulation(sim, plots.FIGURE_FILES["simulacao"])
    plots.plot_points_race(sim, plots.FIGURE_FILES["pontos"])

    states = latest_states(df)
    top_elo = sorted(states.values(), key=lambda s: s.elo, reverse=True)[:6]
    plots.plot_elo_history(feat, [s.team for s in top_elo], plots.FIGURE_FILES["elo"])

    # ------------------------------------------------- modelos finais salvos
    X, y = feat[FEATURES], feat["result"]
    final_models = {
        "LogReg": _logreg().fit(X, y),
        "HistGradientBoosting": _hist_gb().fit(X, y),
        "Blend LogReg + HGB": AverageBlend([_logreg(), _hist_gb()]).fit(X, y),
    }

    payload = {
        "features": FEATURES,
        "classes": CLASSES,
        "models": final_models,
        "poisson": poisson_current.to_dict(),
        "trained_on": str(df.date.max().date()),
        "season": season,
        "n_matches": int(len(df)),
    }
    joblib.dump(payload, MODEL_FILE)

    (REPORTS / "run_info.json").write_text(
        json.dumps(
            {
                "partidas": int(len(df)),
                "temporadas": [int(df.season.min()), int(df.season.max())],
                "ultima_partida": str(df.date.max().date()),
                "features": len(FEATURES),
                "jogos_restantes": int(len(fixtures)),
                "simulacoes": 10_000,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[saida] modelo final -> {MODEL_FILE.name} | graficos -> reports/figures/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
