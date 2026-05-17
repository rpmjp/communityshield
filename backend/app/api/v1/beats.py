"""Beat detail endpoint — stats for a single beat for the side panel."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from app.db import SessionLocal


router = APIRouter(prefix="/beats", tags=["beats"])


@router.get("/{beat_number}")
def get_beat_detail(
    beat_number: str,
    city_slug: str = Query("chicago"),
    year: Optional[int] = Query(2024, description="Reference year for stats"),
):
    """Return beat polygon + recent stats + top crime types.

    Used by the side panel when a beat is selected on the map.
    """
    # Beat polygon
    beat_sql = text("""
        SELECT
            b.beat_number,
            b.district,
            ST_AsGeoJSON(b.geom)::json AS geometry,
            ST_Y(ST_Centroid(b.geom)) AS center_lat,
            ST_X(ST_Centroid(b.geom)) AS center_lng,
            (ST_Area(b.geom::geography) / 1000000)::float AS area_sq_km
        FROM beats b
        JOIN cities c ON c.id = b.city_id
        WHERE c.slug = :city_slug AND b.beat_number = :beat_number
    """)

    with SessionLocal() as session:
        beat = session.execute(beat_sql, {
            "city_slug": city_slug, "beat_number": beat_number
        }).fetchone()

        if not beat:
            raise HTTPException(404, f"Beat '{beat_number}' not found")

        # Yearly totals
        year_sql = text("""
            SELECT
                SUM(incident_count)::int AS total_incidents,
                SUM(arrest_count)::int AS total_arrests,
                SUM(domestic_count)::int AS total_domestic
            FROM beat_rollups br
            JOIN cities c ON c.id = br.city_id
            WHERE c.slug = :city_slug
              AND br.beat_number = :beat_number
              AND br.year = :year
        """)
        year_stats = session.execute(year_sql, {
            "city_slug": city_slug, "beat_number": beat_number, "year": year
        }).fetchone()

        # Top 5 crime types for the year
        types_sql = text("""
            SELECT
                br.primary_type,
                SUM(br.incident_count)::int AS incidents
            FROM beat_rollups br
            JOIN cities c ON c.id = br.city_id
            WHERE c.slug = :city_slug
              AND br.beat_number = :beat_number
              AND br.year = :year
              AND br.primary_type IS NOT NULL
            GROUP BY br.primary_type
            ORDER BY incidents DESC
            LIMIT 5
        """)
        top_types = session.execute(types_sql, {
            "city_slug": city_slug, "beat_number": beat_number, "year": year
        }).fetchall()

        # Hour-of-day breakdown (24 values)
        hour_sql = text("""
            SELECT
                br.hour,
                SUM(br.incident_count)::int AS incidents
            FROM beat_rollups br
            JOIN cities c ON c.id = br.city_id
            WHERE c.slug = :city_slug
              AND br.beat_number = :beat_number
              AND br.year = :year
            GROUP BY br.hour
            ORDER BY br.hour
        """)
        hour_rows = session.execute(hour_sql, {
            "city_slug": city_slug, "beat_number": beat_number, "year": year
        }).fetchall()

    hour_distribution = [0] * 24
    for r in hour_rows:
        hour_distribution[r.hour] = r.incidents

    total = year_stats.total_incidents or 0 if year_stats else 0
    arrests = year_stats.total_arrests or 0 if year_stats else 0
    domestic = year_stats.total_domestic or 0 if year_stats else 0

    return {
        "beat_number": beat.beat_number,
        "district": beat.district,
        "center": {"lat": beat.center_lat, "lng": beat.center_lng},
        "area_sq_km": round(beat.area_sq_km, 2),
        "geometry": beat.geometry,
        "year": year,
        "stats": {
            "total_incidents": total,
            "total_arrests": arrests,
            "total_domestic": domestic,
            "arrest_rate": round(arrests / total, 4) if total > 0 else 0.0,
            "domestic_rate": round(domestic / total, 4) if total > 0 else 0.0,
        },
        "top_crime_types": [
            {"primary_type": r.primary_type, "incidents": r.incidents}
            for r in top_types
        ],
        "hour_distribution": hour_distribution,
    }