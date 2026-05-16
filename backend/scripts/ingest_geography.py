"""Ingest community area and police beat polygons into Postgres.

Reads two GeoJSON files (Chicago community areas and police beats),
transforms them into PostGIS-ready rows, and bulk-inserts into the
community_areas and beats tables.

Usage:
    python -m scripts.ingest_geography \\
        --community-areas /path/to/community_areas.geojson \\
        --police-beats /path/to/police_beats.geojson
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path
from typing import Optional

import psycopg

from app.config import get_settings


def get_city_id(conn: psycopg.Connection, slug: str) -> uuid.UUID:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM cities WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"City with slug '{slug}' not found. Seed it first.")
        return row[0]


def geom_to_ewkt(geometry: dict) -> Optional[str]:
    """Convert a GeoJSON geometry dict to PostGIS EWKT format (SRID=4326).

    PostGIS expects MULTIPOLYGON. If the input is POLYGON, wrap it.
    """
    if not geometry:
        return None

    geom_type = geometry.get("type")
    coords = geometry.get("coordinates")

    if not coords:
        return None

    # Re-emit as plain GeoJSON for ST_GeomFromGeoJSON
    geojson_str = json.dumps(geometry)
    return geojson_str


def ingest_community_areas(
    conn: psycopg.Connection,
    city_id: uuid.UUID,
    geojson_path: Path,
) -> int:
    """Insert community areas. Returns count inserted."""
    with open(geojson_path, "r") as f:
        data = json.load(f)

    features = data.get("features", [])
    inserted = 0

    with conn.cursor() as cur:
        # Clear existing community areas for this city (idempotent re-runs)
        cur.execute("DELETE FROM community_areas WHERE city_id = %s", (city_id,))

        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry")

            # Field names from the thisisdaryn mirror
            area_num = props.get("area_numbe") or props.get("area_num_1") or props.get("AREA_NUMBE")
            name = props.get("community") or props.get("COMMUNITY")

            if not area_num or not name:
                continue

            try:
                area_num = int(area_num)
            except (ValueError, TypeError):
                continue

            geom_json = geom_to_ewkt(geom)

            cur.execute(
                """
                INSERT INTO community_areas (id, city_id, area_number, name, geom)
                VALUES (%s, %s, %s, %s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
                """,
                (str(uuid.uuid4()), str(city_id), area_num, name, geom_json),
            )
            inserted += 1

        conn.commit()

    return inserted


def ingest_beats(
    conn: psycopg.Connection,
    city_id: uuid.UUID,
    geojson_path: Path,
) -> int:
    """Insert police beats. Returns count inserted."""
    with open(geojson_path, "r") as f:
        data = json.load(f)

    features = data.get("features", [])
    inserted = 0

    with conn.cursor() as cur:
        cur.execute("DELETE FROM beats WHERE city_id = %s", (city_id,))

        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry")

            # Field names from the CPD ArcGIS dataset
            beat_num = props.get("BEAT_NUMBE") or props.get("beat_num") or props.get("beat_numbe")
            district = props.get("DISTRICT") or props.get("district")

            if not beat_num:
                continue

            beat_num = str(beat_num).strip()
            district = str(district).strip() if district else None

            geom_json = geom_to_ewkt(geom)

            cur.execute(
                """
                INSERT INTO beats (id, city_id, beat_number, district, geom)
                VALUES (%s, %s, %s, %s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
                """,
                (str(uuid.uuid4()), str(city_id), beat_num, district, geom_json),
            )
            inserted += 1

        conn.commit()

    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Chicago geography polygons.")
    parser.add_argument("--community-areas", type=Path, required=True)
    parser.add_argument("--police-beats", type=Path, required=True)
    parser.add_argument("--city", type=str, default="chicago")
    args = parser.parse_args()

    for path in [args.community_areas, args.police_beats]:
        if not path.exists():
            print(f"ERROR: file not found: {path}", file=sys.stderr)
            sys.exit(1)

    settings = get_settings()
    db_url = settings.database_url.replace("postgresql+psycopg://", "postgresql://")

    print("Connecting to database...")
    with psycopg.connect(db_url) as conn:
        city_id = get_city_id(conn, args.city)
        print(f"City '{args.city}': {city_id}")

        print(f"Ingesting community areas from {args.community_areas}...")
        ca_count = ingest_community_areas(conn, city_id, args.community_areas)
        print(f"  Inserted {ca_count} community areas")

        print(f"Ingesting police beats from {args.police_beats}...")
        beat_count = ingest_beats(conn, city_id, args.police_beats)
        print(f"  Inserted {beat_count} police beats")

    print("\nDone.")


if __name__ == "__main__":
    main()