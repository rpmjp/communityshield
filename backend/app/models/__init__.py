"""SQLAlchemy models. Import all model modules here so Alembic can detect them."""
from app.models.city import City  # noqa: F401
from app.models.crime import Crime  # noqa: F401
from app.models.geography import CommunityArea, Beat  # noqa: F401