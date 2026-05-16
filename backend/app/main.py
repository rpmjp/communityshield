"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import health, predict

app = FastAPI(
    title="CommunityShield API",
    version="0.1.0",
    description="Community-led public safety platform API.",
)

# CORS for local dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(predict.router, prefix="/api/v1")


@app.get("/")
def root() -> dict:
    return {
        "service": "CommunityShield API",
        "version": "0.1.0",
        "docs": "/docs",
    }