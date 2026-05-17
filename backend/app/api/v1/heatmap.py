"""Heatmap data endpoint.

Returns aggregated incident counts per beat with optional filters.
Backed by the beat_rollups table (pre-aggregated) for performance.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from app.db import SessionLocal
from app.schemas.heatmap import (
    BeatHeatmapCell,
    CrimeTypeOption,
    HeatmapResponse,
)


router = APIRouter(prefix="/heatmap", tags=["heatmap"])


@router.get("", response_model=HeatmapResponse)
def get_heatmap(
    city_slug: str = Query("chicago"),
    year: Optional[int] = Query(None, description="Filter to a specific year"),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    hour_min: int = Query(0, ge=0, le=23),
    hour_max: int = Query(23, ge=0, le=23),
    primary_type: Optional[str] = Query(None, description="e.g. THEFT, BATTERY"),
):
    """Return per-beat aggregated counts for the given filters.

    Fast: uses ix_beat_rollups_heatmap_query composite index. ~15ms typical.
    """
    if hour_max < hour_min:
        raise HTTPException(400, "hour_max must be >= hour_min")
    if year is not None and (year_from is not None or year_to is not None):
        raise HTTPException(400, "Use either 'year' or 'year_from/year_to', not both")

    where_clauses = [
        "c.slug = :city_slug",
        "br.hour BETWEEN :hour_min AND :hour_max",
    ]
    params: dict = {
        "city_slug": city_slug,
        "hour_min": hour_min,
        "hour_max": hour_max,
    }

    if year is not None:
        where_clauses.append("br.year = :year")
        params["year"] = year
    elif year_from is not None or year_to is not None:
        if year_from is not None:
            where_clauses.append("br.year >= :year_from")
            params["year_from"] = year_from
        if year_to is not None:
            where_clauses.append("br.year <= :year_to")
            params["year_to"] = year_to

    if primary_type is not None:
        where_clauses.append("br.primary_type = :primary_type")
        params["primary_type"] = primary_type

    sql = text(f"""
        SELECT
            br.beat_number,
            SUM(br.incident_count)::int AS incident_count,
            SUM(br.arrest_count)::int AS arrest_count,
            SUM(br.domestic_count)::int AS domestic_count
        FROM beat_rollups br
        JOIN cities c ON c.id = br.city_id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY br.beat_number
        ORDER BY br.beat_number
    """)

    with SessionLocal() as session:
        rows = session.execute(sql, params).fetchall()

    if not rows:
        return HeatmapResponse(
            city_slug=city_slug,
            filters={
                "year": year, "year_from": year_from, "year_to": year_to,
                "hour_min": hour_min, "hour_max": hour_max,
                "primary_type": primary_type,
            },
            beats=[],
            total_incidents=0,
            max_beat_incidents=0,
        )

    beats = [
        BeatHeatmapCell(
            beat_number=r.beat_number,
            incident_count=r.incident_count,
            arrest_count=r.arrest_count,
            domestic_count=r.domestic_count,
        )
        for r in rows
    ]
    total = sum(b.incident_count for b in beats)
    max_count = max(b.incident_count for b in beats)

    return HeatmapResponse(
        city_slug=city_slug,
        filters={
            "year": year, "year_from": year_from, "year_to": year_to,
            "hour_min": hour_min, "hour_max": hour_max,
            "primary_type": primary_type,
        },
        beats=beats,
        total_incidents=total,
        max_beat_incidents=max_count,
    )


@router.get("/crime_types", response_model=list[CrimeTypeOption])
def get_crime_types(city_slug: str = Query("chicago")):
    """Return all crime types in the city, sorted by frequency. For the filter dropdown."""
    sql = text("""
        SELECT
            br.primary_type,
            SUM(br.incident_count)::int AS incident_count
        FROM beat_rollups br
        JOIN cities c ON c.id = br.city_id
        WHERE c.slug = :city_slug AND br.primary_type IS NOT NULL
        GROUP BY br.primary_type
        ORDER BY incident_count DESC
    """)
    with SessionLocal() as session:
        rows = session.execute(sql, {"city_slug": city_slug}).fetchall()
    return [
        CrimeTypeOption(primary_type=r.primary_type, incident_count=r.incident_count)
        for r in rows
    ]