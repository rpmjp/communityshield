# CommunityShield

CommunityShield is a community-focused public safety dashboard for exploring local crime patterns, beat-level trends, and ML-assisted planning signals. The first loaded city is Chicago, and the schema is designed for multiple cities.

The app is meant for awareness, prevention planning, outreach, and resource conversations. It is not predictive policing, does not identify individuals, and should not be used as an enforcement decision system.

## Stack

- Backend: FastAPI, Python 3.12, PostgreSQL 16, PostGIS, SQLAlchemy 2.0, Alembic, Pydantic v2
- ML: XGBoost, scikit-learn, SHAP, joblib artifacts
- Frontend: Vite, React, TypeScript, Tailwind CSS, MapLibre GL JS, Leaflet fallback, Recharts
- Local infra: Docker Compose for PostgreSQL/PostGIS

## Repository Layout

- `backend/`: FastAPI app, schemas, models, Alembic migrations, backend tests
- `frontend/`: React map UI, prediction panel, methodology page, component tests
- `ml/`: feature building, training, tuning, chart export scripts, model metrics/artifacts
- `docker-compose.yml`: local PostGIS database service

## Local Setup

Start the database from the repo root:

```bash
docker compose up -d postgres
```

Set up and run the backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run the frontend in another shell:

```bash
cd frontend
npm ci
npm run dev
```

Then open:

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/v1/health/db

## Data Notes

The app expects Chicago geography, rollups, and model artifacts to exist locally. Database migrations create schema, but they do not seed the full dataset by themselves.

Useful backend scripts:

```bash
cd backend
python -m scripts.ingest_geography
python -m scripts.ingest_crimes
python -m scripts.populate_rollups
python -m scripts.verify_ingest
```

Some scripts depend on local data files or environment-specific paths. Check script arguments before running a full ingest.

## Common Commands

Frontend:

```bash
cd frontend
npm run lint
npm test
npm run build
```

Backend:

```bash
cd backend
pytest
alembic upgrade head
```

Backend tests currently expect a seeded local database for the full smoke suite.

## Environment

Frontend:

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Backend:

```bash
DATABASE_URL=postgresql+psycopg://communityshield:devpassword@localhost:5432/communityshield_dev
```

The Docker Compose defaults match the backend development settings.

## Current Limitations

- Chicago is the only loaded city.
- Crime data reflects reported and recorded incidents, including reporting bias.
- Fine-grained crime type prediction has a real data ceiling; use top-K outputs as context, not certainty.
- Models are historical and not automatically retrained.
- Backend CI currently runs migrations, but full API tests need seeded data.

## Project Status

Working prototype with a production-shaped stack: map exploration, beat details, heatmap filters, prediction endpoints, SHAP explanations, and a methodology page.
