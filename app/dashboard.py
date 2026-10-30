"""Dashboard interativo do Brasileirao ML (Streamlit).

Abas:
  1. Simulador de partida  -> probabilidades 1X2, gols esperados e placares provaveis
  2. Tabela simulada       -> Monte Carlo do restante da temporada (10 mil cenarios)
  3. Desempenho            -> metricas walk-forward, backtest e figuras
  4. Explorador de times   -> Elo, forma, posicao e ultimos jogos

Uso:
    streamlit run app/dashboard.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from brasileirao_ml.config import (  # noqa: E402
    FEATURES_FILE,
    FIGURES,
    METRICS_FILE,
    MODEL_FILE,
    PREDICTIONS_FILE,
    REPORTS,
    SIM_FILE,
)
from brasileirao_ml.data import load_matches  # noqa: E402
from brasileirao_ml.features import latest_states, match_features  # noqa: E402
from brasileirao_ml.poisson import PoissonModel  # noqa: E402

st.set_page_config(
    page_title="Brasileirão ML",
    page_icon="⚽",
    layout="wide",
    initial_sidebar_state="expanded",
)

CLASS_LABELS = {"H": "Casa", "D": "Empate", "A": "Fora"}
MODEL_ORDER = ["Blend LogReg + HGB", "LogReg", "HistGradientBoosting"]
PRETTY = {
    "Mercado (média)": "Mercado (média)",
    "LogReg (só Elo)": "LogReg (só Elo)",
    "Blend LogReg + HGB": "Blend LogReg + HGB",
    "HistGradientBoosting": "HistGradientBoosting",
    "Frequência do treino": "Frequência do treino",
    "Poisson (gols)": "Poisson (gols)",
}


# ---------------------------------------------------------------------------
# Carregamento (com cache)
# ---------------------------------------------------------------------------
@st.cache_resource(show_spinner=False)
def load_artifacts() -> dict:
    return joblib.load(MODEL_FILE)


@st.cache_data(show_spinner=False)
def load_matches_cached() -> pd.DataFrame:
    return load_matches()


@st.cache_data(show_spinner=False)
def load_features_cached() -> pd.DataFrame:
    return pd.read_csv(FEATURES_FILE, parse_dates=["date"])


@st.cache_data(show_spinner=False)
def load_simulation_cached() -> pd.DataFrame:
    return pd.read_csv(SIM_FILE)


@st.cache_data(show_spinner=False)
def load_states() -> dict:
    return latest_states(load_matches_cached())


@st.cache_data(show_spinner=False)
def load_run_info() -> dict:
    path = REPORTS / "run_info.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


@st.cache_data(show_spinner=False)
def load_csv(name: str) -> pd.DataFrame:
    path = REPORTS / name
    return pd.read_csv(path) if path.exists() else pd.DataFrame()


# ---------------------------------------------------------------------------
# Helpers de previsao
# ---------------------------------------------------------------------------
def predict_sklearn(artifacts: dict, feats: dict) -> dict[str, np.ndarray]:
    """Probabilidades [H, D, A] de cada modelo sklearn salvo no joblib."""
    columns = artifacts["features"]
    classes = list(artifacts["classes"])
    X = pd.DataFrame([feats], columns=columns)

    out: dict[str, np.ndarray] = {}
    for name, model in artifacts["models"].items():
        raw = model.predict_proba(X)[0]
        order = [list(model.classes_).index(c) for c in classes]
        out[name] = raw[order]
    return out


def poisson_model(artifacts: dict) -> PoissonModel:
    return PoissonModel.from_dict(artifacts["poisson"])


def pretty_model(name: str) -> str:
    return PRETTY.get(name, name)


def pct(value: float) -> str:
    return f"{value:.1%}"


def fixture_features(states: dict, home: str, away: str, date: pd.Timestamp) -> tuple[dict, int]:
    home_state, away_state = states[home], states[away]
    matchday = max(home_state.played, away_state.played) + 1
    feats = match_features(home_state, away_state, matchday=matchday, sim_date=date)
    return feats, matchday


def _swap_sides() -> None:
    """Callback do botao 'inverter': roda antes do rerun, entao pode alterar o widget."""
    st.session_state["sim_home"], st.session_state["sim_away"] = (
        st.session_state["sim_away"],
        st.session_state["sim_home"],
    )


# ---------------------------------------------------------------------------
# Aba 1: simulador de partida
# ---------------------------------------------------------------------------
def tab_simulador(artifacts: dict, states: dict) -> None:
    teams = sorted(states)
    default_home = teams.index("Flamengo") if "Flamengo" in teams else 0
    default_away = teams.index("Palmeiras") if "Palmeiras" in teams else 1

    left, middle, right = st.columns([3, 1, 3])
    with left:
        home = st.selectbox("Mandante", teams, index=default_home, key="sim_home")
    with right:
        away = st.selectbox("Visitante", teams, index=default_away, key="sim_away")
    with middle:
        st.markdown("<div style='height: 28px'></div>", unsafe_allow_html=True)
        st.button(
            "⇄ inverter",
            width="stretch",
            on_click=_swap_sides,
            help="Troca o mando de campo.",
        )

    if home == away:
        st.warning("Escolha dois times diferentes.")
        return

    with st.expander("Contexto do confronto", expanded=False):
        base_date = max(states[home].last_date, states[away].last_date)
        match_date = st.date_input(
            "Data do jogo",
            value=(base_date + pd.Timedelta(days=4)).date(),
            help="Usada para calcular os dias de descanso dos dois times.",
        )
        match_date = pd.Timestamp(match_date)

    feats, matchday = fixture_features(states, home, away, match_date)
    sklearn_probs = predict_sklearn(artifacts, feats)
    pm = poisson_model(artifacts)
    poisson_probs = pm.outcome_probs(home, away)

    all_probs = {pretty_model(k): v for k, v in sklearn_probs.items()}
    all_probs["Poisson (gols)"] = poisson_probs

    st.markdown(f"### {home} × {away}")
    st.caption(
        f"Rodada aproximada {matchday} · {match_date:%d/%m/%Y} · "
        f"{states[home].played} e {states[away].played} jogos disputados na temporada"
    )

    headline = st.radio(
        "Modelo em destaque",
        ["Blend LogReg + HGB", "LogReg", "HistGradientBoosting", "Poisson (gols)"],
        horizontal=True,
        label_visibility="collapsed",
    )
    probs = all_probs[headline]

    c1, c2, c3 = st.columns(3)
    c1.metric(f"Vitória {home}", pct(probs[0]))
    c2.metric("Empate", pct(probs[1]))
    c3.metric(f"Vitória {away}", pct(probs[2]))

    chart = pd.DataFrame(
        {"Probabilidade (%)": [probs[0] * 100, probs[1] * 100, probs[2] * 100]},
        index=[f"Casa ({home})", "Empate", f"Fora ({away})"],
    )
    st.bar_chart(chart, horizontal=True, height=180, color="#0f766e")

    st.markdown("#### Comparação entre modelos")
    table = pd.DataFrame(
        {
            "Modelo": list(all_probs),
            "Casa": [p[0] for p in all_probs.values()],
            "Empate": [p[1] for p in all_probs.values()],
            "Fora": [p[2] for p in all_probs.values()],
        }
    ).set_index("Modelo")
    st.dataframe(
        table.style.format("{:.1%}").background_gradient(cmap="Greens", axis=None),
        width="stretch",
    )

    st.markdown("#### Gols esperados e placares prováveis (Poisson)")
    lam_home, lam_away = pm.expected_goals(home, away)
    g1, g2, g3 = st.columns(3)
    g1.metric("Gols esperados", f"{lam_home:.2f} × {lam_away:.2f}")
    g2.metric("Total esperado", f"{lam_home + lam_away:.2f}")
    g3.metric("Força líquida (Poisson)", f"{pm.strength.get(home, 0):+.2f} vs {pm.strength.get(away, 0):+.2f}")

    matrix = pm.score_matrix(home, away)
    scores = [
        {
            "Placar": f"{i}–{j}",
            "Probabilidade": matrix[i, j],
            "Resultado": "Casa" if i > j else ("Empate" if i == j else "Fora"),
        }
        for i in range(7)
        for j in range(7)
    ]
    score_table = (
        pd.DataFrame(scores).sort_values("Probabilidade", ascending=False).head(8).reset_index(drop=True)
    )
    score_table.index += 1
    st.dataframe(
        score_table.style.format({"Probabilidade": "{:.1%}"}).background_gradient(
            subset=["Probabilidade"], cmap="Blues"
        ),
        width="stretch",
    )
    st.caption(
        "O Poisson usa a força líquida de cada time estimada com todas as partidas da base, "
        "com peso exponencial no tempo (half-life de 540 dias)."
    )


# ---------------------------------------------------------------------------
# Aba 2: tabela simulada
# ---------------------------------------------------------------------------
def tab_tabela(sim: pd.DataFrame, info: dict) -> None:
    if sim.empty:
        st.info("Rode `python scripts/train.py` para gerar a simulação.")
        return

    season = info.get("temporadas", [None, None])[1]
    n_sims = info.get("simulacoes", 10_000)
    n_games = info.get("jogos_restantes", 0)

    st.markdown(f"### Projeção final — temporada {season}")
    st.caption(
        f"{n_sims:,} simulações Monte Carlo dos {n_games} jogos restantes, "
        "com desempate por saldo de gols e gols pró. A simulação usa o modelo de gols (Poisson)."
    )

    leader = sim.sort_values("prob_title", ascending=False).iloc[0]
    top4 = sim.sort_values("prob_top4", ascending=False).iloc[0]
    drop = sim.sort_values("prob_relegation", ascending=False).iloc[0]

    c1, c2, c3 = st.columns(3)
    c1.metric(f"Favorito ao título — {leader.team}", pct(leader.prob_title))
    c2.metric(f"Mais perto do G4 — {top4.team}", pct(top4.prob_top4))
    c3.metric(f"Maior risco de queda — {drop.team}", pct(drop.prob_relegation))

    view = sim.copy()
    view["Faixa de pontos (90%)"] = view.apply(
        lambda r: f"{r.points_p5:.0f}–{r.points_p95:.0f}", axis=1
    )
    view["Título (%)"] = view["prob_title"] * 100
    view["G4 (%)"] = view["prob_top4"] * 100
    view["Queda (%)"] = view["prob_relegation"] * 100

    display = view[
        [
            "team",
            "position_now",
            "points_now",
            "points_mean",
            "Faixa de pontos (90%)",
            "position_mean",
            "Título (%)",
            "G4 (%)",
            "Queda (%)",
        ]
    ].rename(
        columns={
            "team": "Time",
            "position_now": "Pos. atual",
            "points_now": "Pts atuais",
            "points_mean": "Pts projetados",
            "position_mean": "Pos. média",
        }
    )

    st.dataframe(
        display,
        width="stretch",
        hide_index=True,
        column_config={
            "Pts projetados": st.column_config.NumberColumn(format="%.1f"),
            "Pos. média": st.column_config.NumberColumn(format="%.1f"),
            "Título (%)": st.column_config.ProgressColumn(
                min_value=0, max_value=100, format="%.1f%%"
            ),
            "G4 (%)": st.column_config.ProgressColumn(
                min_value=0, max_value=100, format="%.1f%%"
            ),
            "Queda (%)": st.column_config.ProgressColumn(
                min_value=0, max_value=100, format="%.1f%%"
            ),
        },
    )

    st.markdown("#### Distribuição das probabilidades")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**Chance de título**")
        title = sim.sort_values("prob_title", ascending=False).head(8)
        st.bar_chart(
            title.set_index("team")["prob_title"] * 100,
            horizontal=True,
            height=280,
            color="#0f766e",
        )
    with col2:
        st.markdown("**Risco de rebaixamento**")
        releg = sim.sort_values("prob_relegation", ascending=False).head(8)
        st.bar_chart(
            releg.set_index("team")["prob_relegation"] * 100,
            horizontal=True,
            height=280,
            color="#b91c1c",
        )

    st.markdown("#### Projeção de pontos (média e intervalo de 90%)")
    points = sim.sort_values("points_mean", ascending=False)[
        ["team", "points_now", "points_mean", "points_p5", "points_p95"]
    ].rename(
        columns={
            "team": "Time",
            "points_now": "Pts atuais",
            "points_mean": "Média",
            "points_p5": "P5",
            "points_p95": "P95",
        }
    )
    st.dataframe(
        points.style.format({"Média": "{:.1f}", "P5": "{:.0f}", "P95": "{:.0f}"}),
        width="stretch",
        hide_index=True,
    )
    st.caption(
        "Leitura: 'P5–P95' é a faixa central em 90% dos cenários. "
        "O modelo não sabe de lesões, mudanças de técnico ou decisões judiciais."
    )


# ---------------------------------------------------------------------------
# Aba 3: desempenho
# ---------------------------------------------------------------------------
def tab_desempenho() -> None:
    st.markdown("### Desempenho out-of-fold (walk-forward)")
    st.caption(
        "Para cada temporada, o modelo treina apenas com o passado e prevê a temporada inteira. "
        "O mercado é a média das odds de fechamento (sem margem)."
    )

    metrics = load_csv(METRICS_FILE.name)
    if not metrics.empty:
        view = metrics.copy()
        view["Acurácia"] = view["accuracy"] * 100
        view = view.rename(
            columns={
                "rank": "#",
                "model": "Modelo",
                "n": "Jogos",
                "log_loss": "Log loss",
                "brier": "Brier",
                "rps": "RPS",
            }
        )[["#", "Modelo", "Jogos", "Acurácia", "Log loss", "Brier", "RPS"]]
        st.dataframe(
            view.style.format(
                {"Acurácia": "{:.1f}%", "Log loss": "{:.4f}", "Brier": "{:.4f}", "RPS": "{:.4f}"}
            ).highlight_min(subset=["Log loss", "Brier", "RPS"], color="#d1fae5"),
            width="stretch",
            hide_index=True,
        )
        st.caption(
            "Log loss, Brier e RPS: menor é melhor. O mercado vence todos os modelos — "
            "e a diferença é estatisticamente significativa (veja o backtest abaixo)."
        )

    summary = load_csv("backtest_summary.csv")
    if not summary.empty:
        st.markdown("#### Backtest: modelo vs mercado")
        show = summary.copy()
        show["delta"] = show["modelo_log_loss"] - show["mercado_log_loss"]
        show = show.rename(
            columns={
                "mercado": "Benchmark",
                "n": "Jogos",
                "modelo_log_loss": "Modelo",
                "mercado_log_loss": "Mercado",
                "delta": "Diferença",
                "modelo_acc": "Acurácia modelo",
                "mercado_acc": "Acurácia mercado",
            }
        )[["Benchmark", "Jogos", "Modelo", "Mercado", "Diferença", "Acurácia modelo", "Acurácia mercado"]]
        st.dataframe(
            show.style.format(
                {
                    "Modelo": "{:.4f}",
                    "Mercado": "{:.4f}",
                    "Diferença": "{:+.4f}",
                    "Acurácia modelo": "{:.1%}",
                    "Acurácia mercado": "{:.1%}",
                }
            ),
            width="stretch",
            hide_index=True,
        )

    boot = load_csv("backtest_bootstrap.csv")
    if not boot.empty:
        st.markdown("#### A diferença é real? (bootstrap pareado)")
        b = boot.copy()
        b["Veredito"] = np.where(b["significativo"], "significativa", "dentro do ruído")
        b = b.rename(
            columns={
                "mercado": "Benchmark",
                "n": "Jogos",
                "delta_log_loss": "Δ log loss",
                "ic95_lo": "IC 95% inferior",
                "ic95_hi": "IC 95% superior",
            }
        )[["Benchmark", "Jogos", "Δ log loss", "IC 95% inferior", "IC 95% superior", "Veredito"]]
        st.dataframe(
            b.style.format(
                {
                    "Δ log loss": "{:+.4f}",
                    "IC 95% inferior": "{:+.4f}",
                    "IC 95% superior": "{:+.4f}",
                }
            ),
            width="stretch",
            hide_index=True,
        )
        st.caption("Δ positivo = o modelo tem log loss pior que o mercado.")

    betting = load_csv("backtest_betting.csv")
    if not betting.empty:
        st.markdown("#### E se apostasse? (stake fixo de 1 unidade)")
        bet = betting[betting["edge_minimo"] == 0.0].copy()
        bet = bet.rename(
            columns={
                "mercado": "Benchmark",
                "apostas_modelo": "Apostas (modelo)",
                "roi_modelo": "ROI modelo",
                "apostas_placebo": "Apostas (placebo)",
                "roi_placebo": "ROI placebo",
            }
        )[["Benchmark", "Apostas (modelo)", "ROI modelo", "Apostas (placebo)", "ROI placebo"]]
        st.dataframe(
            bet.style.format({"ROI modelo": "{:+.2%}", "ROI placebo": "{:+.2%}"}),
            width="stretch",
            hide_index=True,
        )
        st.caption(
            "O placebo aposta com as probabilidades do próprio mercado. "
            "ROI do modelo é negativo: a 'vantagem' que aparecia antes era vazamento de dados, não habilidade."
        )

    st.markdown("#### Figuras")
    figures = [
        ("logloss_por_temporada.png", "Log loss por temporada"),
        ("calibracao.png", "Calibração (vitória do mandante)"),
        ("matriz_confusao.png", "Matriz de confusão"),
        ("importancia_features.png", "Importância das features"),
    ]
    cols = st.columns(2)
    for i, (name, caption) in enumerate(figures):
        path = FIGURES / name
        if path.exists():
            with cols[i % 2]:
                st.image(str(path), caption=caption, width="stretch")

    st.markdown("#### Ficha técnica")
    st.markdown(
        """
- **Dados:** 5.646 partidas do Brasileirão Série A (2012–2026), fonte football-data.co.uk.
- **Validação:** walk-forward por temporada (teste em 2016–2026, 4.126 partidas com odds).
- **Features (32):** Elo, forma recente (5 e 10 jogos), desempenho na temporada,
  posição na tabela, posição na temporada anterior, descanso, acesso e rodada.
- **Modelos:** LogReg, HistGradientBoosting regularizado, blend dos dois e Poisson de gols.
- **Métrica principal:** log loss (probabilística), com Brier, RPS e acurácia como apoio.
        """
    )


# ---------------------------------------------------------------------------
# Aba 4: explorador de times
# ---------------------------------------------------------------------------
def tab_times(feat: pd.DataFrame, states: dict) -> None:
    teams = sorted(states)
    team = st.selectbox("Time", teams, index=teams.index("Flamengo") if "Flamengo" in teams else 0)
    state = states[team]

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Elo", f"{state.elo:.0f}")
    c2.metric("Posição", f"{state.position:.0f}º")
    c3.metric("Pontos", f"{state.points} em {state.played}")
    c4.metric("Saldo de gols", f"{state.goal_diff:+d}")

    c5, c6, c7, c8 = st.columns(4)
    c5.metric("Pontos/jogo", f"{state.season_ppg:.2f}")
    c6.metric("Forma (5 jogos)", f"{state.form5_ppg:.2f}")
    c7.metric("Gols pró/jogo (5)", f"{state.form5_gf:.2f}")
    c8.metric("Gols contra/jogo (5)", f"{state.form5_ga:.2f}")

    st.markdown("#### Histórico de Elo (últimas 4 temporadas)")
    home = feat.loc[feat["home"] == team, ["date", "elo_home"]].rename(columns={"elo_home": "Elo"})
    away = feat.loc[feat["away"] == team, ["date", "elo_away"]].rename(columns={"elo_away": "Elo"})
    elo = pd.concat([home, away]).sort_values("date").set_index("date")
    cut = pd.Timestamp(year=int(feat["season"].max()) - 3, month=1, day=1)
    elo = elo[elo.index >= cut]
    st.line_chart(elo, height=260, color="#0f766e")

    st.markdown("#### Últimos 10 jogos")
    matches = feat[(feat["home"] == team) | (feat["away"] == team)].sort_values("date").tail(10)
    rows = []
    for row in matches.itertuples(index=False):
        is_home = row.home == team
        gf, ga = (row.goals_home, row.goals_away) if is_home else (row.goals_away, row.goals_home)
        outcome = "V" if gf > ga else ("E" if gf == ga else "D")
        rows.append(
            {
                "Data": row.date,
                "Mando": "Casa" if is_home else "Fora",
                "Adversário": row.away if is_home else row.home,
                "Placar": f"{gf}–{ga}",
                "Resultado": outcome,
            }
        )
    last = pd.DataFrame(rows).iloc[::-1].reset_index(drop=True)
    st.dataframe(
        last.style.map(
            lambda v: (
                "background-color: #d1fae5; color: #065f46"
                if v == "V"
                else ("background-color: #fee2e2; color: #991b1b" if v == "D" else "")
            ),
            subset=["Resultado"],
        ),
        width="stretch",
        hide_index=True,
        column_config={"Data": st.column_config.DateColumn(format="DD/MM/YYYY")},
    )

    st.markdown("#### Comparação rápida com a tabela atual")
    table = pd.DataFrame(
        [
            {
                "Time": t,
                "Pos.": s.position,
                "Pts": s.points,
                "J": s.played,
                "SG": s.goal_diff,
                "PPG": round(s.season_ppg, 2),
                "Elo": round(s.elo),
            }
            for t, s in sorted(states.items(), key=lambda kv: kv[1].position)
        ]
    )
    st.dataframe(
        table.style.format({"PPG": "{:.2f}", "Elo": "{:.0f}"}).apply(
            lambda row: ["background-color: #ecfdf5" if row["Time"] == team else "" for _ in row],
            axis=1,
        ),
        width="stretch",
        hide_index=True,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    artifacts = load_artifacts()
    states = load_states()
    feat = load_features_cached()
    sim = load_simulation_cached()
    info = load_run_info()

    st.title("⚽ Brasileirão Série A — Machine Learning")
    st.caption(
        f"Modelo treinado com {info.get('partidas', '—'):,} partidas "
        f"({info.get('temporadas', ['—', '—'])[0]}–{info.get('temporadas', ['—', '—'])[1]}) · "
        f"última atualização: {artifacts.get('trained_on', '—')}"
    )

    tab1, tab2, tab3, tab4 = st.tabs(
        ["🔮 Simulador de partida", "📊 Tabela simulada", "📈 Desempenho", "🔎 Times"]
    )
    with tab1:
        tab_simulador(artifacts, states)
    with tab2:
        tab_tabela(sim, info)
    with tab3:
        tab_desempenho()
    with tab4:
        tab_times(feat, states)

    with st.sidebar:
        st.markdown("## Sobre")
        st.markdown(
            "Projeto de portfólio: previsão 1X2 e simulação do Brasileirão com "
            "features causais, validação walk-forward e benchmark contra odds de fechamento."
        )
        st.markdown("---")
        st.markdown("**Pipeline**")
        st.code(
            "python scripts/download_data.py\n"
            "python scripts/train.py\n"
            "python scripts/backtest.py\n"
            "streamlit run app/dashboard.py",
            language="bash",
        )
        st.markdown("---")
        st.markdown(
            "**Aviso:** o modelo *não* bate o mercado. O valor do projeto está na "
            "metodologia: validação honesta, detecção de vazamento e comparação com um "
            "benchmark forte."
        )
        st.markdown("---")
        st.markdown(
            f"Odds de referência: média do mercado (overround ~6,8%) e Pinnacle (~3,1%)."
        )


if __name__ == "__main__":
    main()
