"""Graficos do projeto (matplotlib, backend Agg -> PNG)."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix

from .config import CLASSES, FIGURES

COLORS = {
    "market": "#b91c1c",
    "primary": "#0f766e",
    "secondary": "#7c3aed",
    "third": "#c2410c",
    "muted": "#94a3b8",
}
MODEL_COLORS = {
    "Mercado (média)": COLORS["market"],
    "HistGradientBoosting": COLORS["primary"],
    "Blend LogReg + HGB": COLORS["secondary"],
    "LogReg": COLORS["third"],
    "Poisson (gols)": "#2563eb",
    "Frequência do treino": COLORS["muted"],
    "LogReg (só Elo)": "#a3a3a3",
}


def _style() -> None:
    plt.rcParams.update(
        {
            "figure.dpi": 130,
            "savefig.dpi": 130,
            "savefig.bbox": "tight",
            "font.size": 10,
            "axes.titlesize": 12,
            "axes.titleweight": "bold",
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.grid": True,
            "grid.alpha": 0.25,
            "grid.linestyle": "-",
            "legend.frameon": False,
        }
    )


def _save(fig, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path)
    plt.close(fig)
    return path


def plot_logloss_by_season(by_season: pd.DataFrame, models: list[str], path: Path) -> Path:
    _style()
    fig, ax = plt.subplots(figsize=(9, 4.6))

    for model in models:
        data = by_season[by_season["model"] == model].sort_values("season")
        if data.empty:
            continue
        ax.plot(
            data["season"],
            data["log_loss"],
            marker="o",
            markersize=4,
            linewidth=2.0 if model in ("Mercado (média)", "HistGradientBoosting") else 1.4,
            label=model,
            color=MODEL_COLORS.get(model, COLORS["muted"]),
            alpha=1.0 if model != "Frequência do treino" else 0.8,
        )

    ax.set_title("Log loss por temporada (menor = melhor)")
    ax.set_xlabel("Temporada")
    ax.set_ylabel("Log loss")
    ax.set_xticks(sorted(by_season["season"].unique()))
    ax.legend(ncol=2, loc="upper right", fontsize=8.5)
    return _save(fig, path)


def plot_calibration(calib_model: pd.DataFrame, calib_market: pd.DataFrame, path: Path) -> Path:
    _style()
    fig, ax = plt.subplots(figsize=(5.2, 5.2))

    ax.plot([0, 1], [0, 1], linestyle="--", color="#64748b", linewidth=1, label="Perfeito")
    ax.plot(
        calib_model["p_mean"],
        calib_model["freq"],
        marker="o",
        color=COLORS["primary"],
        linewidth=2,
        label="Modelo (HGB)",
    )
    ax.plot(
        calib_market["p_mean"],
        calib_market["freq"],
        marker="s",
        color=COLORS["market"],
        linewidth=2,
        label="Mercado",
    )

    ax.set_xlabel("Probabilidade prevista de vitória em casa")
    ax.set_ylabel("Frequência observada")
    ax.set_title("Calibração (vitória do mandante)")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.legend(loc="upper left")
    return _save(fig, path)


def plot_confusion(y_true, y_pred, path: Path) -> Path:
    _style()
    labels = ["Casa", "Empate", "Fora"]
    cm = confusion_matrix(y_true, y_pred, labels=CLASSES, normalize="true")

    fig, ax = plt.subplots(figsize=(4.8, 4.2))
    image = ax.imshow(cm, cmap="Blues", vmin=0, vmax=1)
    fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)

    ax.set_xticks(range(3), labels)
    ax.set_yticks(range(3), labels)
    ax.set_xlabel("Previsto")
    ax.set_ylabel("Real")
    ax.set_title("Matriz de confusão (linhas somam 100%)")
    ax.grid(False)

    for i in range(3):
        for j in range(3):
            ax.text(
                j,
                i,
                f"{cm[i, j]:.0%}",
                ha="center",
                va="center",
                color="white" if cm[i, j] > 0.5 else "#0f172a",
                fontsize=11,
                fontweight="bold",
            )
    return _save(fig, path)


def plot_importance(importance: pd.DataFrame, path: Path, top: int = 15) -> Path:
    _style()
    data = importance.head(top).iloc[::-1]
    fig, ax = plt.subplots(figsize=(7.4, 5.4))
    ax.barh(data["feature"], data["importance"], color=COLORS["primary"], alpha=0.85)
    ax.set_xlabel("Aumento do log loss ao embaralhar a feature")
    ax.set_title(f"Importância das features (permutação, top {top})")
    return _save(fig, path)


def plot_elo_history(features: pd.DataFrame, teams: list[str], path: Path) -> Path:
    _style()
    home = features[["date", "season", "home", "elo_home"]].rename(
        columns={"home": "team", "elo_home": "elo"}
    )
    away = features[["date", "season", "away", "elo_away"]].rename(
        columns={"away": "team", "elo_away": "elo"}
    )
    elo = pd.concat([home, away], ignore_index=True).sort_values("date")
    elo = elo[elo["season"] >= elo["season"].max() - 3]

    fig, ax = plt.subplots(figsize=(9, 4.8))
    cmap = plt.get_cmap("tab10")
    for i, team in enumerate(teams):
        data = elo[elo["team"] == team]
        ax.plot(data["date"], data["elo"], linewidth=1.8, label=team, color=cmap(i))

    ax.set_title("Rating Elo (últimas 4 temporadas)")
    ax.set_ylabel("Elo")
    ax.legend(ncol=3, fontsize=8, loc="upper left")
    return _save(fig, path)


def plot_simulation(sim: pd.DataFrame, path: Path) -> Path:
    _style()
    fig, axes = plt.subplots(1, 2, figsize=(11, 5.2))

    titulo = sim.sort_values("prob_title", ascending=False).head(8)
    axes[0].barh(titulo["team"][::-1], titulo["prob_title"][::-1] * 100, color=COLORS["primary"])
    axes[0].set_title("Chance de título")
    axes[0].set_xlabel("%")
    axes[0].set_xlim(0, 100)

    queda = sim.sort_values("prob_relegation", ascending=False).head(8)
    axes[1].barh(queda["team"][::-1], queda["prob_relegation"][::-1] * 100, color=COLORS["market"])
    axes[1].set_title("Risco de rebaixamento")
    axes[1].set_xlabel("%")
    axes[1].set_xlim(0, 100)

    return _save(fig, path)


def plot_points_race(sim: pd.DataFrame, path: Path) -> Path:
    """Distribuicao de pontos projetados (intervalo de 90%)."""
    _style()
    data = sim.sort_values("points_mean", ascending=True).head(20)
    fig, ax = plt.subplots(figsize=(8, 6))
    y = np.arange(len(data))
    ax.hlines(y, data["points_p5"], data["points_p95"], color=COLORS["muted"], linewidth=3)
    ax.plot(data["points_mean"], y, "o", color=COLORS["primary"], markersize=6)
    ax.set_yticks(y, data["team"])
    ax.set_xlabel("Pontos ao final (média e intervalo de 90%)")
    ax.set_title("Projeção de pontos")
    return _save(fig, path)


FIGURE_FILES = {
    "logloss": FIGURES / "logloss_por_temporada.png",
    "calibracao": FIGURES / "calibracao.png",
    "confusao": FIGURES / "matriz_confusao.png",
    "importancia": FIGURES / "importancia_features.png",
    "elo": FIGURES / "elo_historico.png",
    "simulacao": FIGURES / "simulacao_titulo_queda.png",
    "pontos": FIGURES / "projecao_pontos.png",
}
