"""Shared pytest fixtures."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    """A FastAPI TestClient sharing the real app config.

    Uses the live local DB. Tests must be read-only.
    """
    with TestClient(app) as c:
        yield c