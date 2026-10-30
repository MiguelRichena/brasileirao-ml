"""Smoke test do dashboard: executa o app e valida a interacao principal."""

from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _run_app():
    pytest.importorskip("streamlit")
    from streamlit.testing.v1 import AppTest

    at = AppTest.from_file(str(ROOT / "app" / "dashboard.py"), default_timeout=180)
    at.run()
    return at


def test_dashboard_executa_sem_excecao() -> None:
    at = _run_app()

    assert not at.exception, [e.value for e in at.exception]
    assert len(at.tabs) == 4
    assert at.title[0].value.startswith("⚽ Brasileirão")
    assert len(at.metric) >= 10
    assert len(at.dataframe) >= 5


def test_botao_inverter_troca_o_mando() -> None:
    at = _run_app()
    if at.exception:
        pytest.fail(f"app falhou antes do teste de interacao: {at.exception}")

    at.selectbox[0].set_value("Palmeiras").run()
    at.selectbox[1].set_value("Flamengo").run()
    assert at.selectbox[0].value == "Palmeiras"
    assert at.selectbox[1].value == "Flamengo"

    at.button[0].click().run()

    assert not at.exception, [e.value for e in at.exception]
    assert at.selectbox[0].value == "Flamengo"
    assert at.selectbox[1].value == "Palmeiras"
