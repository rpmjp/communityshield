"""Phase 4B+ — Hyperparameter tuning for the property-binary XGBoost model.

Uses Optuna (TPE sampler) over a 100-trial budget with time-series cross-
validation on the train set (2015-2023). Each fold trains on earlier years,
validates on a later year — preserves temporal ordering, no leakage.

Final result: best hyperparameters by mean CV ROC-AUC, then a full retrain on
train+val, then evaluation on the test holdout (2025-2026).

Usage:
    python tune_property_binary.py --trials 100
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import optuna
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    roc_auc_score,
    roc_curve,
)


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)


SUPERCATEGORY_MAP = {
    "HOMICIDE": "violent", "BATTERY": "violent", "ASSAULT": "violent",
    "ROBBERY": "violent", "CRIMINAL SEXUAL ASSAULT": "violent",
    "CRIM SEXUAL ASSAULT": "violent", "SEX OFFENSE": "violent",
    "KIDNAPPING": "violent", "INTIMIDATION": "violent", "STALKING": "violent",
    "OFFENSE INVOLVING CHILDREN": "violent",
    "THEFT": "property", "BURGLARY": "property", "MOTOR VEHICLE THEFT": "property",
    "DECEPTIVE PRACTICE": "property", "CRIMINAL DAMAGE": "property",
    "CRIMINAL TRESPASS": "property", "ARSON": "property",
    "NARCOTICS": "drug", "OTHER NARCOTIC VIOLATION": "drug",
    "LIQUOR LAW VIOLATION": "drug", "GAMBLING": "drug",
    "WEAPONS VIOLATION": "other", "CONCEALED CARRY LICENSE VIOLATION": "other",
    "PUBLIC PEACE VIOLATION": "other", "INTERFERENCE WITH PUBLIC OFFICER": "other",
    "PROSTITUTION": "other", "OTHER OFFENSE": "other", "PUBLIC INDECENCY": "other",
    "OBSCENITY": "other", "NON-CRIMINAL": "other", "NON - CRIMINAL": "other",
    "RITUALISM": "other", "HUMAN TRAFFICKING": "other",
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
    df["supercategory"] = df["primary_type"].map(SUPERCATEGORY_MAP).fillna("other")
    df["target"] = np.where(df["supercategory"] == "property", 1, 0).astype("int8")
    return df


def build_encoders(train_df):
    district_map = {d: i for i, d in enumerate(
        sorted(train_df[DISTRICT_COL].astype(str).unique()))}
    location_map = {l: i for i, l in enumerate(
        sorted(train_df[LOCATION_COL].astype(str).unique()))}
    return district_map, location_map


def to_xy(df, district_map, location_map):
    d = df.copy()
    d["district_enc"] = (
        d[DISTRICT_COL].astype(str).map(district_map).fillna(-1).astype("int32")
    )
    d["location_enc"] = (
        d[LOCATION_COL].astype(str).map(location_map).fillna(-1).astype("int32")
    )
    cols = FEATURE_COLS + ["district_enc", "location_enc"]
    return d[cols].astype("float32").values, d["target"].values.astype("int32"), cols


def sqrt_inverse_freq_weights(y: np.ndarray) -> np.ndarray:
    counts = np.bincount(y, minlength=2)
    inv = np.sqrt(len(y) / (2 * counts.clip(min=1)))
    return inv[y].astype("float32")


# ------------------------------------------------------------------
# Time-series cross-validation: 5 expanding folds within train years
# Train years are 2015-2023 (9 years).
# Fold 1: train 2015-2018, val 2019
# Fold 2: train 2015-2019, val 2020
# Fold 3: train 2015-2020, val 2021
# Fold 4: train 2015-2021, val 2022
# Fold 5: train 2015-2022, val 2023
# ------------------------------------------------------------------

TS_FOLDS = [
    ([2015, 2016, 2017, 2018],       2019),
    ([2015, 2016, 2017, 2018, 2019], 2020),
    ([2015, 2016, 2017, 2018, 2019, 2020], 2021),
    ([2015, 2016, 2017, 2018, 2019, 2020, 2021], 2022),
    ([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022], 2023),
]


def objective(trial, train_df, district_map, location_map, device="cuda"):
    """One Optuna trial. Returns mean CV ROC-AUC across 5 time-series folds."""
    params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "tree_method": "hist",
        "device": device,
        "verbosity": 0,
        "seed": 42,
        "max_depth": trial.suggest_int("max_depth", 4, 12),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        "min_child_weight": trial.suggest_int("min_child_weight", 1, 50),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
        "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
        "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
        "gamma": trial.suggest_float("gamma", 0.0, 5.0),
    }
    n_estimators = trial.suggest_int("n_estimators", 200, 800)

    fold_aucs = []
    for fold_idx, (train_years, val_year) in enumerate(TS_FOLDS):
        fold_tr = train_df[train_df["year"].isin(train_years)]
        fold_va = train_df[train_df["year"] == val_year]

        X_tr, y_tr, _ = to_xy(fold_tr, district_map, location_map)
        X_va, y_va, _ = to_xy(fold_va, district_map, location_map)
        w_tr = sqrt_inverse_freq_weights(y_tr)

        dtrain = xgb.DMatrix(X_tr, label=y_tr, weight=w_tr)
        dval = xgb.DMatrix(X_va, label=y_va)

        booster = xgb.train(
            params,
            dtrain,
            num_boost_round=n_estimators,
            evals=[(dval, "val")],
            early_stopping_rounds=30,
            verbose_eval=False,
        )
        proba = booster.predict(xgb.DMatrix(X_va))
        auc = roc_auc_score(y_va, proba)
        fold_aucs.append(auc)

        # Optuna pruning: if first 2 folds are terrible, stop early
        trial.report(np.mean(fold_aucs), step=fold_idx)
        if trial.should_prune():
            raise optuna.TrialPruned()

    return float(np.mean(fold_aucs))


def evaluate_test(booster, X, y, label):
    proba = booster.predict(xgb.DMatrix(X))
    pred = (proba > 0.5).astype(int)
    acc = accuracy_score(y, pred)
    macro_f1 = f1_score(y, pred, average="macro", zero_division=0)
    auc = roc_auc_score(y, proba)
    majority = int(np.bincount(y).argmax())
    baseline_acc = accuracy_score(y, np.full_like(y, majority))

    print(f"\n  {label}  acc={acc:.4f} (base {baseline_acc:.4f}, lift +{(acc-baseline_acc)*100:.2f}pp) "
          f"macro_f1={macro_f1:.4f}  roc_auc={auc:.4f}")
    print("\n" + classification_report(y, pred,
        target_names=["not_property", "property"], digits=3, zero_division=0))
    return {
        "split": label,
        "n_rows": int(len(y)),
        "accuracy": float(acc),
        "macro_f1": float(macro_f1),
        "roc_auc": float(auc),
        "baseline_accuracy": float(baseline_acc),
        "lift_over_baseline_pp": float((acc - baseline_acc) * 100),
    }, proba


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trials", type=int, default=100,
                        help="Number of Optuna trials")
    parser.add_argument("--timeout", type=int, default=None,
                        help="Max seconds for tuning (overrides --trials if exceeded)")
    parser.add_argument("--device", type=str, default="cuda")
    args = parser.parse_args()

    log_path = ARTIFACTS / "tune_log.txt"
    log_file = open(log_path, "w")
    sys.stdout = Tee(sys.__stdout__, log_file)

    print(f"Phase 4B+ — Optuna hyperparameter tuning for property-binary XGBoost")
    print(f"Trials: {args.trials}  Device: {args.device}")
    print(f"CV: 5-fold time-series (expanding window)")
    print(f"Optimizing: mean CV ROC-AUC\n")

    print("Loading features...")
    df = load_features()
    train_df = df[df["split"] == "train"].copy()
    val_df = df[df["split"] == "val"].copy()
    test_df = df[df["split"] == "test"].copy()

    print(f"  train: {len(train_df):,}  val: {len(val_df):,}  test: {len(test_df):,}")

    # Encoders fit on train only
    district_map, location_map = build_encoders(train_df)
    print(f"  Encoders: {len(district_map)} districts, {len(location_map)} location_groups")

    # ----- Optuna study -----
    print("\n" + "=" * 80)
    print("RUNNING OPTUNA STUDY")
    print("=" * 80)

    optuna.logging.set_verbosity(optuna.logging.WARNING)

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=42, n_startup_trials=10),
        pruner=optuna.pruners.MedianPruner(n_startup_trials=10, n_warmup_steps=2),
        study_name="property_binary_xgb",
    )

    def callback(study, trial):
        if trial.state == optuna.trial.TrialState.COMPLETE:
            best = study.best_value
            current = trial.value
            print(f"  Trial {trial.number:>3} | "
                  f"this={current:.4f} | best={best:.4f} | "
                  f"params={trial.params}")
        elif trial.state == optuna.trial.TrialState.PRUNED:
            print(f"  Trial {trial.number:>3} | PRUNED")

    start = time.time()
    study.optimize(
        lambda t: objective(t, train_df, district_map, location_map, args.device),
        n_trials=args.trials,
        timeout=args.timeout,
        callbacks=[callback],
        show_progress_bar=False,
    )
    tune_time = time.time() - start

    print(f"\nTuning done in {tune_time/60:.1f} min")
    print(f"Trials completed: {len([t for t in study.trials if t.state == optuna.trial.TrialState.COMPLETE])}")
    print(f"Trials pruned:    {len([t for t in study.trials if t.state == optuna.trial.TrialState.PRUNED])}")
    print(f"Best CV ROC-AUC:  {study.best_value:.4f}")
    print(f"Best params:")
    for k, v in study.best_params.items():
        print(f"  {k}: {v}")

    # ----- Retrain best on full train+val, evaluate on test -----
    print("\n" + "=" * 80)
    print("FINAL MODEL: retrain best config on train + val, eval on test")
    print("=" * 80)

    full_train = pd.concat([train_df, val_df], ignore_index=True)
    X_full, y_full, feature_cols = to_xy(full_train, district_map, location_map)
    X_test, y_test, _ = to_xy(test_df, district_map, location_map)
    w_full = sqrt_inverse_freq_weights(y_full)

    best_params = study.best_params.copy()
    n_estimators = best_params.pop("n_estimators")
    final_params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "tree_method": "hist",
        "device": args.device,
        "verbosity": 0,
        "seed": 42,
        **best_params,
    }

    print(f"\nTraining final model on {len(X_full):,} rows for {n_estimators} rounds...")
    start = time.time()
    dfull = xgb.DMatrix(X_full, label=y_full, weight=w_full)
    final_booster = xgb.train(final_params, dfull, num_boost_round=n_estimators,
                              verbose_eval=False)
    final_time = time.time() - start
    print(f"Trained in {final_time:.1f}s")

    test_metrics, test_proba = evaluate_test(final_booster, X_test, y_test, "test")

    # ----- Compare against the default-config baseline -----
    print("\n" + "=" * 80)
    print("COMPARISON: tuned vs default XGBoost")
    print("=" * 80)
    default_metrics_path = ARTIFACTS / "model_comparison_metrics.json"
    if default_metrics_path.exists():
        with open(default_metrics_path) as f:
            default = json.load(f)
        if "xgboost" in default:
            d = default["xgboost"]["test"]
            print(f"\n{'metric':<20} {'default':>12} {'tuned':>12} {'delta':>12}")
            print("-" * 60)
            for k in ["accuracy", "macro_f1", "roc_auc"]:
                d_v = d[k]
                t_v = test_metrics[k]
                print(f"{k:<20} {d_v:>12.4f} {t_v:>12.4f} {t_v-d_v:>+12.4f}")
        else:
            print("(no prior default XGBoost run found)")
    else:
        print("(model_comparison_metrics.json not found)")

    # ----- Save artifacts -----
    bundle = {
        "model": final_booster,
        "feature_cols": feature_cols,
        "district_map": district_map,
        "location_map": location_map,
        "best_params": study.best_params,
        "n_estimators": n_estimators,
        "study_best_cv_auc": float(study.best_value),
        "test_metrics": test_metrics,
        "tune_seconds": tune_time,
        "n_trials": len(study.trials),
    }
    joblib.dump(bundle, ARTIFACTS / "property_binary_xgb_tuned.joblib")

    with open(ARTIFACTS / "property_binary_tuned_metrics.json", "w") as f:
        json.dump({
            "model": "property_binary_xgb_tuned",
            "best_params": study.best_params,
            "n_estimators": n_estimators,
            "study_best_cv_auc": float(study.best_value),
            "test": test_metrics,
            "tune_seconds": tune_time,
            "n_trials": len(study.trials),
            "n_completed_trials": len([t for t in study.trials
                                       if t.state == optuna.trial.TrialState.COMPLETE]),
            "n_pruned_trials": len([t for t in study.trials
                                    if t.state == optuna.trial.TrialState.PRUNED]),
        }, f, indent=2)

    fpr, tpr, _ = roc_curve(y_test, test_proba)
    pd.DataFrame({"fpr": fpr, "tpr": tpr}).to_csv(
        ARTIFACTS / "xgb_tuned_roc_test.csv", index=False
    )

    # Save the Optuna study itself for later inspection
    joblib.dump(study, ARTIFACTS / "property_binary_optuna_study.joblib")

    print(f"\nSaved:")
    print(f"  {ARTIFACTS / 'property_binary_xgb_tuned.joblib'}")
    print(f"  {ARTIFACTS / 'property_binary_tuned_metrics.json'}")
    print(f"  {ARTIFACTS / 'xgb_tuned_roc_test.csv'}")
    print(f"  {ARTIFACTS / 'property_binary_optuna_study.joblib'}")

    sys.stdout = sys.__stdout__
    log_file.close()


if __name__ == "__main__":
    main()