"""Exporta os artefatos do projeto para JSON estatico consumido pelo frontend.

Gera ``web/public/data/*.json`` a partir dos mesmos modelos e relatorios usados
pelo dashboard Streamlit. O site nao precisa de backend: a build do Vite le
esses arquivos e o deploy pode ser feito em GitHub Pages, Vercel ou Netlify.

Uso:
    python scripts/export_web_data.py
"""

from __future__ import annotations

import json
import math
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import joblib
import numpy as np
import pandas as pd

from brasileirao_ml.config import FEATURES_FILE, METRICS_FILE, MODEL_FILE, REPORTS, SIM_FILE
from brasileirao_ml.data import load_matches, season_table
from brasileirao_ml.evaluate import calibration_table
from brasileirao_ml.features import FEATURES, latest_states, match_features
from brasileirao_ml.poisson import PoissonModel

OUT = ROOT / "web" / "public" / "data"
SEASON = 2026
MARKET = "Mercado (média)"
BLEND = "Blend LogReg + HGB"
MODEL_KEYS = {
    "Blend LogReg + HGB": "blend",
    "LogReg": "logreg",
    "HistGradientBoosting": "hgb",
    "Poisson (gols)": "poisson",
}
PRETTY_MODEL = {
    "Blend LogReg + HGB": "Blend",
    "LogReg": "Logistic Regression",
    "HistGradientBoosting": "Gradient Boosting",
    "Poisson (gols)": "Poisson",
    "LogReg (só Elo)": "LogReg (só Elo)",
    "Frequência do treino": "Frequência do treino",
    "Mercado (média)": "Mercado",
}


def clean(value):
    """Converte tipos numpy/pandas em JSON valido (NaN/inf -> None)."""
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        value = float(value)
        return None if not math.isfinite(value) else round(value, 6)
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.strftime("%Y-%m-%d")
    if value is pd.NA or value is None:
        return None
    return value


def write_json(name: str, payload) -> None:
    path = OUT / name
    path.write_text(
        json.dumps(clean(payload), ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    size = path.stat().st_size / 1024
    print(f"[web] {name:<24} {size:7.1f} KB")


def predict_sklearn(artifacts: dict, feats: dict) -> dict[str, list[float]]:
    columns = artifacts["features"]
    classes = list(artifacts["classes"])
    x = pd.DataFrame([feats], columns=columns)
    out: dict[str, list[float]] = {}
    for name, model in artifacts["models"].items():
        raw = model.predict_proba(x)[0]
        order = [list(model.classes_).index(c) for c in classes]
        out[MODEL_KEYS[name]] = [float(v) for v in raw[order]]
    return out


def build_standings(matches: pd.DataFrame, states: dict) -> list[dict]:
    table = season_table(matches, SEASON).set_index("team")
    rows = []
    for team, state in sorted(states.items(), key=lambda kv: kv[1].position):
        row = table.loc[team]
        last = matches[
            ((matches["home"] == team) | (matches["away"] == team))
            & (matches["season"] == SEASON)
        ].sort_values("date")
        form = []
        for m in last.tail(5).itertuples(index=False):
            home = m.home == team
            gf = m.goals_home if home else m.goals_away
            ga = m.goals_away if home else m.goals_home
            form.append("V" if gf > ga else ("E" if gf == ga else "D"))
        rows.append(
            {
                "team": team,
                "position": int(row["position"]),
                "played": int(row["played"]),
                "wins": int(row["wins"]),
                "draws": int(row["draws"]),
                "losses": int(row["losses"]),
                "goalsFor": int(row["goals_for"]),
                "goalsAgainst": int(row["goals_against"]),
                "goalDiff": int(row["goal_diff"]),
                "points": int(row["points"]),
                "ppg": float(row["points"] / max(row["played"], 1)),
                "elo": float(state.elo),
                "form5Ppg": float(state.form5_ppg),
                "form5Gf": float(state.form5_gf),
                "form5Ga": float(state.form5_ga),
                "form": "".join(form),
                "prevPosition": None if math.isnan(state.prev_position) else int(state.prev_position),
                "promoted": bool(state.promoted),
            }
        )
    return rows


def build_fixtures(artifacts: dict, states: dict, sim_date: pd.Timestamp) -> list[dict]:
    pm = PoissonModel.from_dict(artifacts["poisson"])
    teams = sorted(states)
    fixtures = []
    for home in teams:
        for away in teams:
            if home == away:
                continue
            home_state, away_state = states[home], states[away]
            matchday = max(home_state.played, away_state.played) + 1
            feats = match_features(home_state, away_state, matchday=matchday, sim_date=sim_date)
            probs = predict_sklearn(artifacts, feats)
            probs["poisson"] = [float(v) for v in pm.outcome_probs(home, away)]
            lam_home, lam_away = pm.expected_goals(home, away)
            fixtures.append(
                {
                    "home": home,
                    "away": away,
                    "matchday": int(matchday),
                    "date": sim_date,
                    "probs": probs,
                    "xg": [lam_home, lam_away],
                }
            )
    return fixtures


def build_team_history(features: pd.DataFrame, states: dict) -> list[dict]:
    out = []
    last_season = int(features["season"].max())
    cut = pd.Timestamp(year=last_season - 3, month=1, day=1)
    for team in sorted(states):
        home = features.loc[features["home"] == team, ["date", "elo_home"]].rename(
            columns={"elo_home": "elo"}
        )
        away = features.loc[features["away"] == team, ["date", "elo_away"]].rename(
            columns={"elo_away": "elo"}
        )
        elo = pd.concat([home, away]).sort_values("date")
        elo = elo[elo["date"] >= cut]
        matches = features[
            (features["home"] == team) | (features["away"] == team)
        ].sort_values("date").tail(10)
        games = []
        for m in matches.itertuples(index=False):
            is_home = m.home == team
            gf, ga = (m.goals_home, m.goals_away) if is_home else (m.goals_away, m.goals_home)
            games.append(
                {
                    "date": m.date,
                    "opponent": m.away if is_home else m.home,
                    "home": bool(is_home),
                    "goalsFor": int(gf),
                    "goalsAgainst": int(ga),
                    "result": "V" if gf > ga else ("E" if gf == ga else "D"),
                }
            )
        out.append(
            {
                "team": team,
                "elo": [[d.strftime("%Y-%m-%d"), float(v)] for d, v in zip(elo["date"], elo["elo"])],
                "games": games,
            }
        )
    return out


def build_metrics() -> dict:
    metrics = pd.read_csv(METRICS_FILE)
    metrics["pretty"] = metrics["model"].map(lambda m: PRETTY_MODEL.get(m, m))
    seasons = pd.read_csv(REPORTS / "metrics_by_season.csv")
    seasons["pretty"] = seasons["model"].map(lambda m: PRETTY_MODEL.get(m, m))
    importance = pd.read_csv(REPORTS / "feature_importance.csv")
    return {
        "metrics": metrics.to_dict(orient="records"),
        "seasons": seasons.to_dict(orient="records"),
        "importance": importance.to_dict(orient="records"),
    }


def build_backtest() -> dict:
    out = {}
    for name in ("summary", "bootstrap", "betting"):
        path = REPORTS / f"backtest_{name}.csv"
        out[name] = pd.read_csv(path).to_dict(orient="records") if path.exists() else []
    return out


def build_calibration() -> dict:
    preds = pd.read_csv(REPORTS / "predictions_walkforward.csv")
    out = {}
    for model, key in ((BLEND, "model"), (MARKET, "market")):
        sub = preds[preds["model"] == model]
        table = calibration_table(sub["y"], sub["p_H"])
        out[key] = table.to_dict(orient="records")
    return out


def build_confusion() -> dict:
    preds = pd.read_csv(REPORTS / "predictions_walkforward.csv")
    sub = preds[preds["model"] == BLEND]
    proba = sub[["p_H", "p_D", "p_A"]].to_numpy()
    pred = np.array(["H", "D", "A"])[proba.argmax(axis=1)]
    labels = ["H", "D", "A"]
    matrix = [[int(((sub["y"] == t) & (pred == p)).sum()) for p in labels] for t in labels]
    return {"labels": labels, "matrix": matrix}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    artifacts = joblib.load(MODEL_FILE)
    matches = load_matches()
    features = pd.read_csv(FEATURES_FILE, parse_dates=["date"])
    states = latest_states(matches)
    simulation = pd.read_csv(SIM_FILE)
    run_info = json.loads((REPORTS / "run_info.json").read_text(encoding="utf-8"))
    sim_date = max(s.last_date for s in states.values()) + pd.Timedelta(days=4)

    meta = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "trainedOn": artifacts.get("trained_on"),
        "nMatches": run_info.get("partidas", len(matches)),
        "seasons": run_info.get("temporadas", [int(matches.season.min()), SEASON]),
        "lastMatch": run_info.get("ultima_partida"),
        "nFeatures": len(FEATURES),
        "remaining": run_info.get("jogos_restantes"),
        "nSims": run_info.get("simulacoes"),
        "season": SEASON,
        "simDate": sim_date.strftime("%Y-%m-%d"),
        "teams": sorted(states),
        "models": [
            {"key": "blend", "label": "Blend", "full": "Blend LogReg + HGB"},
            {"key": "logreg", "label": "LogReg", "full": "Logistic Regression"},
            {"key": "hgb", "label": "Boosting", "full": "Gradient Boosting"},
            {"key": "poisson", "label": "Poisson", "full": "Poisson de gols"},
        ],
    }

    write_json("meta.json", meta)
    write_json("standings.json", build_standings(matches, states))
    write_json("simulation.json", simulation.to_dict(orient="records"))
    write_json("fixtures.json", build_fixtures(artifacts, states, sim_date))
    write_json("teams.json", build_team_history(features, states))
    write_json("performance.json", build_metrics())
    write_json("backtest.json", build_backtest())
    write_json("calibration.json", build_calibration())
    write_json("confusion.json", build_confusion())

    print(f"[web] dados exportados para {OUT}")


if __name__ == "__main__":
    main()
