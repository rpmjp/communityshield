"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import beats, cities, geo, health, heatmap, predict
from app.config import get_settings

settings = get_settings()
app = FastAPI(
    title="CommunityShield API",
    version="0.1.0",
    description="Community-led public safety platform API.",
)

# CORS for local dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(predict.router, prefix="/api/v1")
app.include_router(heatmap.router, prefix="/api/v1")
app.include_router(geo.router, prefix="/api/v1")
app.include_router(beats.router, prefix="/api/v1")
app.include_router(cities.router, prefix="/api/v1")


@app.get("/")
def root() -> dict:
    return {
        "service": "CommunityShield API",
        "version": "0.1.0",
        "docs": "/docs",
    }
