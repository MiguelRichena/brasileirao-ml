"""Definicao dos modelos e utilitarios de probabilidade."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import CLASSES, RANDOM_STATE
from .features import FEATURES


class AverageBlend:
    """Media simples das probabilidades de dois ou mais modelos."""

    def __init__(self, estimators: list):
        self.estimators = estimators

    def fit(self, X, y):
        self.fitted_ = [est.fit(X, y) for est in self.estimators]
        return self

    def predict_proba(self, X):
        return np.mean([est.predict_proba(X) for est in self.fitted_], axis=0)

    @property
    def classes_(self):
        return self.fitted_[0].classes_


def _logreg(C: float = 0.1) -> Pipeline:
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            (
                "model",
                LogisticRegression(C=C, max_iter=3000, random_state=RANDOM_STATE),
            ),
        ]
    )


def _hist_gb() -> HistGradientBoostingClassifier:
    """Boosting com poucas folhas por arvore.

    Testado no walk-forward: com ~4 mil partidas e 32 features, arvores
    grandes (15 folhas, 300 iteracoes) sobreajustam e perdem para o
    LogReg. Arvores pequenas (4 folhas) funcionam como um modelo quase
    aditivo e generalizam melhor.
    """
    return HistGradientBoostingClassifier(
        learning_rate=0.03,
        max_iter=500,
        max_leaf_nodes=4,
        min_samples_leaf=100,
        l2_regularization=10.0,
        early_stopping=False,
        random_state=RANDOM_STATE,
    )


@dataclass(frozen=True)
class ModelSpec:
    name: str
    factory: Callable[[], object]
    columns: list[str] | None = None

    def make(self):
        return self.factory()


MODEL_SPECS: list[ModelSpec] = [
    ModelSpec("Frequência do treino", lambda: DummyClassifier(strategy="prior")),
    ModelSpec(
        "LogReg (só Elo)",
        lambda: _logreg(C=1.0),
        columns=["elo_home_adv"],
    ),
    ModelSpec("LogReg", lambda: _logreg(C=0.1)),
    ModelSpec("HistGradientBoosting", _hist_gb),
    ModelSpec(
        "Blend LogReg + HGB",
        lambda: AverageBlend([_logreg(C=0.1), _hist_gb()]),
    ),
]

MAIN_FEATURES = FEATURES


def aligned_proba(estimator, X) -> np.ndarray:
    """Probabilidades reordenadas para [casa, empate, fora]."""
    raw = estimator.predict_proba(X)
    classes = list(estimator.classes_)
    index = [classes.index(c) for c in CLASSES]
    return raw[:, index]


def fit_predict(spec: ModelSpec, X_train, y_train, X_test) -> np.ndarray:
    model = spec.make()
    cols = spec.columns
    Xtr = X_train[cols] if cols else X_train
    Xte = X_test[cols] if cols else X_test
    model.fit(Xtr, y_train)
    return aligned_proba(model, Xte)


def predict_with(model, X, columns: list[str] | None = None) -> np.ndarray:
    """Probabilidades de um modelo ja treinado, na ordem [H, D, A]."""
    cols = columns if columns is not None else list(X.columns)
    return aligned_proba(model, X[cols])
