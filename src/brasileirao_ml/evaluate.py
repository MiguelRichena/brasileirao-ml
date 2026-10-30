"""Validacao walk-forward e metricas de previsao de futebol.

O esquema de validacao e o mais proximo possivel do uso real: para cada
temporada S, treina-se com tudo que aconteceu antes de S e preve-se S inteira.
Nenhuma informacao do futuro vaza para o treino.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import CLASSES, FIRST_TEST_SEASON
from .features import FEATURES
from .models import MODEL_SPECS, ModelSpec, fit_predict

MARKET_NAME = "Mercado (média)"


def rps(y_true: list[str], proba: np.ndarray) -> float:
    """Ranked Probability Score para resultados ordinais (casa > empate > fora)."""
    y = np.asarray(y_true)
    idx = np.array([CLASSES.index(v) for v in y])
    onehot = np.zeros_like(proba, dtype=float)
    onehot[np.arange(len(idx)), idx] = 1.0

    cum_p = np.cumsum(proba, axis=1)[:, :-1]
    cum_o = np.cumsum(onehot, axis=1)[:, :-1]
    return float(np.mean(np.sum((cum_p - cum_o) ** 2, axis=1) / (len(CLASSES) - 1)))


def brier(y_true: list[str], proba: np.ndarray) -> float:
    """Brier score multiclasse (soma dos erros quadraticos por partida)."""
    y = np.asarray(y_true)
    idx = np.array([CLASSES.index(v) for v in y])
    onehot = np.zeros_like(proba, dtype=float)
    onehot[np.arange(len(idx)), idx] = 1.0
    return float(np.mean(np.sum((proba - onehot) ** 2, axis=1)))


def log_loss(y_true, proba) -> float:
    """Log loss calculado na mao: -media(log p(classe real)).

    Feito aqui (em vez de sklearn.metrics.log_loss) porque esta funcao assume
    ordem alfabetica das colunas, e a ordem do projeto e H, D, A.
    """
    idx = np.array([CLASSES.index(v) for v in y_true])
    p_true = np.asarray(proba, dtype=float)[np.arange(len(idx)), idx]
    return float(-np.mean(np.log(np.clip(p_true, 1e-15, 1.0))))


def score(y_true, proba) -> dict[str, float]:
    """Metricas de um conjunto de previsoes (colunas na ordem H, D, A)."""
    proba = np.clip(np.asarray(proba, dtype=float), 1e-9, 1.0)
    proba = proba / proba.sum(axis=1, keepdims=True)
    y_true = list(y_true)
    pred = [CLASSES[i] for i in np.argmax(proba, axis=1)]

    return {
        "n": len(y_true),
        "accuracy": float(np.mean([p == t for p, t in zip(pred, y_true)])),
        "log_loss": log_loss(y_true, proba),
        "brier": brier(y_true, proba),
        "rps": rps(y_true, proba),
    }


def stack_predictions(
    frame: pd.DataFrame,
    model_name: str,
    proba: np.ndarray,
    extra: dict | None = None,
) -> pd.DataFrame:
    out = frame[["season", "date", "match_id", "home", "away", "result"]].copy()
    out = out.rename(columns={"result": "y"})
    out["model"] = model_name
    out["p_H"] = proba[:, 0]
    out["p_D"] = proba[:, 1]
    out["p_A"] = proba[:, 2]
    for key, value in (extra or {}).items():
        out[key] = value
    return out


def walk_forward(
    features: pd.DataFrame,
    first_test_season: int = FIRST_TEST_SEASON,
    specs: list[ModelSpec] | None = None,
) -> pd.DataFrame:
    """Previsoes out-of-fold por temporada para todos os modelos.

    Retorna uma tabela longa com uma linha por (partida, modelo).
    """
    specs = specs or MODEL_SPECS
    seasons = sorted(s for s in features["season"].unique() if s >= first_test_season)
    chunks: list[pd.DataFrame] = []

    for season in seasons:
        train = features[features["season"] < season]
        test = features[features["season"] == season]
        X_train, y_train = train[FEATURES], train["result"]
        X_test = test[FEATURES]

        for spec in specs:
            proba = fit_predict(spec, X_train, y_train, X_test)
            chunks.append(stack_predictions(test, spec.name, proba))

        market_cols = ["p_home_mkt", "p_draw_mkt", "p_away_mkt"]
        if test[market_cols].notna().all(axis=1).any():
            valid = test[market_cols].notna().all(axis=1)
            chunks.append(
                stack_predictions(
                    test[valid],
                    MARKET_NAME,
                    test.loc[valid, market_cols].to_numpy(),
                )
            )

        print(f"  walk-forward {season}: treino={len(train):4d} teste={len(test):3d}")

    return pd.concat(chunks, ignore_index=True)


def metrics_by_season(predictions: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (season, model), group in predictions.groupby(["season", "model"], sort=True):
        row = {"season": season, "model": model}
        row.update(score(group["y"], group[["p_H", "p_D", "p_A"]].to_numpy()))
        rows.append(row)
    return pd.DataFrame(rows)


def metrics_summary(predictions: pd.DataFrame) -> pd.DataFrame:
    """Metricas agregadas por modelo, restritas ao subconjunto com odds."""
    has_market = predictions.groupby("match_id")["model"].transform(
        lambda s: MARKET_NAME in set(s)
    )
    subset = predictions[has_market]

    rows = []
    for model, group in subset.groupby("model", sort=True):
        row = {"model": model}
        row.update(score(group["y"], group[["p_H", "p_D", "p_A"]].to_numpy()))
        rows.append(row)

    table = pd.DataFrame(rows).sort_values("log_loss").reset_index(drop=True)
    table.insert(0, "rank", table.index + 1)
    return table


def calibration_table(y_true, proba_home) -> pd.DataFrame:
    """Reliability diagram em bins de probabilidade (10 bins de largura fixa)."""
    y = np.asarray([1.0 if v == "H" else 0.0 for v in y_true])
    p = np.asarray(proba_home, dtype=float)
    bins = np.clip((p * 10).astype(int), 0, 9)

    rows = []
    for b in range(10):
        mask = bins == b
        if mask.sum() == 0:
            continue
        rows.append(
            {
                "bin": b,
                "p_mean": float(p[mask].mean()),
                "freq": float(y[mask].mean()),
                "n": int(mask.sum()),
            }
        )
    return pd.DataFrame(rows)


def best_model_name(summary: pd.DataFrame, exclude: tuple[str, ...] = (MARKET_NAME,)) -> str:
    candidates = summary[~summary["model"].isin(exclude)]
    return str(candidates.sort_values("log_loss").iloc[0]["model"])
