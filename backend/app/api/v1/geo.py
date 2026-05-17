"""Geographic data endpoints — beat polygons, community area polygons.

These shapes are static (don't change). Cached via Cache-Control header
for fast subsequent map loads.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import text

from app.db import SessionLocal


router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/beats")
def get_beats_geojson(
    response: Response,
    city_slug: str = Query("chicago"),
):
    """Return all beat polygons as a GeoJSON FeatureCollection."""
    sql = text("""
        SELECT
            b.beat_number,
            b.district,
            ST_AsGeoJSON(b.geom)::json AS geometry
        FROM beats b
        JOIN cities c ON c.id = b.city_id
        WHERE c.slug = :city_slug
        ORDER BY b.beat_number
    """)

    with SessionLocal() as session:
        rows = session.execute(sql, {"city_slug": city_slug}).fetchall()

    if not rows:
        raise HTTPException(404, f"No beats found for city '{city_slug}'")

    features = [
        {
            "type": "Feature",
            "id": r.beat_number,
            "properties": {
                "beat_number": r.beat_number,
                "district": r.district,
            },
            "geometry": r.geometry,
        }
        for r in rows
    ]

    response.headers["Cache-Control"] = "public, max-age=3600"
    return {"type": "FeatureCollection", "features": features}


@router.get("/community_areas")
def get_community_areas_geojson(
    response: Response,
    city_slug: str = Query("chicago"),
):
    """Return all community area polygons as a GeoJSON FeatureCollection."""
    sql = text("""
        SELECT
            ca.area_number,
            ca.name,
            ST_AsGeoJSON(ca.geom)::json AS geometry
        FROM community_areas ca
        JOIN cities c ON c.id = ca.city_id
        WHERE c.slug = :city_slug
        ORDER BY ca.area_number
    """)

    with SessionLocal() as session:
        rows = session.execute(sql, {"city_slug": city_slug}).fetchall()

    if not rows:
        raise HTTPException(404, f"No community areas found for city '{city_slug}'")

    features = [
        {
            "type": "Feature",
            "id": r.area_number,
            "properties": {
                "area_number": r.area_number,
                "name": r.name,
            },
            "geometry": r.geometry,
        }
        for r in rows
    ]

    response.headers["Cache-Control"] = "public, max-age=3600"
    return {"type": "FeatureCollection", "features": features}