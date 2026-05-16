"""Load all ML model bundles at app startup, hold in memory for inference."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib


MODELS_DIR = Path(__file__).resolve().parent / "models"


@lru_cache(maxsize=1)
def load_models() -> dict[str, Any]:
    """Load all model bundles once. Cached for the process lifetime."""
    print(f"[ml.loader] Loading models from {MODELS_DIR}")
    bundles = {
        "arrest": joblib.load(MODELS_DIR / "arrest_model.joblib"),
        "domestic": joblib.load(MODELS_DIR / "domestic_model.joblib"),
        "property_binary": joblib.load(MODELS_DIR / "property_binary_xgb_tuned.joblib"),
        "hierarchical": joblib.load(MODELS_DIR / "hierarchical_model.joblib"),
    }
    print(f"[ml.loader] Loaded {len(bundles)} model bundles")
    return bundles


def get_models() -> dict[str, Any]:
    return load_models()