"""Smoke tests for the public API surface.

These don't validate business logic deeply — they confirm endpoints
respond with sensible shapes and HTTP codes. The DB must be running
and seeded with at least one city ('chicago').
"""
from __future__ import annotations


def test_health_db(client):
    r = client.get("/api/v1/health/db")
    assert r.status_code == 200
    body = r.json()
    assert "status" in body
    assert "database" in body


def test_cities_lists_chicago(client):
    r = client.get("/api/v1/cities")
    assert r.status_code == 200
    cities = r.json()
    assert isinstance(cities, list)
    slugs = {c["slug"] for c in cities}
    assert "chicago" in slugs
    chi = next(c for c in cities if c["slug"] == "chicago")
    assert chi["beat_count"] > 0
    assert "bounds" in chi
    assert "center" in chi


def test_geo_beats_shape(client):
    r = client.get("/api/v1/geo/beats?city_slug=chicago")
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) > 0
    first = body["features"][0]
    assert first["type"] == "Feature"
    assert "beat_number" in first["properties"]
    assert first["geometry"]["type"] == "MultiPolygon"


def test_geo_beats_unknown_city_404(client):
    r = client.get("/api/v1/geo/beats?city_slug=atlantis")
    assert r.status_code == 404


def test_geo_community_areas_shape(client):
    r = client.get("/api/v1/geo/community_areas?city_slug=chicago")
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) > 0


def test_heatmap_returns_beats(client):
    r = client.get("/api/v1/heatmap?city_slug=chicago&year=2024")
    assert r.status_code == 200
    body = r.json()
    assert body["city_slug"] == "chicago"
    assert isinstance(body["beats"], list)
    assert body["total_incidents"] > 0
    if body["beats"]:
        sample = body["beats"][0]
        assert "beat_number" in sample
        assert "incident_count" in sample


def test_heatmap_crime_types(client):
    r = client.get("/api/v1/heatmap/crime_types?city_slug=chicago")
    assert r.status_code == 200
    types = r.json()
    assert isinstance(types, list)
    assert len(types) > 0
    assert "primary_type" in types[0]


def test_beat_detail(client):
    # Pick a known-good beat (downtown Chicago)
    r = client.get("/api/v1/beats/0111?city_slug=chicago&year=2024")
    assert r.status_code == 200
    body = r.json()
    assert body["beat_number"] == "0111"
    assert "geometry" in body
    assert "stats" in body
    assert "top_crime_types" in body
    assert len(body["hour_distribution"]) == 24


def test_beat_detail_unknown_404(client):
    r = client.get("/api/v1/beats/9999?city_slug=chicago&year=2024")
    assert r.status_code == 404


def test_predict_all(client):
    payload = {
        "hour": 22, "day_of_week": 5, "month": 7,
        "beat_num": 1832, "community_area": 32,
        "latitude": 41.881, "longitude": -87.623,
        "district": "1", "location_group": "STREET",
        "primary_type": "THEFT",
    }
    r = client.post("/api/v1/predict/all", json=payload)
    assert r.status_code == 200
    body = r.json()
    for key in ("arrest", "domestic", "property_binary", "crime_type"):
        assert key in body
    # Probabilities are valid
    for key in ("arrest", "domestic", "property_binary"):
        prob = body[key]["probability"]
        assert 0.0 <= prob <= 1.0


def test_predict_all_with_explanations(client):
    payload = {
        "hour": 22, "day_of_week": 5, "month": 7,
        "beat_num": 1832, "community_area": 32,
        "latitude": 41.881, "longitude": -87.623,
        "district": "1", "location_group": "STREET",
        "primary_type": "THEFT",
    }
    r = client.post("/api/v1/predict/all?explain=true", json=payload)
    assert r.status_code == 200
    body = r.json()
    for key in ("arrest", "domestic", "property_binary"):
        exp = body[key].get("explanation")
        assert exp is not None
        assert len(exp["contributions"]) > 0


def test_predict_invalid_payload_422(client):
    r = client.post("/api/v1/predict/all", json={"hour": "not a number"})
    assert r.status_code == 422