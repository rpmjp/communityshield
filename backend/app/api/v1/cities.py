"""Cities endpoint — list cities currently loaded in the system."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.db import SessionLocal


router = APIRouter(prefix="/cities", tags=["cities"])


@router.get("")
def list_cities():
    """Return all cities with at least one beat loaded.

    Includes the bounding box for each city so the frontend can fly the map
    to the right area when a city is selected.
    """
    sql = text("""
        SELECT
            c.slug,
            c.name,
            COUNT(DISTINCT b.id)::int AS beat_count,
            ST_YMin(ST_Extent(b.geom))::float AS min_lat,
            ST_YMax(ST_Extent(b.geom))::float AS max_lat,
            ST_XMin(ST_Extent(b.geom))::float AS min_lng,
            ST_XMax(ST_Extent(b.geom))::float AS max_lng,
            ST_Y(ST_Centroid(ST_Extent(b.geom)))::float AS center_lat,
            ST_X(ST_Centroid(ST_Extent(b.geom)))::float AS center_lng
        FROM cities c
        LEFT JOIN beats b ON b.city_id = c.id
        GROUP BY c.id, c.slug, c.name
        HAVING COUNT(b.id) > 0
        ORDER BY c.name
    """)
    with SessionLocal() as session:
        rows = session.execute(sql).fetchall()

    return [
        {
            "slug": r.slug,
            "name": r.name,
            "beat_count": r.beat_count,
            "bounds": {
                "min_lat": r.min_lat,
                "max_lat": r.max_lat,
                "min_lng": r.min_lng,
                "max_lng": r.max_lng,
            },
            "center": {"lat": r.center_lat, "lng": r.center_lng},
        }
        for r in rows
    ]