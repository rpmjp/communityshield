"""Health check endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    """Liveness check. Returns 200 if the app is running."""
    return {"status": "ok"}


@router.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> dict:
    """Readiness check. Verifies database connectivity."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
