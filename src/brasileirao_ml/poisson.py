"""Modelo de gols (Poisson) e simulacao Monte Carlo do campeonato.

Ideia: cada time tem uma "forca liquida" s. Os gols esperados sao

    lambda_casa   = exp(mu + adv + s_casa - s_fora)
    lambda_fora   = exp(mu - adv + s_fora - s_casa)

Isso e a versao simples do modelo de Maher (1982), estimada por regressao
Poisson com peso exponencial no tempo (partidas antigas pesam menos).
"""

from __future__ import annotations

from dataclasses import dataclass
from math import lgamma

import numpy as np
import pandas as pd
from sklearn.linear_model import PoissonRegressor

from .config import FIRST_TEST_SEASON
from .evaluate import stack_predictions

MAX_GOALS = 10


@dataclass
class PoissonModel:
    teams: list[str]
    strength: dict[str, float]
    mu: float
    home_adv: float
    ref_date: pd.Timestamp | None = None
    alpha: float = 1.0
    half_life_days: float = 540.0

    # -- previsao ---------------------------------------------------------
    def expected_goals(self, home: str, away: str) -> tuple[float, float]:
        s_home = self.strength.get(home, 0.0)
        s_away = self.strength.get(away, 0.0)
        lam_home = np.exp(self.mu + self.home_adv + s_home - s_away)
        lam_away = np.exp(self.mu - self.home_adv + s_away - s_home)
        return float(lam_home), float(lam_away)

    def score_matrix(self, home: str, away: str, max_goals: int = MAX_GOALS) -> np.ndarray:
        lam_home, lam_away = self.expected_goals(home, away)
        goals = np.arange(max_goals + 1)
        p_home = _poisson_pmf(goals, lam_home)
        p_away = _poisson_pmf(goals, lam_away)
        matrix = np.outer(p_home, p_away)
        return matrix / matrix.sum()

    def outcome_probs(self, home: str, away: str) -> np.ndarray:
        matrix = self.score_matrix(home, away)
        p_home = float(np.tril(matrix, -1).sum())
        p_draw = float(np.trace(matrix))
        p_away = float(np.triu(matrix, 1).sum())
        return np.array([p_home, p_draw, p_away])

    # -- persistencia -----------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "teams": self.teams,
            "strength": self.strength,
            "mu": self.mu,
            "home_adv": self.home_adv,
            "ref_date": None if self.ref_date is None else str(self.ref_date.date()),
            "alpha": self.alpha,
            "half_life_days": self.half_life_days,
        }

    @classmethod
    def from_dict(cls, payload: dict) -> "PoissonModel":
        ref = payload.get("ref_date")
        return cls(
            teams=list(payload["teams"]),
            strength={k: float(v) for k, v in payload["strength"].items()},
            mu=float(payload["mu"]),
            home_adv=float(payload["home_adv"]),
            ref_date=None if ref is None else pd.Timestamp(ref),
            alpha=float(payload.get("alpha", 1.0)),
            half_life_days=float(payload.get("half_life_days", 540.0)),
        )


def _poisson_pmf(k: np.ndarray, lam: float) -> np.ndarray:
    k = np.asarray(k, dtype=float)
    log_pmf = -lam + k * np.log(lam) - np.array([lgamma(v + 1) for v in k])
    return np.exp(log_pmf)


def fit_poisson(
    df: pd.DataFrame,
    ref_date: pd.Timestamp | None = None,
    *,
    alpha: float = 1.0,
    half_life_days: float = 540.0,
) -> PoissonModel:
    """Ajusta as forcas dos times com todas as partidas ``df`` (ja filtradas)."""
    if ref_date is None:
        ref_date = pd.Timestamp(df["date"].max())

    teams = sorted(set(df["home"]) | set(df["away"]))
    index = {team: i for i, team in enumerate(teams)}
    n = len(df)

    x = np.zeros((2 * n, len(teams) + 1))
    rows = np.arange(n)

    # linha de casa: +1 para o time da casa, -1 para o visitante, adv = +1
    x[rows, 0] = 1.0
    x[rows, 1 + df["home"].map(index).to_numpy()] = 1.0
    x[rows, 1 + df["away"].map(index).to_numpy()] = -1.0

    # linha de fora: +1 para o visitante, -1 para o mandante, adv = -1
    x[n + rows, 0] = -1.0
    x[n + rows, 1 + df["away"].map(index).to_numpy()] = 1.0
    x[n + rows, 1 + df["home"].map(index).to_numpy()] = -1.0

    y = np.concatenate([df["goals_home"].to_numpy(float), df["goals_away"].to_numpy(float)])

    days = (ref_date - df["date"]).dt.days.to_numpy(float)
    weight = 0.5 ** (days / half_life_days)
    sample_weight = np.concatenate([weight, weight])

    reg = PoissonRegressor(alpha=alpha, max_iter=1000, tol=1e-6)
    reg.fit(x, y, sample_weight=sample_weight)

    return PoissonModel(
        teams=teams,
        strength={team: float(reg.coef_[1 + i]) for team, i in index.items()},
        mu=float(reg.intercept_),
        home_adv=float(reg.coef_[0]),
        ref_date=pd.Timestamp(ref_date),
        alpha=alpha,
        half_life_days=half_life_days,
    )


def walk_forward_poisson(
    features: pd.DataFrame, first_test_season: int = FIRST_TEST_SEASON
) -> pd.DataFrame:
    """Previsoes do Poisson no mesmo esquema walk-forward dos demais modelos."""
    seasons = sorted(s for s in features["season"].unique() if s >= first_test_season)
    chunks = []
    for season in seasons:
        train = features[features["season"] < season]
        test = features[features["season"] == season]
        model = fit_poisson(train, ref_date=train["date"].max())

        proba = np.vstack(
            [model.outcome_probs(h, a) for h, a in zip(test["home"], test["away"])]
        )
        chunks.append(stack_predictions(test, "Poisson (gols)", proba))
    return pd.concat(chunks, ignore_index=True)


def remaining_fixtures(df: pd.DataFrame, season: int | None = None) -> pd.DataFrame:
    """Jogos que ainda faltam na temporada (complemento do turno/returno)."""
    season = season if season is not None else int(df["season"].max())
    s = df[df["season"] == season]
    teams = sorted(set(s["home"]) | set(s["away"]))

    played = set(zip(s["home"], s["away"]))
    fixtures = [(h, a) for h in teams for a in teams if h != a and (h, a) not in played]
    return pd.DataFrame(fixtures, columns=["home", "away"])


def simulate_season(
    model: PoissonModel,
    table: pd.DataFrame,
    fixtures: pd.DataFrame,
    *,
    n_sims: int = 10_000,
    seed: int = 42,
) -> pd.DataFrame:
    """Monte Carlo da tabela final a partir da classificacao atual.

    Retorna, por time: pontos medios, intervalo de 90%, posicao media e
    probabilidades de titulo, G4 e rebaixamento.
    """
    rng = np.random.default_rng(seed)
    teams = list(table["team"])
    index = {team: i for i, team in enumerate(teams)}
    n_teams, n_games = len(teams), len(fixtures)

    home_idx = fixtures["home"].map(index).to_numpy()
    away_idx = fixtures["away"].map(index).to_numpy()

    lam_home = np.array([model.expected_goals(h, a)[0] for h, a in zip(fixtures["home"], fixtures["away"])])
    lam_away = np.array([model.expected_goals(h, a)[1] for h, a in zip(fixtures["home"], fixtures["away"])])

    goals_home = rng.poisson(lam_home, size=(n_sims, n_games))
    goals_away = rng.poisson(lam_away, size=(n_sims, n_games))

    pts_home = np.where(goals_home > goals_away, 3, np.where(goals_home == goals_away, 1, 0))
    pts_away = np.where(goals_away > goals_home, 3, np.where(goals_home == goals_away, 1, 0))

    base_pts = table.set_index("team").loc[teams, "points"].to_numpy(float)
    base_gd = table.set_index("team").loc[teams, "goal_diff"].to_numpy(float)
    base_gf = table.set_index("team").loc[teams, "goals_for"].to_numpy(float)

    add_pts = np.zeros((n_sims, n_teams))
    add_gf = np.zeros((n_sims, n_teams))
    add_ga = np.zeros((n_sims, n_teams))
    np.add.at(add_pts.T, home_idx, pts_home.T)
    np.add.at(add_pts.T, away_idx, pts_away.T)
    np.add.at(add_gf.T, home_idx, goals_home.T)
    np.add.at(add_gf.T, away_idx, goals_away.T)
    np.add.at(add_ga.T, home_idx, goals_away.T)
    np.add.at(add_ga.T, away_idx, goals_home.T)

    final_pts = base_pts[None, :] + add_pts
    final_gd = base_gd[None, :] + add_gf - add_ga
    final_gf = base_gf[None, :] + add_gf

    positions = _positions(final_pts, final_gd, final_gf)

    last_season = int(table["team"].shape[0])
    out = pd.DataFrame(
        {
            "team": teams,
            "position_now": table["position"].to_numpy(),
            "points_now": base_pts.astype(int),
            "points_mean": final_pts.mean(axis=0),
            "points_p5": np.percentile(final_pts, 5, axis=0),
            "points_p95": np.percentile(final_pts, 95, axis=0),
            "position_mean": positions.mean(axis=0),
            "prob_title": (positions == 1).mean(axis=0),
            "prob_top4": (positions <= 4).mean(axis=0),
            "prob_relegation": (positions > last_season - 4).mean(axis=0),
        }
    )
    return out.sort_values(
        ["position_mean", "points_mean"], ascending=True
    ).reset_index(drop=True)


def _positions(points: np.ndarray, gd: np.ndarray, gf: np.ndarray) -> np.ndarray:
    """Posicao final por simulacao, com desempate por saldo e gols pro."""
    n_sims, n_teams = points.shape
    # comeca com a ordem "identidade" (0..n_teams-1) em cada simulacao
    order = np.tile(np.arange(n_teams), (n_sims, 1))

    # ordenacoes estaveis sucessivas => ordenacao lexicografica
    order = np.take_along_axis(
        order, np.argsort(-np.take_along_axis(gf, order, 1), axis=1, kind="stable"), 1
    )
    order = np.take_along_axis(
        order, np.argsort(-np.take_along_axis(gd, order, 1), axis=1, kind="stable"), 1
    )
    order = np.take_along_axis(
        order, np.argsort(-np.take_along_axis(points, order, 1), axis=1, kind="stable"), 1
    )
    # order[:, 0] = indice do 1o colocado; inverter vira posicao por time
    ranks = np.argsort(order, axis=1) + 1
    return ranks.astype(float)
