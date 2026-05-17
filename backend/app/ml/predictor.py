"""Inference functions for each ML model.

Each predict_* function takes a feature dict and returns a clean response.
Feature dicts use the same field names as the training pipeline.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import xgboost as xgb

from app.ml.explainer import explain_binary_prediction


# Feature columns that go into every model
BASE_FEATURE_COLS = [
    "hour", "day_of_week", "month", "is_weekend", "quarter", "shift",
    "beat_num", "community_area", "latitude", "longitude",
]


def _shift(h: int) -> int:
    if 7 <= h < 15:
        return 0
    if 15 <= h < 23:
        return 1
    return 2


def _build_feature_row(features: dict) -> dict:
    """Derive shape-matched feature values from a raw input dict."""
    hour = int(features["hour"])
    dow = int(features["day_of_week"])
    month = int(features["month"])
    return {
        "hour": hour,
        "day_of_week": dow,
        "month": month,
        "is_weekend": 1 if dow >= 5 else 0,
        "quarter": (month - 1) // 3 + 1,
        "shift": _shift(hour),
        "beat_num": int(features["beat_num"]),
        "community_area": int(features["community_area"]),
        "latitude": float(features["latitude"]),
        "longitude": float(features["longitude"]),
        "district": str(features["district"]),
        "location_group": str(features.get("location_group", "OTHER")).upper(),
        "primary_type": str(features.get("primary_type", "")),
    }


def _encode_row(row: dict, district_map: dict, location_map: dict,
                type_map: dict | None = None) -> np.ndarray:
    """Encode a feature row using the bundle's maps. Unseen values -> -1."""
    district_enc = district_map.get(row["district"], -1)
    location_enc = location_map.get(row["location_group"], -1)
    vec = [row[c] for c in BASE_FEATURE_COLS] + [district_enc, location_enc]
    if type_map is not None:
        type_enc = type_map.get(row["primary_type"], -1)
        vec.append(type_enc)
    return np.array([vec], dtype=np.float32)


def predict_arrest(features: dict, bundle: dict[str, Any],
                   threshold: float = 0.5) -> dict:
    row = _build_feature_row(features)
    X = _encode_row(row, bundle["district_map"], bundle["location_map"],
                    bundle["type_map"])
    proba = float(bundle["model"].predict(xgb.DMatrix(X))[0])
    return {
        "model": "arrest",
        "probability": proba,
        "prediction": int(proba > threshold),
        "threshold": threshold,
    }


def predict_domestic(features: dict, bundle: dict[str, Any],
                     threshold: float = 0.5) -> dict:
    row = _build_feature_row(features)
    X = _encode_row(row, bundle["district_map"], bundle["location_map"],
                    bundle["type_map"])
    proba = float(bundle["model"].predict(xgb.DMatrix(X))[0])
    return {
        "model": "domestic",
        "probability": proba,
        "prediction": int(proba > threshold),
        "threshold": threshold,
    }


def predict_property_binary(features: dict, bundle: dict[str, Any],
                            threshold: float = 0.5) -> dict:
    row = _build_feature_row(features)
    X = _encode_row(row, bundle["district_map"], bundle["location_map"],
                    type_map=None)
    proba = float(bundle["model"].predict(xgb.DMatrix(X))[0])
    return {
        "model": "property_binary",
        "probability": proba,
        "prediction": int(proba > threshold),
        "threshold": threshold,
        "label": "property" if proba > threshold else "not_property",
    }


def predict_crime_type(features: dict, bundle: dict[str, Any],
                       top_k: int = 5) -> dict:
    """Hierarchical: top-level supercategory * per-supercategory subtype.

    Returns top-K final classes by joint probability.
    """
    row = _build_feature_row(features)
    X = _encode_row(row, bundle["district_map"], bundle["location_map"],
                    type_map=None)

    top_model = bundle["top_level_model"]
    top_classes = bundle["top_level_encoder"].classes_
    top_proba = top_model.predict(xgb.DMatrix(X))[0]  # (n_supercats,)

    subtype_models = bundle["subtype_models"]
    subtype_encoders = bundle["subtype_encoders"]
    final_class_to_idx = bundle["final_class_to_idx"]
    all_classes = bundle["all_final_classes"]

    full_proba = np.zeros(len(all_classes), dtype=np.float32)
    for sup_i, sup in enumerate(top_classes):
        sup_prob = top_proba[sup_i]
        sub_model = subtype_models[sup]
        sub_classes = subtype_encoders[sup].classes_
        sub_preds = sub_model.predict(xgb.DMatrix(X))[0]
        # Binary subtype -> 2-vector; multiclass -> n-vector
        if sub_preds.ndim == 0 or (hasattr(sub_preds, "shape") and sub_preds.shape == ()):
            sub_preds = np.array([1 - sub_preds, sub_preds])
        for j, cls in enumerate(sub_classes):
            global_i = final_class_to_idx[cls]
            full_proba[global_i] = sup_prob * sub_preds[j]

    top_idx = np.argsort(full_proba)[::-1][:top_k]
    return {
        "model": "hierarchical_crime_type",
        "top_k": [
            {"class": all_classes[i], "probability": float(full_proba[i])}
            for i in top_idx
        ],
        "supercategory_probabilities": {
            cls: float(top_proba[i]) for i, cls in enumerate(top_classes)
        },
    }

def predict_arrest_with_explanation(features: dict, bundle: dict[str, Any],
                                     threshold: float = 0.5,
                                     top_features: int = 5) -> dict:
    row = _build_feature_row(features)
    X = _encode_row(row, bundle["district_map"], bundle["location_map"],
                    bundle["type_map"])
    proba = float(bundle["model"].predict(xgb.DMatrix(X))[0])
    explanation = explain_binary_prediction(bundle["model"], X, bundle["feature_cols"])
    explanation["contributions"] = explanation["contributions"][:top_features]
    return {
        "model": "arrest",
        "probability": proba,
        "prediction": int(proba > threshold),
        "threshold": threshold,
        "explanation": explanation,
    }


def predict_domestic_with_explanation(features: dict, bundle: dict[str, Any],
                                       threshold: float = 0.5,
                                       top_features: int = 5) -> dict:
    row = _build_feature_row(features)
    X = _encode_row(row, bundle["district_map"], bundle["location_map"],
                    bundle["type_map"])
    proba = float(bundle["model"].predict(xgb.DMatrix(X))[0])
    explanation = explain_binary_prediction(bundle["model"], X, bundle["feature_cols"])
    explanation["contributions"] = explanation["contributions"][:top_features]
    return {
        "model": "domestic",
        "probability": proba,
        "prediction": int(proba > threshold),
        "threshold": threshold,
        "explanation": explanation,
    }


def predict_property_with_explanation(features: dict, bundle: dict[str, Any],
                                       threshold: float = 0.5,
                                       top_features: int = 5) -> dict:
    row = _build_feature_row(features)
    X = _encode_row(row, bundle["district_map"], bundle["location_map"],
                    type_map=None)
    proba = float(bundle["model"].predict(xgb.DMatrix(X))[0])
    explanation = explain_binary_prediction(bundle["model"], X, bundle["feature_cols"])
    explanation["contributions"] = explanation["contributions"][:top_features]
    return {
        "model": "property_binary",
        "probability": proba,
        "prediction": int(proba > threshold),
        "threshold": threshold,
        "label": "property" if proba > threshold else "not_property",
        "explanation": explanation,
    }