"""Caminhos e constantes compartilhados pelo projeto."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

DATA_RAW = ROOT / "data" / "raw"
DATA_PROCESSED = ROOT / "data" / "processed"
REPORTS = ROOT / "reports"
FIGURES = REPORTS / "figures"
MODELS = ROOT / "models"

RAW_FILE = DATA_RAW / "brasileirao.csv"
FEATURES_FILE = DATA_PROCESSED / "matches_features.csv"
MODEL_FILE = MODELS / "final_model.joblib"
SIM_FILE = REPORTS / "season_simulation.csv"
METRICS_FILE = REPORTS / "metrics.csv"
PREDICTIONS_FILE = REPORTS / "predictions_walkforward.csv"

# Ordem canonica das classes: casa, empate, fora.
# A ordem importa para o RPS (metrica que explora a ordinalidade H > D > A).
CLASSES = ["H", "D", "A"]
CLASS_LABELS = {"H": "Casa", "D": "Empate", "A": "Fora"}

# Primeira temporada usada como teste no walk-forward (precisa de historico).
FIRST_TEST_SEASON = 2016

# Configuracao do campeonato
POINTS_WIN = 3
TITLE_SLOTS = 1          # campeao
LIBERTADORES_SLOTS = 4   # G4 (aproximacao: 4 primeiros)
RELEGATION_SLOTS = 4     # Z4

# Parametros do Elo
ELO_START = 1500.0
ELO_K = 20.0
HOME_ADV_ELO = 60.0
SEASON_REGRESSION = 0.75  # fracao do desvio que sobrevive entre temporadas

RANDOM_STATE = 42
