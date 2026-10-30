"""Backtest honesto: modelo vs mercado, incluindo teste de valor e bootstrap.

Roda o mesmo walk-forward do treino, mas com foco em tres perguntas:

1. O modelo bate o mercado em log loss de forma estatisticamente significativa?
   (bootstrap pareado por partida, IC 95%)
2. Se o modelo aposta quando ve "valor" (p_modelo * odd > 1), ele lucra?
3. O lucro/ROI some quando usamos a Pinnacle (mercado eficiente, margem ~3%)
   em vez da media do mercado (margem ~6,8%)?

Uso:
    python scripts/backtest.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import numpy as np
import pandas as pd

from brasileirao_ml.config import CLASSES, FEATURES_FILE, REPORTS
from brasileirao_ml.data import load_matches
from brasileirao_ml.evaluate import log_loss, score
from brasileirao_ml.features import FEATURES
from brasileirao_ml.models import MODEL_SPECS, fit_predict

# Conjuntos de odds: chave em data.ODDS_SETS -> rotulo
MARKETS = {
    "avg": "Média do mercado",
    "pinnacle": "Pinnacle (fechamento)",
    "max": "Melhor preço",
}
N_BOOT = 4_000
SEED = 42


def _odds_columns(key: str) -> list[str]:
    return [f"odds_{side}_{key}" for side in ("home", "draw", "away")]


def _normalize(odds: np.ndarray) -> np.ndarray:
    """Remove o overround dividindo pela soma das probabilidades implicitas."""
    with np.errstate(divide="ignore", invalid="ignore"):
        inv = np.where(odds > 1.0, 1.0 / odds, np.nan)
    total = np.nansum(inv, axis=1, keepdims=True)
    return inv / total


def _load() -> pd.DataFrame:
    feat = pd.read_csv(FEATURES_FILE, parse_dates=["date"])
    raw = load_matches()
    odds_cols = [c for key in MARKETS for c in _odds_columns(key)]
    return feat.merge(raw[["match_id"] + odds_cols], on="match_id", how="left")


def _walk_forward(df: pd.DataFrame, model_name: str) -> pd.DataFrame:
    """Previsoes out-of-fold do modelo escolhido (mesmo esquema do treino)."""
    spec = next(s for s in MODEL_SPECS if s.name == model_name)
    chunks = []
    for season in sorted(s for s in df["season"].unique() if s >= 2016):
        train = df[df["season"] < season]
        test = df[df["season"] == season]
        proba = fit_predict(spec, train[FEATURES], train["result"], test[FEATURES])
        chunk = test[["match_id", "season", "result"] + [c for k in MARKETS for c in _odds_columns(k)]].copy()
        chunk["p_H"], chunk["p_D"], chunk["p_A"] = proba[:, 0], proba[:, 1], proba[:, 2]
        chunks.append(chunk)
    return pd.concat(chunks, ignore_index=True)


def _paired_bootstrap(diff: np.ndarray, n_boot: int = N_BOOT, seed: int = SEED) -> tuple[float, float, float]:
    """Media da diferenca e IC 95% por bootstrap de partidas."""
    rng = np.random.default_rng(seed)
    means = np.array([rng.choice(diff, size=len(diff), replace=True).mean() for _ in range(n_boot)])
    lo, hi = np.percentile(means, [2.5, 97.5])
    return float(diff.mean()), float(lo), float(hi)


def _betting(proba: np.ndarray, odds: np.ndarray, y_idx: np.ndarray, threshold: float):
    """Aposta 1 unidade no resultado de maior valor esperado, se EV > threshold."""
    ev = proba * odds - 1.0
    pick = ev.argmax(axis=1)
    rows = np.arange(len(pick))
    take = ev[rows, pick] > threshold
    if not take.any():
        return {"n_bets": 0, "profit": 0.0, "roi": float("nan"), "avg_odds": float("nan")}

    odds_pick = odds[take, pick[take]]
    won = pick[take] == y_idx[take]
    payout = np.where(won, odds_pick - 1.0, -1.0)
    return {
        "n_bets": int(take.sum()),
        "profit": float(payout.sum()),
        "roi": float(payout.mean()),
        "avg_odds": float(odds_pick.mean()),
    }


def main() -> int:
    print("[backtest] carregando features e odds...")
    df = _load()

    # ------------------------------------------------ modelo escolhido
    model_name = "LogReg"
    print(f"[backtest] walk-forward do modelo: {model_name}")
    preds = _walk_forward(df, model_name)

    y_idx_all = np.array([CLASSES.index(v) for v in preds["result"]])
    p_model_all = preds[["p_H", "p_D", "p_A"]].to_numpy()

    summary_rows: list[dict] = []
    bootstrap_rows: list[dict] = []
    betting_rows: list[dict] = []

    for key, label in MARKETS.items():
        cols = _odds_columns(key)
        valid = (preds[cols] > 1.0).all(axis=1).to_numpy()
        if not valid.any():
            continue

        odds = preds.loc[valid, cols].to_numpy(float)
        p_mkt = _normalize(odds)
        y_idx = y_idx_all[valid]
        p_model = p_model_all[valid]

        m_model = score(preds.loc[valid, "result"], p_model)
        m_mkt = score(preds.loc[valid, "result"], p_mkt)
        summary_rows.append(
            {
                "mercado": label,
                "n": int(valid.sum()),
                "modelo_log_loss": m_model["log_loss"],
                "mercado_log_loss": m_mkt["log_loss"],
                "modelo_brier": m_model["brier"],
                "mercado_brier": m_mkt["brier"],
                "modelo_rps": m_model["rps"],
                "mercado_rps": m_mkt["rps"],
                "modelo_acc": m_model["accuracy"],
                "mercado_acc": m_mkt["accuracy"],
            }
        )

        diff = (
            -np.log(np.clip(p_model[np.arange(len(y_idx)), y_idx], 1e-15, 1.0))
            + np.log(np.clip(p_mkt[np.arange(len(y_idx)), y_idx], 1e-15, 1.0))
        )
        mean_diff, lo, hi = _paired_bootstrap(diff)
        bootstrap_rows.append(
            {
                "mercado": label,
                "n": int(valid.sum()),
                "delta_log_loss": mean_diff,
                "ic95_lo": lo,
                "ic95_hi": hi,
                "significativo": bool(lo > 0 or hi < 0),
            }
        )

        for threshold in (0.0, 0.05, 0.10):
            bet = _betting(p_model, odds, y_idx, threshold)
            # Placebo: as proprias probabilidades do mercado
            placebo = _betting(p_mkt, odds, y_idx, threshold)
            betting_rows.append(
                {
                    "mercado": label,
                    "edge_minimo": threshold,
                    "apostas_modelo": bet["n_bets"],
                    "roi_modelo": bet["roi"],
                    "odd_media_modelo": bet["avg_odds"],
                    "apostas_placebo": placebo["n_bets"],
                    "roi_placebo": placebo["roi"],
                }
            )

    summary = pd.DataFrame(summary_rows)
    bootstrap = pd.DataFrame(bootstrap_rows)
    betting = pd.DataFrame(betting_rows)

    summary.to_csv(REPORTS / "backtest_summary.csv", index=False, float_format="%.5f")
    bootstrap.to_csv(REPORTS / "backtest_bootstrap.csv", index=False, float_format="%.5f")
    betting.to_csv(REPORTS / "backtest_betting.csv", index=False, float_format="%.5f")

    # ------------------------------------------------------------- relatorio
    print("\n=== Modelo vs mercado (log loss, quanto menor melhor) ===")
    show = summary.copy()
    show["delta_log_loss"] = show["modelo_log_loss"] - show["mercado_log_loss"]
    print(
        show[
            [
                "mercado",
                "n",
                "modelo_log_loss",
                "mercado_log_loss",
                "delta_log_loss",
                "modelo_acc",
                "mercado_acc",
            ]
        ].round(4).to_string(index=False)
    )

    print("\n=== Diferenca pareada de log loss (modelo - mercado) ===")
    for row in bootstrap.itertuples(index=False):
        verdict = "significativa" if row.significativo else "dentro do ruido"
        print(
            f"  {row.mercado:24s} delta {row.delta_log_loss:+.4f} "
            f"| IC95% [{row.ic95_lo:+.4f}, {row.ic95_hi:+.4f}] -> {verdict}"
        )

    print("\n=== Aposta de valor (stake 1) ===")
    for row in betting.itertuples(index=False):
        roi_m = "  n/a  " if np.isnan(row.roi_modelo) else f"{row.roi_modelo:+.2%}"
        roi_p = "  n/a  " if np.isnan(row.roi_placebo) else f"{row.roi_placebo:+.2%}"
        print(
            f"  {row.mercado:24s} edge>{row.edge_minimo:+.0%} "
            f"| modelo {row.apostas_modelo:4d} apostas ROI {roi_m} "
            f"| placebo {row.apostas_placebo:4d} apostas ROI {roi_p}"
        )

    print(f"\n[saida] {REPORTS / 'backtest_summary.csv'} e correlatos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
