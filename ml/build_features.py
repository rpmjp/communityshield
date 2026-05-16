"""Build training-ready feature dataframe from the crimes table.

DATA DICTIONARY
---------------
Identifiers (dropped before training):
    occurred_at     timestamp of incident
    year            int year

Target candidates:
    primary_type    str, multiclass target (e.g. THEFT, BATTERY, ASSAULT)
    arrest          int8 {0,1}, binary target
    domestic        int8 {0,1}, binary target

Features (used for training):
    hour            int8 [0,23]
    day_of_week     int8 [0,6], 0=Monday
    month           int8 [1,12]
    is_weekend      int8 {0,1}
    quarter         int8 [1,4]
    shift           int8 {0,1,2}, 0=Day(7-15), 1=Evening(15-23), 2=Midnight(23-7)
    beat_num        Int32, police beat number
    district        str, police district
    community_area  int, Chicago community area code [1-77]
    latitude        float64
    longitude       float64

Split column:
    split           str {train,val,test}
      train: 2015-2023  (~2.2M rows)
      val:   2024       (~260K rows)
      test:  2025-2026  (~260K rows)

NO TEMPORAL LEAKAGE: years are strictly partitioned. Model never sees future
data during training. Validation hyperparameter tuning uses 2024 only. Final
metrics reported on 2025-2026 holdout test set.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine


ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def get_db_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set in .env")
    return url


def fetch_crimes(city_slug: str, min_year: int = 2015) -> pd.DataFrame:
    sql = """
        SELECT
            c.occurred_at,
            c.year,
            c.primary_type,
            c.arrest,
            c.domestic,
            c.beat,
            c.district,
            c.community_area,
            c.latitude,
            c.longitude
        FROM crimes c
        JOIN cities ct ON ct.id = c.city_id
        WHERE ct.slug = %(slug)s
          AND c.year >= %(min_year)s
          AND c.occurred_at IS NOT NULL
          AND c.latitude IS NOT NULL
          AND c.longitude IS NOT NULL
          AND c.beat IS NOT NULL
    """
    print(f"Querying crimes for city '{city_slug}', year >= {min_year}...")
    start = time.time()
    engine = create_engine(get_db_url())
    df = pd.read_sql(sql, engine, params={"slug": city_slug, "min_year": min_year})
    print(f"  Pulled {len(df):,} rows in {time.time() - start:.1f}s")
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    print("Engineering features...")
    df = df.copy()

    df["hour"] = df["occurred_at"].dt.hour.astype("int8")
    df["day_of_week"] = df["occurred_at"].dt.dayofweek.astype("int8")
    df["month"] = df["occurred_at"].dt.month.astype("int8")
    df["is_weekend"] = (df["day_of_week"] >= 5).astype("int8")
    df["quarter"] = df["occurred_at"].dt.quarter.astype("int8")

    def shift(h):
        if 7 <= h < 15:
            return 0
        if 15 <= h < 23:
            return 1
        return 2
    df["shift"] = df["hour"].apply(shift).astype("int8")

    df["beat_num"] = pd.to_numeric(df["beat"], errors="coerce").astype("Int32")

    df["arrest"] = df["arrest"].fillna(False).astype("int8")
    df["domestic"] = df["domestic"].fillna(False).astype("int8")

    before = len(df)
    df = df.dropna(subset=["primary_type", "beat_num", "community_area"])
    print(f"  Dropped {before - len(df):,} rows with missing essentials, kept {len(df):,}")
    return df


def temporal_split(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["split"] = "train"
    df.loc[df["year"] == 2024, "split"] = "val"
    df.loc[df["year"] >= 2025, "split"] = "test"
    return df


def quality_report(df: pd.DataFrame) -> None:
    """Print a data quality report for the dataset. Confirms no leakage."""
    print("\n" + "=" * 60)
    print("DATA QUALITY REPORT")
    print("=" * 60)

    # Split sizes
    print("\nSplit sizes (no overlap, temporal partition):")
    for split in ["train", "val", "test"]:
        sub = df[df["split"] == split]
        year_min = sub["year"].min() if len(sub) else None
        year_max = sub["year"].max() if len(sub) else None
        print(f"  {split:<5} {len(sub):>10,} rows  years {year_min}-{year_max}")

    # Leakage check
    train_years = set(df[df["split"] == "train"]["year"].unique())
    val_years = set(df[df["split"] == "val"]["year"].unique())
    test_years = set(df[df["split"] == "test"]["year"].unique())
    overlap_tv = train_years & val_years
    overlap_tt = train_years & test_years
    overlap_vt = val_years & test_years
    print(f"\nLeakage check (must all be empty):")
    print(f"  train ∩ val:  {overlap_tv if overlap_tv else 'empty ✓'}")
    print(f"  train ∩ test: {overlap_tt if overlap_tt else 'empty ✓'}")
    print(f"  val   ∩ test: {overlap_vt if overlap_vt else 'empty ✓'}")

    # Class balance for each target
    print("\nTarget class balance (train split only):")
    train = df[df["split"] == "train"]

    print("\n  primary_type (multiclass, top 10):")
    for ptype, n in train["primary_type"].value_counts().head(10).items():
        pct = n / len(train) * 100
        print(f"    {ptype:<35} {n:>10,}  ({pct:>5.2f}%)")

    print(f"\n  arrest (binary): {train['arrest'].sum() / len(train) * 100:.2f}% positive")
    print(f"  domestic (binary): {train['domestic'].sum() / len(train) * 100:.2f}% positive")

    # Missing rate per feature column
    feature_cols = ["hour", "day_of_week", "month", "is_weekend", "quarter",
                    "shift", "beat_num", "district", "community_area",
                    "latitude", "longitude"]
    print("\nFeature missing rate (full dataset):")
    for col in feature_cols:
        if col in df.columns:
            missing = df[col].isna().sum()
            pct = missing / len(df) * 100
            flag = "" if pct == 0 else f"  ⚠ {pct:.2f}%"
            print(f"  {col:<20} {missing:>8,} missing{flag}")

    print("=" * 60 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--city", type=str, default="chicago")
    parser.add_argument("--min-year", type=int, default=2015)
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).parent / "features.parquet")
    args = parser.parse_args()

    df = fetch_crimes(args.city, args.min_year)
    df = engineer_features(df)
    df = temporal_split(df)
    quality_report(df)

    # Cast district to string (Postgres can return Decimal/str mix), drop occurred_at
    # before saving — we don't want it as a feature, and pyarrow doesn't like UUIDs/objects.
    df["district"] = df["district"].astype(str)
    df = df.drop(columns=["occurred_at", "beat"])

    print(f"Saving to {args.output}...")
    df.to_parquet(args.output, index=False, compression="snappy")
    size_mb = args.output.stat().st_size / 1024 / 1024
    print(f"  Wrote {size_mb:.1f} MB  ({len(df):,} rows, {len(df.columns)} columns)")


if __name__ == "__main__":
    main()