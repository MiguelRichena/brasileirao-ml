"""Testes de causalidade das features (o projeto ja teve um vazamento real).

A regra e simples: a feature de um jogo so pode depender de partidas ANTERIORES.
O teste forte e o de truncamento: se eu cortar o dataset no fim de 2020 e
recalcular tudo, as features de todos os jogos ate 2020 devem ser identicas.
Qualquer uso de informacao futura (tabela final, Elo, medias) quebra o teste.
"""

from __future__ import annotations

import pandas as pd
import pytest

from brasileirao_ml.data import load_matches, season_table
from brasileirao_ml.features import FEATURES, build_features


@pytest.fixture(scope="module")
def matches() -> pd.DataFrame:
    return load_matches()


@pytest.fixture(scope="module")
def features(matches: pd.DataFrame) -> pd.DataFrame:
    return build_features(matches)


def test_features_nao_usam_futuro(matches: pd.DataFrame, features: pd.DataFrame) -> None:
    """Features calculadas com dados truncados == features do dataset completo."""
    cutoff = 2020
    truncated = build_features(matches[matches["season"] <= cutoff])

    merged = truncated[["match_id", "season"] + FEATURES].merge(
        features[["match_id"] + FEATURES],
        on="match_id",
        suffixes=("_trunc", "_full"),
    )
    assert len(merged) == len(truncated)

    for column in FEATURES:
        left = merged[f"{column}_trunc"]
        right = merged[f"{column}_full"]
        # Compara tratando NaN == NaN (features de estreia, por exemplo).
        mismatch = ~((left == right) | (left.isna() & right.isna()))
        assert not mismatch.any(), (
            f"feature '{column}' muda quando o futuro e removido "
            f"({int(mismatch.sum())} linhas). Isso indica vazamento."
        )


def test_features_nao_usam_futuro_dentro_da_temporada(
    matches: pd.DataFrame, features: pd.DataFrame
) -> None:
    """Corte no meio de 2020: features dos jogos anteriores nao podem mudar.

    Este e o teste que pega o vazamento original: a posicao da temporada
    anterior era calculada com a tabela FINAL da temporada corrente.
    """
    cutoff = pd.Timestamp("2020-08-31")
    truncated = build_features(matches[matches["date"] <= cutoff])

    merged = truncated[["match_id", "season"] + FEATURES].merge(
        features[["match_id"] + FEATURES],
        on="match_id",
        suffixes=("_trunc", "_full"),
    )
    assert len(merged) == len(truncated)

    for column in FEATURES:
        left = merged[f"{column}_trunc"]
        right = merged[f"{column}_full"]
        mismatch = ~((left == right) | (left.isna() & right.isna()))
        assert not mismatch.any(), (
            f"feature '{column}' muda quando o futuro da temporada e removido "
            f"({int(mismatch.sum())} linhas). Isso indica vazamento."
        )


def test_prev_pos_usa_temporada_anterior(matches: pd.DataFrame, features: pd.DataFrame) -> None:
    """A posicao previa de 2024 deve ser a posicao final de 2023, nunca a de 2024."""
    team, season = "Palmeiras", 2024
    rows = features[(features["season"] == season) & (features["home"] == team)]
    assert not rows.empty

    prev_feature = rows["prev_pos_home"].iloc[0]
    expected = season_table(matches, season - 1).set_index("team").loc[team, "position"]
    same_season_final = season_table(matches, season).set_index("team").loc[team, "position"]

    assert prev_feature == pytest.approx(expected)
    # Guarda contra a regressao especifica que existia no projeto.
    assert prev_feature != pytest.approx(same_season_final)


def test_posicao_na_tabela_existe_para_todo_jogo(features: pd.DataFrame) -> None:
    """Todo jogo tem posicao pre-jogo valida (mesmo na estreia, com 0 ponto)."""
    assert features["pos_home"].notna().all()
    assert features["pos_away"].notna().all()
    assert features["pos_home"].between(1, 20).all()
    assert features["pos_away"].between(1, 20).all()


def test_elo_de_estreia_e_o_valor_inicial(features: pd.DataFrame) -> None:
    """O primeiro jogo de qualquer time na base comeca com Elo 1500."""
    home = features[["date", "home", "elo_home"]].rename(
        columns={"home": "team", "elo_home": "elo"}
    )
    away = features[["date", "away", "elo_away"]].rename(
        columns={"away": "team", "elo_away": "elo"}
    )
    long = pd.concat([home, away]).sort_values(["team", "date"])
    debut = long.drop_duplicates(subset="team", keep="first")

    assert len(debut) > 30
    assert (debut["elo"] == 1500.0).all()
