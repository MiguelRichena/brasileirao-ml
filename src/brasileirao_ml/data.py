"""Leitura e limpeza dos dados brutos do football-data.co.uk."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .config import RAW_FILE

# Nomes como aparecem no CSV -> nomes exibidos no projeto.
TEAM_ALIASES = {
    "Flamengo RJ": "Flamengo",
    "Botafogo RJ": "Botafogo",
    "Atletico-MG": "Atlético-MG",
    "Atletico GO": "Atlético-GO",
    "Atletico-PR": "Athletico-PR",
    "Athletico-PR": "Athletico-PR",
    "America MG": "América-MG",
    "Sao Paulo": "São Paulo",
    "Gremio": "Grêmio",
    "Vitoria": "Vitória",
    "Ceara": "Ceará",
    "Goias": "Goiás",
    "Avai": "Avaí",
    "Criciuma": "Criciúma",
    "Nautico": "Náutico",
    "Parana": "Paraná",
    "Chapecoense-SC": "Chapecoense",
    "Sport Recife": "Sport",
    "Bragantino": "Bragantino",
    "Vasco": "Vasco",
}

ODDS_SETS = {
    "avg": ("AvgCH", "AvgCD", "AvgCA"),
    "max": ("MaxCH", "MaxCD", "MaxCA"),
    "b365": ("B365CH", "B365CD", "B365CA"),
    "pinnacle": ("PSCH", "PSCD", "PSCA"),
}
ODDS_PRIORITY = ("avg", "b365", "max", "pinnacle")


def load_matches(path: Path | str = RAW_FILE) -> pd.DataFrame:
    """Carrega o CSV bruto e devolve uma tabela limpa, uma linha por partida.

    Colunas resultantes: match_id, season, date, time, home, away,
    goals_home, goals_away, result, odds_* e p_*_mkt (probabilidades
    implicitas do mercado, normalizadas).
    """
    raw = pd.read_csv(path, encoding="utf-8-sig")
    raw = raw.loc[:, ~raw.columns.str.startswith("Unnamed")]

    df = pd.DataFrame(
        {
            "season": raw["Season"].astype(int),
            "date": pd.to_datetime(raw["Date"], dayfirst=True, errors="coerce"),
            "time": raw["Time"],
            "home": raw["Home"].str.strip().replace(TEAM_ALIASES),
            "away": raw["Away"].str.strip().replace(TEAM_ALIASES),
            "goals_home": pd.to_numeric(raw["HG"], errors="coerce"),
            "goals_away": pd.to_numeric(raw["AG"], errors="coerce"),
        }
    )

    # Sem placar nao ha como calcular a verdadeira classe do resultado.
    n_before = len(df)
    df = df.dropna(subset=["date", "home", "away", "goals_home", "goals_away"])
    df = df.astype({"goals_home": int, "goals_away": int})
    dropped = n_before - len(df)

    df["result"] = np.select(
        [df.goals_home > df.goals_away, df.goals_home == df.goals_away],
        ["H", "D"],
        default="A",
    )

    for key, cols in ODDS_SETS.items():
        for side, col in zip(("home", "draw", "away"), cols):
            df[f"odds_{side}_{key}"] = pd.to_numeric(raw[col], errors="coerce")

    df = df.sort_values(["date", "home", "away"]).reset_index(drop=True)
    df["match_id"] = np.arange(len(df))

    df = _add_market_probs(df)

    if dropped:
        print(f"[dados] {dropped} partida(s) descartada(s) por falta de placar.")
    return df


def _add_market_probs(df: pd.DataFrame) -> pd.DataFrame:
    """Probabilidades implicitas do mercado, sem margem da casa (overround).

    Usa a media do mercado (AvgCH/CD/CA) e cai para Bet365, maxima e Pinnacle
    quando necessario -- o CSV tem cobertura diferente por temporada.
    """
    out = df.copy()
    implied = pd.DataFrame(index=out.index, columns=["H", "D", "A"], dtype=float)

    for key in ODDS_PRIORITY:
        cols = [f"odds_{s}_{key}" for s in ("home", "draw", "away")]
        odds = out[cols].astype(float).to_numpy()
        with np.errstate(divide="ignore", invalid="ignore"):
            inv = np.where(odds > 1.0, 1.0 / odds, np.nan)
        row_sum = np.nansum(inv, axis=1)
        valid = np.isfinite(inv).all(axis=1) & (row_sum > 0)
        probs = inv / row_sum[:, None]

        todo = implied.isna().all(axis=1)
        use = valid & todo
        if use.any():
            implied.loc[use, ["H", "D", "A"]] = probs[use]

    out["p_home_mkt"] = implied["H"]
    out["p_draw_mkt"] = implied["D"]
    out["p_away_mkt"] = implied["A"]
    out["market_overround"] = (
        1.0 / out["odds_home_avg"]
        + 1.0 / out["odds_draw_avg"]
        + 1.0 / out["odds_away_avg"]
        - 1.0
    )
    return out


def current_season(df: pd.DataFrame) -> int:
    return int(df["season"].max())


def season_table(df: pd.DataFrame, season: int) -> pd.DataFrame:
    """Classificacao (pontos, saldo e gols) de uma temporada ja disputada."""
    s = df[df["season"] == season]
    teams = sorted(set(s["home"]) | set(s["away"]))

    rows = []
    for team in teams:
        home = s[s["home"] == team]
        away = s[s["away"] == team]
        wins = (home.goals_home > home.goals_away).sum() + (away.goals_away > away.goals_home).sum()
        draws = (home.goals_home == home.goals_away).sum() + (away.goals_away == away.goals_home).sum()
        rows.append(
            {
                "team": team,
                "played": len(home) + len(away),
                "wins": int(wins),
                "draws": int(draws),
                "losses": int(len(home) + len(away) - wins - draws),
                "goals_for": int(home.goals_home.sum() + away.goals_away.sum()),
                "goals_against": int(home.goals_away.sum() + away.goals_home.sum()),
                "points": int(3 * wins + draws),
            }
        )

    table = pd.DataFrame(rows)
    table["goal_diff"] = table["goals_for"] - table["goals_against"]
    table = table.sort_values(
        ["points", "goal_diff", "goals_for"], ascending=False
    ).reset_index(drop=True)
    table.insert(0, "position", table.index + 1)
    return table
