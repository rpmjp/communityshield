# CommunityShield Backend

FastAPI service for the CommunityShield platform.

## Run locally

From the repo root, start Postgres:

    docker compose up -d postgres

From the `backend/` directory:

    source .venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Then visit:

- http://localhost:8000/             — service info
- http://localhost:8000/docs         — interactive API docs
- http://localhost:8000/api/v1/health    — liveness check
- http://localhost:8000/api/v1/health/db — database connectivity check
