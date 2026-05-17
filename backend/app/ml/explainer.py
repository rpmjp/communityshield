"""SHAP explainers for the binary XGBoost models.

Uses TreeSHAP — fast, exact for tree ensembles. Explains a single prediction
by attributing the log-odds delta from baseline to each feature.

For the 4-class hierarchical model we skip SHAP for now (combining
supercategory × subtype attributions is non-trivial and adds little
interpretive value over showing the binary explanations).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

import numpy as np
import shap
import xgboost as xgb


# Human-readable labels for the encoded features
FEATURE_LABELS = {
    "hour": "Hour of day",
    "day_of_week": "Day of week",
    "month": "Month",
    "is_weekend": "Weekend",
    "quarter": "Quarter",
    "shift": "Shift (day/evening/night)",
    "beat_num": "Beat",
    "community_area": "Community area",
    "latitude": "Latitude",
    "longitude": "Longitude",
    "district_enc": "Police district",
    "location_enc": "Location type",
    "type_enc": "Crime type",
}


@lru_cache(maxsize=8)
def get_explainer(model_id: int):
    """Build (and cache) a TreeExplainer for an XGBoost booster.

    Cached by python id() so repeated calls with the same booster are free.
    """
    raise RuntimeError("Use build_explainer instead; lru_cache by id is unreliable.")


_EXPLAINER_CACHE: dict[int, shap.TreeExplainer] = {}


def build_explainer(booster) -> shap.TreeExplainer:
    """Return a TreeExplainer, caching per booster instance."""
    key = id(booster)
    if key in _EXPLAINER_CACHE:
        return _EXPLAINER_CACHE[key]
    explainer = shap.TreeExplainer(booster)
    _EXPLAINER_CACHE[key] = explainer
    return explainer


def explain_binary_prediction(
    booster, X: np.ndarray, feature_cols: list[str]
) -> dict[str, Any]:
    """Compute SHAP values for one row and return a structured explanation.

    Returns:
        {
            "base_value": float (model's average log-odds output),
            "prediction_value": float (this row's log-odds output),
            "contributions": [
                {"feature": str, "label": str, "value": float (input), "shap": float},
                ...
            ] sorted by abs(shap) descending
        }
    """
    explainer = build_explainer(booster)

    # X is shape (1, n_features). SHAP values for binary XGBoost: shape (1, n_features)
    shap_values = explainer.shap_values(X)
    if isinstance(shap_values, list):  # some XGBoost binary returns a list
        shap_values = shap_values[1] if len(shap_values) > 1 else shap_values[0]
    shap_row = shap_values[0]  # (n_features,)

    # Base value (expected log-odds)
    base = explainer.expected_value
    if isinstance(base, (list, np.ndarray)):
        base = float(base[-1] if hasattr(base, "__len__") and len(base) > 0 else base)
    else:
        base = float(base)

    contributions = []
    for i, col in enumerate(feature_cols):
        contributions.append({
            "feature": col,
            "label": FEATURE_LABELS.get(col, col),
            "value": float(X[0][i]),
            "shap": float(shap_row[i]),
        })
    contributions.sort(key=lambda c: abs(c["shap"]), reverse=True)

    return {
        "base_value": base,
        "prediction_value": base + float(shap_row.sum()),
        "contributions": contributions,
    }