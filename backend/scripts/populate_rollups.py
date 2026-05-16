"""Populate beat_rollups from the crimes table.

One big aggregation query. Idempotent: clears prior rollups for the city first.
"""
from __future__ import annotations

import argparse
import sys
import time
import uuid

import psycopg

from app.config import get_settings


def get_city_id(conn: psycopg.Connection, slug: str) -> uuid.UUID:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM cities WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"City '{slug}' not found.")
        return row[0]


def populate(city_slug: str = "chicago") -> None:
    settings = get_settings()
    db_url = settings.database_url.replace("postgresql+psycopg://", "postgresql://")

    with psycopg.connect(db_url) as conn:
        city_id = get_city_id(conn, city_slug)
        print(f"City '{city_slug}': {city_id}")

        with conn.cursor() as cur:
            print("Clearing existing rollups for this city...")
            cur.execute("DELETE FROM beat_rollups WHERE city_id = %s", (city_id,))

            print("Aggregating crimes into beat_rollups (this takes 1-3 minutes)...")
            start = time.time()

            cur.execute(
                """
                INSERT INTO beat_rollups (
                    id, city_id, beat_number, year, month, hour, day_of_week,
                    primary_type, incident_count, arrest_count, domestic_count
                )
                SELECT
                    gen_random_uuid(),
                    city_id,
                    beat,
                    year,
                    EXTRACT(MONTH FROM occurred_at)::int AS month,
                    EXTRACT(HOUR FROM occurred_at)::int AS hour,
                    EXTRACT(ISODOW FROM occurred_at)::int - 1 AS day_of_week,
                    primary_type,
                    count(*) AS incident_count,
                    count(*) FILTER (WHERE arrest = true) AS arrest_count,
                    count(*) FILTER (WHERE domestic = true) AS domestic_count
                FROM crimes
                WHERE city_id = %s
                  AND beat IS NOT NULL
                  AND occurred_at IS NOT NULL
                  AND year IS NOT NULL
                GROUP BY city_id, beat, year, month, hour, day_of_week, primary_type
                """,
                (city_id,),
            )

            inserted = cur.rowcount
            conn.commit()

            elapsed = time.time() - start
            print(f"Inserted {inserted:,} rollup rows in {elapsed:.1f}s")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--city", type=str, default="chicago")
    args = parser.parse_args()
    populate(args.city)


if __name__ == "__main__":
    main()