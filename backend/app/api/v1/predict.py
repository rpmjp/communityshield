"""ML prediction endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.ml.loader import get_models
from app.ml.predictor import (
    predict_arrest,
    predict_crime_type,
    predict_domestic,
    predict_property_binary,
)
from app.schemas.prediction import (
    AllPredictionsResponse,
    BinaryPrediction,
    CrimeTypeResponse,
    PredictionFeatures,
)


router = APIRouter(prefix="/predict", tags=["predict"])


@router.post("/arrest", response_model=BinaryPrediction)
def arrest_endpoint(
    features: PredictionFeatures,
    threshold: float = Query(0.5, ge=0.0, le=1.0),
):
    return predict_arrest(features.model_dump(), get_models()["arrest"], threshold)


@router.post("/domestic", response_model=BinaryPrediction)
def domestic_endpoint(
    features: PredictionFeatures,
    threshold: float = Query(0.5, ge=0.0, le=1.0),
):
    return predict_domestic(features.model_dump(), get_models()["domestic"], threshold)


@router.post("/property", response_model=BinaryPrediction)
def property_endpoint(
    features: PredictionFeatures,
    threshold: float = Query(0.5, ge=0.0, le=1.0),
):
    return predict_property_binary(
        features.model_dump(), get_models()["property_binary"], threshold
    )


@router.post("/crime_type", response_model=CrimeTypeResponse)
def crime_type_endpoint(
    features: PredictionFeatures,
    top_k: int = Query(5, ge=1, le=27),
):
    return predict_crime_type(
        features.model_dump(), get_models()["hierarchical"], top_k
    )


@router.post("/all", response_model=AllPredictionsResponse)
def all_endpoint(features: PredictionFeatures):
    """Run all four models and return unified response."""
    f = features.model_dump()
    m = get_models()
    return {
        "arrest": predict_arrest(f, m["arrest"]),
        "domestic": predict_domestic(f, m["domestic"]),
        "property_binary": predict_property_binary(f, m["property_binary"]),
        "crime_type": predict_crime_type(f, m["hierarchical"], top_k=5),
    }