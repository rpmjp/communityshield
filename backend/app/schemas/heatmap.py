"""Pydantic schemas for heatmap and beat data endpoints."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class BeatHeatmapCell(BaseModel):
    """One row of the heatmap: a beat and its aggregated incident count."""
    beat_number: str
    incident_count: int
    arrest_count: int
    domestic_count: int


class HeatmapResponse(BaseModel):
    """Heatmap data for the whole city with the applied filters echoed back."""
    city_slug: str
    filters: dict
    beats: list[BeatHeatmapCell]
    total_incidents: int
    max_beat_incidents: int  # for normalizing the color scale on the frontend


class CrimeTypeOption(BaseModel):
    """A crime type the user can filter by."""
    primary_type: str
    incident_count: int  # in full rollup (for display)