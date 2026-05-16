"""Pydantic schemas for ML prediction endpoints."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class PredictionFeatures(BaseModel):
    """Input features for any prediction endpoint."""
    hour: int = Field(..., ge=0, le=23, description="Hour of day, 0-23")
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    month: int = Field(..., ge=1, le=12)
    beat_num: int = Field(..., description="Chicago police beat number")
    community_area: int = Field(..., ge=1, le=77)
    latitude: float
    longitude: float
    district: str = Field(..., description="Chicago police district as string")
    location_group: str = Field("OTHER", description="e.g. STREET, RESIDENCE, APARTMENT")
    primary_type: Optional[str] = Field(None, description="Crime type, required for arrest/domestic")


class BinaryPrediction(BaseModel):
    model: str
    probability: float
    prediction: int
    threshold: float
    label: Optional[str] = None


class CrimeTypePrediction(BaseModel):
    class_name: str = Field(..., alias="class")
    probability: float

    class Config:
        populate_by_name = True


class CrimeTypeResponse(BaseModel):
    model: str
    top_k: list[CrimeTypePrediction]
    supercategory_probabilities: dict[str, float]


class AllPredictionsResponse(BaseModel):
    arrest: BinaryPrediction
    domestic: BinaryPrediction
    property_binary: BinaryPrediction
    crime_type: CrimeTypeResponse