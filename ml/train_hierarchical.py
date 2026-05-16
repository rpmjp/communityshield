"""Phase 4C — Hierarchical classification.

Architecture:
    1. Top-level supercategory model (4 classes: property/violent/drug/other)
    2. Four subtype models, one per supercategory
    3. Final prediction = P(supercategory) * P(subtype | supercategory)

Evaluates two routing strategies:
    - HARD:  argmax supercategory, route to that subtype model
    - SOFT:  probabilistic routing over all supercategories (more honest)

Reports both per-supercategory accuracy and full per-class accuracy.

Usage:
    python train_hierarchical.py
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    top_k_accuracy_score,
)
from sklearn.preprocessing import LabelEncoder


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)


SUPERCATEGORY_MAP = {
    # Property
    "THEFT": "property", "BURGLARY": "property", "MOTOR VEHICLE THEFT": "property",
    "DECEPTIVE PRACTICE": "property", "CRIMINAL DAMAGE": "property",
    "CRIMINAL TRESPASS": "property", "ARSON": "property",
    # Violent
    "BATTERY": "violent", "ASSAULT": "violent", "ROBBERY": "violent",
    "HOMICIDE": "violent", "CRIMINAL SEXUAL ASSAULT": "violent",
    "CRIM SEXUAL ASSAULT": "violent",  # alias
    "SEX OFFENSE": "violent", "OFFENSE INVOLVING CHILDREN": "violent",
    "STALKING": "violent", "INTIMIDATION": "violent", "KIDNAPPING": "violent",
    # Drug
    "NARCOTICS": "drug", "OTHER NARCOTIC VIOLATION": "drug",
    "LIQUOR LAW VIOLATION": "drug", "GAMBLING": "drug",
    # Other
    "WEAPONS VIOLATION": "other", "CONCEALED CARRY LICENSE VIOLATION": "other",
    "PUBLIC PEACE VIOLATION": "other", "INTERFERENCE WITH PUBLIC OFFICER": "other",
    "PROSTITUTION": "other", "OTHER OFFENSE": "other", "PUBLIC INDECENCY": "other",
    "OBSCENITY": "other", "NON-CRIMINAL": "other", "NON - CRIMINAL": "other",
    "RITUALISM": "other", "HUMAN TRAFFICKING": "other",
}

# Subtype labels we include per supercategory.
# Anything not listed gets mapped to a "rare" bucket within its supercategory.
SUBTYPE_CLASSES = {
    "property": ["THEFT", "CRIMINAL DAMAGE", "DECEPTIVE PRACTICE",
                 "MOTOR VEHICLE THEFT", "BURGLARY", "CRIMINAL TRESPASS", "ARSON"],
    "violent": ["BATTERY", "ASSAULT", "ROBBERY", "OFFENSE INVOLVING CHILDREN",
                "SEX OFFENSE", "CRIMINAL SEXUAL ASSAULT", "HOMICIDE", "STALKING"],
    "drug": ["NARCOTICS", "LIQUOR LAW VIOLATION", "GAMBLING"],
    "other": ["OTHER OFFENSE", "WEAPONS VIOLATION", "PUBLIC PEACE VIOLATION",
              "INTERFERENCE WITH PUBLIC OFFICER", "PROSTITUTION",
              "CONCEALED CARRY LICENSE VIOLATION"],
}

# Alias normalization
TYPE_ALIASES = {
    "CRIM SEXUAL ASSAULT": "CRIMINAL SEXUAL ASSAULT",
    "NON - CRIMINAL": "NON-CRIMINAL",
}

FEATURE_COLS = [
    "hour", "day_of_week", "month", "is_weekend", "quarter", "shift",
    "beat_num", "community_area", "latitude", "longitude",
]
DISTRICT_COL = "district"
LOCATION_COL = "location_group"


class Tee:
    def __init__(self, *files):
        self.files = files
    def write(self, s):
        for f in self.files:
            try: f.write(s); f.flush()
            except (ValueError, OSError): pass
    def flush(self):
        for f in self.files:
            try: f.flush()
            except (ValueError, OSError): pass


def load_features():
    df = pd.read_parquet(ROOT / "features.parquet")
    # Normalize aliases first
    df["primary_type"] = df["primary_type"].replace(TYPE_ALIASES)
    df["supercategory"] = df["primary_type"].map(SUPERCATEGORY_MAP).fillna("other")
    return df


def build_encoders(train_df):
    district_map = {d: i for i, d in enumerate(
        sorted(train_df[DISTRICT_COL].astype(str).unique()))}
    location_map = {l: i for i, l in enumerate(
        sorted(train_df[LOCATION_COL].astype(str).unique()))}
    return district_map, location_map


def to_xy(df, target_col, label_encoder, district_map, location_map):
    d = df.copy()
    d["district_enc"] = (
        d[DISTRICT_COL].astype(str).map(district_map).fillna(-1).astype("int32")
    )
    d["location_enc"] = (
        d[LOCATION_COL].astype(str).map(location_map).fillna(-1).astype("int32")
    )
    cols = FEATURE_COLS + ["district_enc", "location_enc"]
    X = d[cols].astype("float32").values
    y = label_encoder.transform(d[target_col])
    return X, y, cols


def sqrt_weights(y: np.ndarray, n_classes: int) -> np.ndarray:
    counts = np.bincount(y, minlength=n_classes)
    inv = np.sqrt(len(y) / (n_classes * counts.clip(min=1)))
    return inv[y].astype("float32")


def train_xgb(X_train, y_train, X_val, y_val, n_classes, model_name,
              args, log_lines):
    print(f"\n--- Training {model_name} ---")
    print(f"  train: {X_train.shape}, val: {X_val.shape}, classes: {n_classes}")

    weights = sqrt_weights(y_train, n_classes)
    dtrain = xgb.DMatrix(X_train, label=y_train, weight=weights)
    dval = xgb.DMatrix(X_val, label=y_val)

    if n_classes == 2:
        objective = "binary:logistic"
        eval_metric = "logloss"
        params_extra = {}
    else:
        objective = "multi:softprob"
        eval_metric = "mlogloss"
        params_extra = {"num_class": n_classes}

    params = {
        "objective": objective,
        "eval_metric": eval_metric,
        "max_depth": args.max_depth,
        "learning_rate": args.learning_rate,
        "tree_method": "hist",
        "device": args.device,
        "verbosity": 0,
        "seed": 42,
        **params_extra,
    }

    start = time.time()
    booster = xgb.train(
        params, dtrain,
        num_boost_round=args.n_estimators,
        evals=[(dval, "val")],
        early_stopping_rounds=40,
        verbose_eval=100,
    )
    train_time = time.time() - start
    print(f"  Trained in {train_time:.1f}s, best iter {booster.best_iteration}")
    return booster, train_time


def predict_proba(booster, X, n_classes):
    """Return (n_samples, n_classes) probability matrix."""
    preds = booster.predict(xgb.DMatrix(X))
    if n_classes == 2:
        # binary: returns positive class proba; expand to 2-class matrix
        return np.column_stack([1 - preds, preds])
    return preds


def evaluate_top_level(booster, X, y, classes, label):
    proba = predict_proba(booster, X, len(classes))
    pred = proba.argmax(axis=1)
    acc = accuracy_score(y, pred)
    f1 = f1_score(y, pred, average="macro", zero_division=0)
    print(f"\n  [Top-level {label}] acc={acc:.4f}, macro_f1={f1:.4f}")
    print(classification_report(y, pred, target_names=classes, digits=3,
                                zero_division=0))
    return {"accuracy": float(acc), "macro_f1": float(f1)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n-estimators", type=int, default=500)
    parser.add_argument("--max-depth", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=0.1)
    parser.add_argument("--device", type=str, default="cuda")
    args = parser.parse_args()

    log_path = ARTIFACTS / "hierarchical_log.txt"
    log_file = open(log_path, "w")
    sys.stdout = Tee(sys.__stdout__, log_file)

    print(f"Phase 4C — Hierarchical classification")
    print(f"Device: {args.device}\n")

    df = load_features()
    train_df = df[df["split"] == "train"].copy()
    val_df = df[df["split"] == "val"].copy()
    test_df = df[df["split"] == "test"].copy()
    print(f"Loaded: train {len(train_df):,}  val {len(val_df):,}  test {len(test_df):,}")

    district_map, location_map = build_encoders(train_df)
    print(f"Encoders: {len(district_map)} districts, {len(location_map)} locations")

    # ----- TOP-LEVEL MODEL: 4-class supercategory -----
    print("\n" + "=" * 80)
    print("TOP-LEVEL: 4-class supercategory (property/violent/drug/other)")
    print("=" * 80)

    le_sup = LabelEncoder()
    le_sup.fit(train_df["supercategory"])
    print(f"Classes: {list(le_sup.classes_)}")

    X_tr, y_tr_sup, fc = to_xy(train_df, "supercategory", le_sup,
                                district_map, location_map)
    X_va, y_va_sup, _ = to_xy(val_df, "supercategory", le_sup,
                               district_map, location_map)
    X_te, y_te_sup, _ = to_xy(test_df, "supercategory", le_sup,
                               district_map, location_map)

    top_booster, top_time = train_xgb(X_tr, y_tr_sup, X_va, y_va_sup,
                                       n_classes=4, model_name="top-level (4-class)",
                                       args=args, log_lines=[])

    top_metrics = {
        "val": evaluate_top_level(top_booster, X_va, y_va_sup,
                                   list(le_sup.classes_), "val"),
        "test": evaluate_top_level(top_booster, X_te, y_te_sup,
                                    list(le_sup.classes_), "test"),
    }

    # ----- SUBTYPE MODELS: one per supercategory -----
    subtype_models = {}
    subtype_encoders = {}
    subtype_metrics = {}
    subtype_subset_size = {}

    for sup in ["property", "violent", "drug", "other"]:
        print("\n" + "=" * 80)
        print(f"SUBTYPE MODEL: {sup}")
        print("=" * 80)

        allowed = SUBTYPE_CLASSES[sup]

        sup_train = train_df[train_df["supercategory"] == sup].copy()
        sup_val = val_df[val_df["supercategory"] == sup].copy()
        sup_test = test_df[test_df["supercategory"] == sup].copy()

        sup_train["subtype"] = np.where(
            sup_train["primary_type"].isin(allowed),
            sup_train["primary_type"], f"OTHER_{sup.upper()}"
        )
        sup_val["subtype"] = np.where(
            sup_val["primary_type"].isin(allowed),
            sup_val["primary_type"], f"OTHER_{sup.upper()}"
        )
        sup_test["subtype"] = np.where(
            sup_test["primary_type"].isin(allowed),
            sup_test["primary_type"], f"OTHER_{sup.upper()}"
        )

        print(f"\nSubtype class distribution (train):")
        for s, n in sup_train["subtype"].value_counts().items():
            pct = n / len(sup_train) * 100
            print(f"  {s:<40} {n:>8,}  ({pct:>5.2f}%)")
        print(f"  Total: {len(sup_train):,} train, {len(sup_val):,} val, "
              f"{len(sup_test):,} test")
        subtype_subset_size[sup] = {
            "train": len(sup_train), "val": len(sup_val), "test": len(sup_test),
        }

        le_sub = LabelEncoder()
        le_sub.fit(sup_train["subtype"])
        print(f"\nClasses: {list(le_sub.classes_)}")

        X_str, y_str, _ = to_xy(sup_train, "subtype", le_sub,
                                 district_map, location_map)
        X_sva, y_sva, _ = to_xy(sup_val, "subtype", le_sub,
                                 district_map, location_map)
        X_ste, y_ste, _ = to_xy(sup_test, "subtype", le_sub,
                                 district_map, location_map)

        sub_booster, sub_time = train_xgb(
            X_str, y_str, X_sva, y_sva,
            n_classes=len(le_sub.classes_),
            model_name=f"subtype-{sup}", args=args, log_lines=[],
        )

        # Evaluate ONLY on rows whose true supercategory == this sup
        # (this is the "perfect routing" baseline — gives subtype model's
        #  upper-bound performance on its own task)
        print(f"\n  [Subtype-{sup}] eval on TRUE-{sup} rows only (perfect routing):")
        proba = predict_proba(sub_booster, X_ste, len(le_sub.classes_))
        pred = proba.argmax(axis=1)
        acc = accuracy_score(y_ste, pred)
        f1 = f1_score(y_ste, pred, average="macro", zero_division=0)
        print(f"    acc={acc:.4f}, macro_f1={f1:.4f}")
        print(classification_report(y_ste, pred,
                                    target_names=le_sub.classes_,
                                    digits=3, zero_division=0))

        subtype_models[sup] = sub_booster
        subtype_encoders[sup] = le_sub
        subtype_metrics[sup] = {
            "perfect_routing": {
                "accuracy": float(acc),
                "macro_f1": float(f1),
                "n_classes": int(len(le_sub.classes_)),
                "n_test_rows": int(len(y_ste)),
            },
            "train_seconds": float(sub_time),
        }

    # ----- FULL PIPELINE: combine top-level + subtype models -----
    print("\n" + "=" * 80)
    print("FULL PIPELINE EVALUATION ON TEST SET")
    print("=" * 80)

    # Build the unified final-class label space across all supercategories.
    # Final classes = union of all subtype encoder classes.
    all_classes = []
    for sup in ["property", "violent", "drug", "other"]:
        all_classes.extend(subtype_encoders[sup].classes_.tolist())
    final_class_to_idx = {c: i for i, c in enumerate(all_classes)}
    n_final = len(all_classes)
    print(f"\nFinal label space: {n_final} classes")

    # True label per test row, in final-class index
    test_df["final_label"] = test_df["primary_type"]
    for sup in ["property", "violent", "drug", "other"]:
        allowed = SUBTYPE_CLASSES[sup]
        mask_sup = test_df["supercategory"] == sup
        rare_mask = mask_sup & ~test_df["primary_type"].isin(allowed)
        test_df.loc[rare_mask, "final_label"] = f"OTHER_{sup.upper()}"

    y_te_final = test_df["final_label"].map(final_class_to_idx).values
    # Drop rows whose label isn't in the final space (shouldn't happen but safety)
    valid = ~pd.isna(y_te_final)
    if not valid.all():
        n_drop = (~valid).sum()
        print(f"WARNING: dropping {n_drop:,} test rows with labels outside final space")
        X_te = X_te[valid]
        y_te_final = y_te_final[valid].astype("int32")
        y_te_sup = y_te_sup[valid]
        test_df = test_df[valid].reset_index(drop=True)
    else:
        y_te_final = y_te_final.astype("int32")

    # Top-level probabilities (n_test, 4)
    top_proba = predict_proba(top_booster, X_te, 4)

    # Subtype probabilities — apply each subtype model to ALL test rows
    # because soft routing uses them all weighted by top-level probs
    sub_proba_all = {}
    for sup in ["property", "violent", "drug", "other"]:
        n_sub = len(subtype_encoders[sup].classes_)
        sub_proba_all[sup] = predict_proba(subtype_models[sup], X_te, n_sub)

    # Build full (n_test, n_final) probability matrix using soft routing
    # P(final_class c) = P(supercat of c) * P(c | supercat of c)
    # Each subtype encoder index space is local; map to global via final_class_to_idx
    sup_idx_of = {sup: i for i, sup in enumerate(le_sup.classes_)}
    full_proba = np.zeros((len(X_te), n_final), dtype=np.float32)
    for sup in ["property", "violent", "drug", "other"]:
        sup_i = sup_idx_of[sup]
        sup_probs = top_proba[:, sup_i:sup_i+1]  # (n_test, 1)
        sub_probs = sub_proba_all[sup]  # (n_test, n_subclasses)
        joint = sup_probs * sub_probs  # (n_test, n_subclasses)
        for local_i, cls_name in enumerate(subtype_encoders[sup].classes_):
            global_i = final_class_to_idx[cls_name]
            full_proba[:, global_i] = joint[:, local_i]

    pred_soft = full_proba.argmax(axis=1)
    acc_soft = accuracy_score(y_te_final, pred_soft)
    f1_soft = f1_score(y_te_final, pred_soft, average="macro", zero_division=0)
    top3_soft = top_k_accuracy_score(
        y_te_final, full_proba, k=3, labels=np.arange(n_final)
    )
    top5_soft = top_k_accuracy_score(
        y_te_final, full_proba, k=5, labels=np.arange(n_final)
    )
    print(f"\n[SOFT routing] top-1 acc={acc_soft:.4f}  top-3={top3_soft:.4f}  "
          f"top-5={top5_soft:.4f}  macro_f1={f1_soft:.4f}")

    # Hard routing: pick supercategory by argmax, then use only that subtype model
    top_pred = top_proba.argmax(axis=1)
    pred_hard = np.zeros(len(X_te), dtype=np.int32)
    for i, sup_i in enumerate(top_pred):
        sup = le_sup.classes_[sup_i]
        local_pred = sub_proba_all[sup][i].argmax()
        cls_name = subtype_encoders[sup].classes_[local_pred]
        pred_hard[i] = final_class_to_idx[cls_name]
    acc_hard = accuracy_score(y_te_final, pred_hard)
    f1_hard = f1_score(y_te_final, pred_hard, average="macro", zero_division=0)
    print(f"[HARD routing] top-1 acc={acc_hard:.4f}  macro_f1={f1_hard:.4f}")

    # Baseline (predict most common final class)
    majority = int(np.bincount(y_te_final).argmax())
    baseline_acc = accuracy_score(y_te_final, np.full_like(y_te_final, majority))
    print(f"\nBaseline (predict majority final class): {baseline_acc:.4f}")
    print(f"Soft routing lift over baseline: +{(acc_soft - baseline_acc) * 100:.2f}pp")

    # ----- Save all artifacts -----
    bundle = {
        "top_level_model": top_booster,
        "top_level_encoder": le_sup,
        "subtype_models": subtype_models,
        "subtype_encoders": subtype_encoders,
        "supercategory_map": SUPERCATEGORY_MAP,
        "subtype_classes": SUBTYPE_CLASSES,
        "type_aliases": TYPE_ALIASES,
        "district_map": district_map,
        "location_map": location_map,
        "feature_cols": fc,
        "all_final_classes": all_classes,
        "final_class_to_idx": final_class_to_idx,
    }
    joblib.dump(bundle, ARTIFACTS / "hierarchical_model.joblib")

    metrics = {
        "top_level": top_metrics,
        "subtype": subtype_metrics,
        "subtype_subset_size": subtype_subset_size,
        "full_pipeline_test": {
            "soft_routing": {
                "top1_accuracy": float(acc_soft),
                "top3_accuracy": float(top3_soft),
                "top5_accuracy": float(top5_soft),
                "macro_f1": float(f1_soft),
            },
            "hard_routing": {
                "top1_accuracy": float(acc_hard),
                "macro_f1": float(f1_hard),
            },
            "baseline_accuracy": float(baseline_acc),
            "soft_lift_over_baseline_pp": float((acc_soft - baseline_acc) * 100),
        },
    }
    with open(ARTIFACTS / "hierarchical_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nSaved:")
    print(f"  {ARTIFACTS / 'hierarchical_model.joblib'}")
    print(f"  {ARTIFACTS / 'hierarchical_metrics.json'}")
    print(f"  {ARTIFACTS / 'hierarchical_log.txt'}")

    sys.stdout = sys.__stdout__
    log_file.close()


if __name__ == "__main__":
    main()