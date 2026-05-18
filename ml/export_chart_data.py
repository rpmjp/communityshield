"""Export chart data for the methodology page.

Reads existing training artifacts (models, ROC CSVs, metrics JSONs) and writes
a single consolidated JSON file with everything the frontend needs.

Output: ~/projects/communityshield/frontend/src/data/methodology.json
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
OUTPUT = Path(__file__).resolve().parent.parent / "frontend" / "src" / "data" / "methodology.json"

# How many ROC points to keep per curve (full CSVs are ~100k rows, too big for frontend)
ROC_SAMPLE_POINTS = 200


def load_metrics(name: str) -> dict:
    """Load the metrics JSON for a model."""
    path = ARTIFACTS / f"{name}_metrics.json"
    if path.exists():
        return json.loads(path.read_text())
    return {}


def downsample_roc(csv_path: Path, n_points: int = ROC_SAMPLE_POINTS) -> list[dict]:
    """Read a ROC CSV and downsample to n_points evenly-spaced rows."""
    if not csv_path.exists():
        return []
    df = pd.read_csv(csv_path)
    if len(df) <= n_points:
        sampled = df
    else:
        # Even spacing across the full curve, always include first/last
        idx = pd.Series(range(len(df))).sample(n_points - 2, random_state=42).sort_values()
        idx = pd.concat([pd.Series([0]), idx, pd.Series([len(df) - 1])]).drop_duplicates().sort_values()
        sampled = df.iloc[idx]
    # Standardize column names; the CSVs use fpr / tpr / threshold
    cols = {c.lower(): c for c in sampled.columns}
    fpr_col = cols.get("fpr", "fpr")
    tpr_col = cols.get("tpr", "tpr")
    return [
        {"fpr": float(row[fpr_col]), "tpr": float(row[tpr_col])}
        for _, row in sampled.iterrows()
    ]


def feature_importance(model_path: Path, top_n: int = 10) -> list[dict]:
    """Extract feature importance from a saved XGBoost bundle."""
    if not model_path.exists():
        return []
    bundle = joblib.load(model_path)
    model = bundle.get("model")
    feature_cols = bundle.get("feature_cols", [])
    if model is None or not feature_cols:
        return []
    # XGBoost booster has get_score
    try:
        scores = model.get_score(importance_type="gain")
    except Exception:
        return []
    # Booster keys are f0, f1, ... map to feature names
    items = []
    for k, v in scores.items():
        if k.startswith("f"):
            idx = int(k[1:])
            if 0 <= idx < len(feature_cols):
                items.append({"feature": feature_cols[idx], "importance": float(v)})
        else:
            items.append({"feature": k, "importance": float(v)})
    items.sort(key=lambda x: x["importance"], reverse=True)
    return items[:top_n]


def main():
    data = {
        "arrest": {
            "metrics": load_metrics("arrest"),
            "roc": downsample_roc(ARTIFACTS / "arrest_roc_test.csv"),
            "feature_importance": feature_importance(ARTIFACTS / "arrest_model.joblib"),
        },
        "domestic": {
            "metrics": load_metrics("domestic"),
            "roc": downsample_roc(ARTIFACTS / "domestic_roc_test.csv"),
            "feature_importance": feature_importance(ARTIFACTS / "domestic_model.joblib"),
        },
        "property_binary": {
            "metrics": load_metrics("property_binary_tuned"),
            "roc": downsample_roc(ARTIFACTS / "xgb_tuned_roc_test.csv"),
            "feature_importance": feature_importance(ARTIFACTS / "property_binary_xgb_tuned.joblib"),
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, indent=2))
    size_kb = OUTPUT.stat().st_size / 1024
    print(f"Wrote {OUTPUT} ({size_kb:.1f} KB)")
    for k, v in data.items():
        print(f"  {k}: roc={len(v['roc'])} pts, fi={len(v['feature_importance'])} feats")


if __name__ == "__main__":
    main()