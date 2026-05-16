"""Phase 4D — Arrest + Domestic binary classifiers.

Two models trained in one script with consistent methodology:
    1. ARREST   — was an arrest made? (binary)
    2. DOMESTIC — is this incident domestic-related? (binary)

Both use the same feature set + primary_type as an additional categorical
feature (primary_type is the strongest predictor for arrest: NARCOTICS
nearly always arrests, THEFT rarely does).

Reports: accuracy, macro F1, ROC-AUC, precision/recall, threshold analysis.

Usage:
    python train_arrest_domestic.py
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
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
)


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)


FEATURE_COLS = [
    "hour", "day_of_week", "month", "is_weekend", "quarter", "shift",
    "beat_num", "community_area", "latitude", "longitude",
]
DISTRICT_COL = "district"
LOCATION_COL = "location_group"
TYPE_COL = "primary_type"


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
    return df


def build_encoders(train_df):
    district_map = {d: i for i, d in enumerate(
        sorted(train_df[DISTRICT_COL].astype(str).unique()))}
    location_map = {l: i for i, l in enumerate(
        sorted(train_df[LOCATION_COL].astype(str).unique()))}
    type_map = {t: i for i, t in enumerate(
        sorted(train_df[TYPE_COL].astype(str).unique()))}
    return district_map, location_map, type_map


def to_xy(df, target_col, district_map, location_map, type_map):
    d = df.copy()
    d["district_enc"] = (
        d[DISTRICT_COL].astype(str).map(district_map).fillna(-1).astype("int32")
    )
    d["location_enc"] = (
        d[LOCATION_COL].astype(str).map(location_map).fillna(-1).astype("int32")
    )
    d["type_enc"] = (
        d[TYPE_COL].astype(str).map(type_map).fillna(-1).astype("int32")
    )
    cols = FEATURE_COLS + ["district_enc", "location_enc", "type_enc"]
    X = d[cols].astype("float32").values
    y = d[target_col].values.astype("int32")
    return X, y, cols


def sqrt_weights(y: np.ndarray) -> np.ndarray:
    counts = np.bincount(y, minlength=2)
    inv = np.sqrt(len(y) / (2 * counts.clip(min=1)))
    return inv[y].astype("float32")


class VerboseEval(xgb.callback.TrainingCallback):
    def __init__(self, X_val, y_val, every=25):
        super().__init__()
        self.X_val = X_val
        self.y_val = y_val
        self.every = every

    def after_iteration(self, model, epoch, evals_log):
        if epoch % self.every != 0:
            return False
        proba = model.predict(xgb.DMatrix(self.X_val))
        pred = (proba > 0.5).astype(int)
        acc = accuracy_score(self.y_val, pred)
        auc = roc_auc_score(self.y_val, proba)
        f1 = f1_score(self.y_val, pred, average="macro", zero_division=0)
        cm = confusion_matrix(self.y_val, pred, labels=[0, 1])
        neg_rec = cm[0, 0] / cm[0].sum() if cm[0].sum() > 0 else 0
        pos_rec = cm[1, 1] / cm[1].sum() if cm[1].sum() > 0 else 0
        print(f"  [round {epoch:>3}] acc={acc:.4f}  auc={auc:.4f}  "
              f"macro_f1={f1:.4f}  neg_recall={neg_rec:.3f}  pos_recall={pos_rec:.3f}")
        return False


def train_model(X_tr, y_tr, X_va, y_va, name, args):
    print(f"\n{'='*80}")
    print(f"TRAINING: {name}")
    print(f"  train shape: {X_tr.shape}, val shape: {X_va.shape}")
    print(f"  class balance (train): {y_tr.sum() / len(y_tr) * 100:.2f}% positive")
    print(f"{'='*80}")

    weights = sqrt_weights(y_tr)
    dtrain = xgb.DMatrix(X_tr, label=y_tr, weight=weights)
    dval = xgb.DMatrix(X_va, label=y_va)

    params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "max_depth": args.max_depth,
        "learning_rate": args.learning_rate,
        "tree_method": "hist",
        "device": args.device,
        "verbosity": 0,
        "seed": 42,
        "min_child_weight": 5,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "reg_lambda": 1.0,
    }

    print(f"\nTraining ({args.n_estimators} rounds, log every 25)...")
    start = time.time()
    booster = xgb.train(
        params, dtrain,
        num_boost_round=args.n_estimators,
        evals=[(dval, "val")],
        early_stopping_rounds=40,
        verbose_eval=False,
        callbacks=[VerboseEval(X_va, y_va, every=25)],
    )
    train_time = time.time() - start
    print(f"\nTrained in {train_time:.1f}s, best iter {booster.best_iteration}")
    return booster, train_time


def evaluate(booster, X, y, label):
    print(f"\n--- {label} ---")
    proba = booster.predict(xgb.DMatrix(X))
    pred = (proba > 0.5).astype(int)

    acc = accuracy_score(y, pred)
    macro_f1 = f1_score(y, pred, average="macro", zero_division=0)
    weighted_f1 = f1_score(y, pred, average="weighted", zero_division=0)
    auc = roc_auc_score(y, proba)

    majority = int(np.bincount(y).argmax())
    baseline_acc = accuracy_score(y, np.full_like(y, majority))

    print(f"  accuracy: {acc:.4f}  (baseline {baseline_acc:.4f}, lift +{(acc-baseline_acc)*100:.2f}pp)")
    print(f"  macro_f1: {macro_f1:.4f}")
    print(f"  weighted_f1: {weighted_f1:.4f}")
    print(f"  roc_auc:  {auc:.4f}")

    print(f"\n  per-class report:")
    print(classification_report(y, pred, target_names=["negative", "positive"],
                                digits=3, zero_division=0))

    cm = confusion_matrix(y, pred, labels=[0, 1])
    print(f"  confusion matrix:")
    print(f"    {'':12} {'pred_neg':>10} {'pred_pos':>10}")
    print(f"    {'true_neg':<12} {cm[0,0]:>10,} {cm[0,1]:>10,}")
    print(f"    {'true_pos':<12} {cm[1,0]:>10,} {cm[1,1]:>10,}")

    return {
        "split": label,
        "n_rows": int(len(y)),
        "accuracy": float(acc),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
        "roc_auc": float(auc),
        "baseline_accuracy": float(baseline_acc),
        "lift_over_baseline_pp": float((acc - baseline_acc) * 100),
    }, proba


def threshold_analysis(y_true, proba, label):
    """Show how precision/recall trade off at different decision thresholds."""
    print(f"\n--- Threshold analysis ({label}) ---")
    print(f"  {'threshold':>10} {'precision':>10} {'recall':>10} {'f1':>10} {'accuracy':>10}")
    for thresh in [0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80]:
        pred = (proba > thresh).astype(int)
        tp = ((pred == 1) & (y_true == 1)).sum()
        fp = ((pred == 1) & (y_true == 0)).sum()
        fn = ((pred == 0) & (y_true == 1)).sum()
        tn = ((pred == 0) & (y_true == 0)).sum()
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0
        acc = (tp + tn) / len(y_true)
        print(f"  {thresh:>10.2f} {prec:>10.4f} {rec:>10.4f} {f1:>10.4f} {acc:>10.4f}")


def save_artifacts(booster, district_map, location_map, type_map, feature_cols,
                   model_name, metrics):
    bundle = {
        "model": booster,
        "feature_cols": feature_cols,
        "district_map": district_map,
        "location_map": location_map,
        "type_map": type_map,
    }
    joblib.dump(bundle, ARTIFACTS / f"{model_name}_model.joblib")
    with open(ARTIFACTS / f"{model_name}_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\nSaved {ARTIFACTS / f'{model_name}_model.joblib'}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n-estimators", type=int, default=600)
    parser.add_argument("--max-depth", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=0.1)
    parser.add_argument("--device", type=str, default="cuda")
    args = parser.parse_args()

    log_path = ARTIFACTS / "arrest_domestic_log.txt"
    log_file = open(log_path, "w")
    sys.stdout = Tee(sys.__stdout__, log_file)

    print(f"Phase 4D — Arrest + Domestic binary classifiers")
    print(f"Device: {args.device}\n")

    df = load_features()
    train_df = df[df["split"] == "train"].copy()
    val_df = df[df["split"] == "val"].copy()
    test_df = df[df["split"] == "test"].copy()
    print(f"Loaded: train {len(train_df):,}  val {len(val_df):,}  test {len(test_df):,}")

    district_map, location_map, type_map = build_encoders(train_df)
    print(f"Encoders: {len(district_map)} districts, {len(location_map)} locations, "
          f"{len(type_map)} crime types")

    print(f"\nClass balance:")
    print(f"  arrest:   train {train_df['arrest'].mean()*100:.2f}%  "
          f"val {val_df['arrest'].mean()*100:.2f}%  "
          f"test {test_df['arrest'].mean()*100:.2f}%")
    print(f"  domestic: train {train_df['domestic'].mean()*100:.2f}%  "
          f"val {val_df['domestic'].mean()*100:.2f}%  "
          f"test {test_df['domestic'].mean()*100:.2f}%")

    # ================================
    # MODEL 1: ARREST
    # ================================
    print("\n" + "#" * 80)
    print("# MODEL 1: ARREST PREDICTION")
    print("#" * 80)

    X_tr_a, y_tr_a, fc = to_xy(train_df, "arrest", district_map, location_map, type_map)
    X_va_a, y_va_a, _ = to_xy(val_df, "arrest", district_map, location_map, type_map)
    X_te_a, y_te_a, _ = to_xy(test_df, "arrest", district_map, location_map, type_map)

    arrest_model, arrest_time = train_model(X_tr_a, y_tr_a, X_va_a, y_va_a,
                                             "arrest", args)

    arrest_metrics = {
        "model": "arrest_xgboost",
        "train_seconds": float(arrest_time),
        "best_iteration": int(arrest_model.best_iteration),
        "train": evaluate(arrest_model, X_tr_a, y_tr_a, "train")[0],
        "val": evaluate(arrest_model, X_va_a, y_va_a, "val")[0],
    }
    test_arrest_metrics, arrest_test_proba = evaluate(arrest_model, X_te_a, y_te_a, "test")
    arrest_metrics["test"] = test_arrest_metrics

    threshold_analysis(y_te_a, arrest_test_proba, "arrest")

    fpr, tpr, _ = roc_curve(y_te_a, arrest_test_proba)
    pd.DataFrame({"fpr": fpr, "tpr": tpr}).to_csv(
        ARTIFACTS / "arrest_roc_test.csv", index=False
    )

    save_artifacts(arrest_model, district_map, location_map, type_map, fc,
                   "arrest", arrest_metrics)

    # ================================
    # MODEL 2: DOMESTIC
    # ================================
    print("\n\n" + "#" * 80)
    print("# MODEL 2: DOMESTIC INCIDENT PREDICTION")
    print("#" * 80)

    X_tr_d, y_tr_d, _ = to_xy(train_df, "domestic", district_map, location_map, type_map)
    X_va_d, y_va_d, _ = to_xy(val_df, "domestic", district_map, location_map, type_map)
    X_te_d, y_te_d, _ = to_xy(test_df, "domestic", district_map, location_map, type_map)

    domestic_model, domestic_time = train_model(X_tr_d, y_tr_d, X_va_d, y_va_d,
                                                  "domestic", args)

    domestic_metrics = {
        "model": "domestic_xgboost",
        "train_seconds": float(domestic_time),
        "best_iteration": int(domestic_model.best_iteration),
        "train": evaluate(domestic_model, X_tr_d, y_tr_d, "train")[0],
        "val": evaluate(domestic_model, X_va_d, y_va_d, "val")[0],
    }
    test_domestic_metrics, domestic_test_proba = evaluate(domestic_model, X_te_d, y_te_d, "test")
    domestic_metrics["test"] = test_domestic_metrics

    threshold_analysis(y_te_d, domestic_test_proba, "domestic")

    fpr, tpr, _ = roc_curve(y_te_d, domestic_test_proba)
    pd.DataFrame({"fpr": fpr, "tpr": tpr}).to_csv(
        ARTIFACTS / "domestic_roc_test.csv", index=False
    )

    save_artifacts(domestic_model, district_map, location_map, type_map, fc,
                   "domestic", domestic_metrics)

    # ================================
    # SUMMARY
    # ================================
    print("\n\n" + "#" * 80)
    print("# PHASE 4D SUMMARY")
    print("#" * 80)
    print(f"\n{'model':<15} {'accuracy':>12} {'macro_f1':>12} {'roc_auc':>12} {'train_sec':>12}")
    print("-" * 75)
    print(f"{'arrest':<15} {arrest_metrics['test']['accuracy']:>12.4f} "
          f"{arrest_metrics['test']['macro_f1']:>12.4f} "
          f"{arrest_metrics['test']['roc_auc']:>12.4f} "
          f"{arrest_metrics['train_seconds']:>12.1f}")
    print(f"{'domestic':<15} {domestic_metrics['test']['accuracy']:>12.4f} "
          f"{domestic_metrics['test']['macro_f1']:>12.4f} "
          f"{domestic_metrics['test']['roc_auc']:>12.4f} "
          f"{domestic_metrics['train_seconds']:>12.1f}")

    sys.stdout = sys.__stdout__
    log_file.close()


if __name__ == "__main__":
    main()