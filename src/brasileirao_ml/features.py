"""Engenharia de atributos (features) pre-jogo, sem vazamento de informacao.

Regra de ouro: toda feature de um jogo usa apenas partidas ANTERIORES a ele.
Isso e garantido de tres formas:

1. Elo e calculado num unico passe cronologico (atualizado depois do jogo).
2. Medias moveis de forma usam ``shift(1)`` antes do ``rolling``.
3. Estatisticas da temporada usam cumulativo defasado e um "snapshot" da
   tabela na data do jogo.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import (
    ELO_K,
    ELO_START,
    HOME_ADV_ELO,
    POINTS_WIN,
    SEASON_REGRESSION,
)
from .data import season_table

# Features entregues aos modelos (ordem estavel, usada pelo joblib).
FEATURES: list[str] = [
    "elo_home",
    "elo_away",
    "elo_diff",
    "elo_home_adv",
    "form5_ppg_home",
    "form5_ppg_away",
    "form5_ppg_diff",
    "form5_gf_home",
    "form5_gf_away",
    "form5_ga_home",
    "form5_ga_away",
    "form5_attack_diff",
    "form5_defense_diff",
    "form10_ppg_home",
    "form10_ppg_away",
    "form10_ppg_diff",
    "season_ppg_home",
    "season_ppg_away",
    "season_ppg_diff",
    "season_gdpg_home",
    "season_gdpg_away",
    "pos_home",
    "pos_away",
    "pos_diff",
    "prev_pos_home",
    "prev_pos_away",
    "rest_home",
    "rest_away",
    "rest_diff",
    "promoted_home",
    "promoted_away",
    "matchday",
]

META_COLUMNS = [
    "match_id",
    "season",
    "date",
    "home",
    "away",
    "goals_home",
    "goals_away",
    "result",
    "p_home_mkt",
    "p_draw_mkt",
    "p_away_mkt",
]


# ---------------------------------------------------------------------------
# Formato longo (uma linha por time por partida)
# ---------------------------------------------------------------------------
def _long_format(df: pd.DataFrame) -> pd.DataFrame:
    home = pd.DataFrame(
        {
            "match_id": df["match_id"].to_numpy(),
            "season": df["season"].to_numpy(),
            "date": df["date"].to_numpy(),
            "team": df["home"].to_numpy(),
            "opponent": df["away"].to_numpy(),
            "is_home": 1,
            "gf": df["goals_home"].to_numpy(),
            "ga": df["goals_away"].to_numpy(),
        }
    )
    away = pd.DataFrame(
        {
            "match_id": df["match_id"].to_numpy(),
            "season": df["season"].to_numpy(),
            "date": df["date"].to_numpy(),
            "team": df["away"].to_numpy(),
            "opponent": df["home"].to_numpy(),
            "is_home": 0,
            "gf": df["goals_away"].to_numpy(),
            "ga": df["goals_home"].to_numpy(),
        }
    )
    long = pd.concat([home, away], ignore_index=True)
    long["points"] = np.where(
        long.gf > long.ga, POINTS_WIN, np.where(long.gf == long.ga, 1, 0)
    )
    return long.sort_values(
        ["date", "match_id", "is_home"], ascending=[True, True, False]
    ).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Elo
# ---------------------------------------------------------------------------
def elo_timeline(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float]]:
    """Elo pre-jogo de cada partida e o rating final por time.

    K=20, vantagem de casa de 60 pontos, multiplicador por saldo de gols e
    regressao de 25% para a media no inicio de cada temporada.
    """
    order = df.sort_values(["date", "match_id"])
    ratings: dict[str, float] = {}
    rows = []
    season_atual = None

    for row in order.itertuples(index=False):
        if row.season != season_atual:
            if season_atual is not None:
                for team in list(ratings):
                    ratings[team] = ELO_START + SEASON_REGRESSION * (
                        ratings[team] - ELO_START
                    )
            season_atual = row.season

        elo_home = ratings.get(row.home, ELO_START)
        elo_away = ratings.get(row.away, ELO_START)
        rows.append((row.match_id, elo_home, elo_away))

        expected = 1.0 / (1.0 + 10.0 ** (-((elo_home + HOME_ADV_ELO - elo_away) / 400.0)))
        if row.goals_home > row.goals_away:
            score = 1.0
        elif row.goals_home == row.goals_away:
            score = 0.5
        else:
            score = 0.0

        diff = abs(row.goals_home - row.goals_away)
        mult = 1.0 if diff <= 1 else (1.5 if diff == 2 else (11.0 + diff) / 8.0)
        delta = ELO_K * mult * (score - expected)
        ratings[row.home] = elo_home + delta
        ratings[row.away] = elo_away - delta

    timeline = pd.DataFrame(rows, columns=["match_id", "elo_home", "elo_away"])
    return timeline, ratings


# ---------------------------------------------------------------------------
# Forma recente e estatisticas da temporada
# ---------------------------------------------------------------------------
def _add_rolling(long: pd.DataFrame) -> pd.DataFrame:
    out = long.copy()
    grouped = out.groupby("team", sort=False)

    out["form5_ppg"] = grouped["points"].transform(
        lambda s: s.shift(1).rolling(5, min_periods=3).mean()
    )
    out["form10_ppg"] = grouped["points"].transform(
        lambda s: s.shift(1).rolling(10, min_periods=5).mean()
    )
    for stat in ("gf", "ga"):
        out[f"form5_{stat}"] = grouped[stat].transform(
            lambda s: s.shift(1).rolling(5, min_periods=3).mean()
        )

    out["rest_days"] = grouped["date"].diff().dt.days.clip(lower=0, upper=60)
    out["rest_days"] = out["rest_days"].fillna(45.0)

    season_group = out.groupby(["team", "season"], sort=False)
    out["season_games_pre"] = season_group.cumcount()
    for stat, col in (("pts", "points"), ("gf", "gf"), ("ga", "ga")):
        out[f"season_{stat}_pre"] = season_group[col].transform(
            lambda s: s.shift(1).cumsum()
        )
    out["season_gd_pre"] = out["season_gf_pre"] - out["season_ga_pre"]
    out["matchday"] = out["season_games_pre"] + 1
    return out


def _positions_by_date(long: pd.DataFrame) -> pd.DataFrame:
    """Posicao na tabela imediatamente antes de cada partida.

    Snapshot por data: usa o ultimo estado conhecido de cada time (pontos,
    saldo, gols) e ordena. Times ainda sem partida na temporada ficam de fora.
    """
    states = long[
        ["season", "date", "team", "season_pts_pre", "season_gf_pre", "season_gd_pre"]
    ].copy()

    records = []
    for season, s in states.groupby("season", sort=True):
        latest: dict[str, tuple[float, float, float]] = {}
        for date, day in s.groupby("date", sort=True):
            for row in day.itertuples(index=False):
                latest[row.team] = (row.season_pts_pre, row.season_gd_pre, row.season_gf_pre)
            ranking = sorted(
                latest.items(), key=lambda kv: (-kv[1][0], -kv[1][1], -kv[1][2])
            )
            for position, (team, _) in enumerate(ranking, start=1):
                records.append((season, date, team, position))

    return pd.DataFrame(records, columns=["season", "date", "team", "position"])


def _previous_season_positions(df: pd.DataFrame) -> pd.DataFrame:
    """Posicao final do time na temporada imediatamente anterior.

    Se o time nao disputou a Serie A na temporada anterior (acesso depois de um
    ano fora), a informacao fica ausente e o imputer preenche a mediana.

    A tabela final da temporada S so pode ser usada a partir da temporada S+1.
    Por isso o deslocamento de +1: a coluna ``season`` aqui e a temporada em que
    a informacao passa a ser conhecida (e nao a temporada da tabela).
    """
    finals = []
    for season in sorted(df["season"].unique()):
        table = season_table(df, season)
        table["season"] = season + 1  # conhecida a partir da temporada seguinte
        finals.append(table[["season", "team", "position"]])
    finals_df = pd.concat(finals, ignore_index=True)

    return finals_df.rename(columns={"position": "prev_position"})


# ---------------------------------------------------------------------------
# Montagem da tabela de features
# ---------------------------------------------------------------------------
def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Tabela final: uma linha por partida, com meta-dados + FEATURES."""
    long = _add_rolling(_long_format(df))
    timeline, _ = elo_timeline(df)
    positions = _positions_by_date(long)
    prev_pos = _previous_season_positions(df)

    team_cols = {
        "form5_ppg": "form5_ppg",
        "form5_gf": "form5_gf",
        "form5_ga": "form5_ga",
        "form10_ppg": "form10_ppg",
        "rest_days": "rest",
        "position": "pos",
        "matchday": "matchday",
    }

    long = long.merge(positions, on=["season", "date", "team"], how="left")
    long = long.merge(prev_pos, on=["team", "season"], how="left")

    long["season_ppg"] = long["season_pts_pre"] / long["season_games_pre"].replace(0, np.nan)
    long["season_gdpg"] = long["season_gd_pre"] / long["season_games_pre"].replace(0, np.nan)

    # Time estreante na Serie A dentro da base (nao jogou na temporada anterior).
    seasons_played = long.groupby("team")["season"].agg(set)
    long["promoted"] = [
        int(season > min(seasons_played[team]) and (season - 1) not in seasons_played[team])
        for team, season in zip(long["team"], long["season"])
    ]

    def _side_frame(is_home: int, suffix: str) -> pd.DataFrame:
        side = long[long["is_home"] == is_home]
        cols = {
            "match_id": "match_id",
            "form5_ppg": f"form5_ppg_{suffix}",
            "form5_gf": f"form5_gf_{suffix}",
            "form5_ga": f"form5_ga_{suffix}",
            "form10_ppg": f"form10_ppg_{suffix}",
            "season_ppg": f"season_ppg_{suffix}",
            "season_gdpg": f"season_gdpg_{suffix}",
            "position": f"pos_{suffix}",
            "prev_position": f"prev_pos_{suffix}",
            "rest_days": f"rest_{suffix}",
            "promoted": f"promoted_{suffix}",
            "matchday": "matchday",
        }
        return side[list(cols)].rename(columns=cols)

    home = _side_frame(1, "home")
    away = _side_frame(0, "away")

    feat = (
        df.merge(home, on="match_id", how="left")
        .merge(away, on="match_id", how="left", suffixes=("", "_dup"))
        .merge(timeline, on="match_id", how="left")
    )

    feat["elo_diff"] = feat["elo_home"] - feat["elo_away"]
    feat["elo_home_adv"] = feat["elo_home"] + HOME_ADV_ELO - feat["elo_away"]
    feat["form5_ppg_diff"] = feat["form5_ppg_home"] - feat["form5_ppg_away"]
    feat["form10_ppg_diff"] = feat["form10_ppg_home"] - feat["form10_ppg_away"]
    feat["season_ppg_diff"] = feat["season_ppg_home"] - feat["season_ppg_away"]
    feat["pos_diff"] = feat["pos_home"] - feat["pos_away"]
    feat["rest_diff"] = feat["rest_home"] - feat["rest_away"]
    # Ataque da casa contra a defesa de fora, e vice-versa.
    feat["form5_attack_diff"] = feat["form5_gf_home"] - feat["form5_ga_away"]
    feat["form5_defense_diff"] = feat["form5_ga_home"] - feat["form5_gf_away"]

    feat = feat.sort_values(["date", "match_id"]).reset_index(drop=True)
    keep = [c for c in META_COLUMNS if c in feat.columns] + FEATURES
    return feat[keep]


# ---------------------------------------------------------------------------
# Estado atual dos times (para prever partidas futuras no dashboard)
# ---------------------------------------------------------------------------
@dataclass
class TeamState:
    team: str
    elo: float
    form5_ppg: float
    form5_gf: float
    form5_ga: float
    form10_ppg: float
    season_ppg: float
    season_gdpg: float
    position: float
    prev_position: float
    last_date: pd.Timestamp
    played: int
    promoted: int
    points: int = 0
    goal_diff: int = 0
    goals_for: int = 0


def latest_states(df: pd.DataFrame) -> dict[str, TeamState]:
    """Estado 'antes da proxima partida' de cada time da temporada corrente."""
    season = int(df["season"].max())
    current = df[df["season"] == season]
    long = _add_rolling(_long_format(df))
    _, ratings = elo_timeline(df)
    table = season_table(df, season).set_index("team")

    prev_season = season - 1
    prev_table = (
        season_table(df, prev_season).set_index("team")["position"]
        if prev_season in set(df["season"])
        else pd.Series(dtype=float)
    )

    states: dict[str, TeamState] = {}
    for team in sorted(set(current["home"]) | set(current["away"])):
        hist = long[long["team"] == team]
        last_season = hist[hist["season"] == season]
        row = table.loc[team]
        states[team] = TeamState(
            team=team,
            elo=float(ratings.get(team, ELO_START)),
            form5_ppg=float(last_season["points"].tail(5).mean()),
            form5_gf=float(last_season["gf"].tail(5).mean()),
            form5_ga=float(last_season["ga"].tail(5).mean()),
            form10_ppg=float(last_season["points"].tail(10).mean()),
            season_ppg=float(row["points"] / max(row["played"], 1)),
            season_gdpg=float(row["goal_diff"] / max(row["played"], 1)),
            position=float(row["position"]),
            prev_position=float(prev_table.get(team, np.nan)),
            last_date=pd.Timestamp(hist["date"].max()),
            played=int(row["played"]),
            promoted=int(prev_season not in set(hist["season"]) and season > hist["season"].min()),
            points=int(row["points"]),
            goal_diff=int(row["goal_diff"]),
            goals_for=int(row["goals_for"]),
        )
    return states


def match_features(
    home: TeamState,
    away: TeamState,
    *,
    matchday: int,
    sim_date: pd.Timestamp,
) -> dict[str, float]:
    """Monta o vetor de features de um confronto hipotetico (proxima partida)."""
    rest_home = float(np.clip((sim_date - home.last_date).days, 0, 60))
    rest_away = float(np.clip((sim_date - away.last_date).days, 0, 60))

    feats = {
        "elo_home": home.elo,
        "elo_away": away.elo,
        "elo_diff": home.elo - away.elo,
        "elo_home_adv": home.elo + HOME_ADV_ELO - away.elo,
        "form5_ppg_home": home.form5_ppg,
        "form5_ppg_away": away.form5_ppg,
        "form5_ppg_diff": home.form5_ppg - away.form5_ppg,
        "form5_gf_home": home.form5_gf,
        "form5_gf_away": away.form5_gf,
        "form5_ga_home": home.form5_ga,
        "form5_ga_away": away.form5_ga,
        "form5_attack_diff": home.form5_gf - away.form5_ga,
        "form5_defense_diff": home.form5_ga - away.form5_gf,
        "form10_ppg_home": home.form10_ppg,
        "form10_ppg_away": away.form10_ppg,
        "form10_ppg_diff": home.form10_ppg - away.form10_ppg,
        "season_ppg_home": home.season_ppg,
        "season_ppg_away": away.season_ppg,
        "season_ppg_diff": home.season_ppg - away.season_ppg,
        "season_gdpg_home": home.season_gdpg,
        "season_gdpg_away": away.season_gdpg,
        "pos_home": home.position,
        "pos_away": away.position,
        "pos_diff": home.position - away.position,
        "prev_pos_home": home.prev_position,
        "prev_pos_away": away.prev_position,
        "rest_home": rest_home,
        "rest_away": rest_away,
        "rest_diff": rest_home - rest_away,
        "promoted_home": home.promoted,
        "promoted_away": away.promoted,
        "matchday": matchday,
    }
    return feats
