"""Seed-free backend contract tests intended for CI.

The broader smoke suite exercises the real seeded database. These tests mock the
database/model boundaries so GitHub Actions can still catch API and query-shape
regressions without downloading the full Chicago dataset or ML artifacts.
"""
from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from app.api.v1 import heatmap, predict
from app.api.v1.health import get_db
from app.main import app


VALID_FEATURES = {
    "hour": 22,
    "day_of_week": 5,
    "month": 7,
    "beat_num": 1832,
    "community_area": 32,
    "latitude": 41.881,
    "longitude": -87.623,
    "district": "1",
    "location_group": "STREET",
    "primary_type": "THEFT",
}


def test_health_liveness_is_seed_free() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db_uses_dependency_override() -> None:
    class FakeDb:
        def execute(self, statement: Any) -> None:
            assert "SELECT 1" in str(statement)

    def fake_get_db():
        yield FakeDb()

    app.dependency_overrides[get_db] = fake_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/health/db")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_heatmap_allows_overnight_hour_range_without_seeded_db(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    class FakeSession:
        def __enter__(self) -> "FakeSession":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def execute(self, sql: Any, params: dict[str, Any]) -> "FakeResult":
            captured["sql"] = str(sql)
            captured["params"] = params
            return FakeResult()

    class FakeResult:
        def fetchall(self) -> list[Any]:
            return []

    monkeypatch.setattr(heatmap, "SessionLocal", FakeSession)

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/heatmap?city_slug=chicago&year=2024&hour_min=23&hour_max=6"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["filters"]["hour_min"] == 23
    assert body["filters"]["hour_max"] == 6
    assert body["beats"] == []
    assert "br.hour >= :hour_min OR br.hour <= :hour_max" in captured["sql"]
    assert captured["params"]["hour_min"] == 23
    assert captured["params"]["hour_max"] == 6


def test_predict_all_contract_without_model_artifacts(monkeypatch) -> None:
    monkeypatch.setattr(
        predict,
        "get_models",
        lambda: {
            "arrest": object(),
            "domestic": object(),
            "property_binary": object(),
            "hierarchical": object(),
        },
    )
    monkeypatch.setattr(
        predict,
        "predict_arrest",
        lambda *_args, **_kwargs: {
            "model": "arrest",
            "probability": 0.42,
            "prediction": 0,
            "threshold": 0.5,
        },
    )
    monkeypatch.setattr(
        predict,
        "predict_domestic",
        lambda *_args, **_kwargs: {
            "model": "domestic",
            "probability": 0.18,
            "prediction": 0,
            "threshold": 0.5,
        },
    )
    monkeypatch.setattr(
        predict,
        "predict_property_binary",
        lambda *_args, **_kwargs: {
            "model": "property_binary",
            "probability": 0.67,
            "prediction": 1,
            "threshold": 0.5,
            "label": "property",
        },
    )
    monkeypatch.setattr(
        predict,
        "predict_crime_type",
        lambda *_args, **_kwargs: {
            "model": "hierarchical_crime_type",
            "top_k": [{"class": "THEFT", "probability": 0.35}],
            "supercategory_probabilities": {"property": 0.65},
        },
    )

    with TestClient(app) as client:
        response = client.post("/api/v1/predict/all", json=VALID_FEATURES)

    assert response.status_code == 200
    body = response.json()
    assert body["arrest"]["probability"] == 0.42
    assert body["property_binary"]["label"] == "property"
    assert body["crime_type"]["top_k"][0]["class"] == "THEFT"


def test_predict_invalid_payload_returns_422_without_models(monkeypatch) -> None:
    def fail_get_models() -> None:
        raise AssertionError("model loading should not happen for invalid payloads")

    monkeypatch.setattr(predict, "get_models", fail_get_models)

    with TestClient(app) as client:
        response = client.post("/api/v1/predict/all", json={"hour": 99})

    assert response.status_code == 422
