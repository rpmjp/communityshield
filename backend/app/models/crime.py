"""Crime incident model. One row per reported incident."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Crime(Base):
    __tablename__ = "crimes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    city_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Source identifiers from the Chicago dataset
    source_id: Mapped[str] = mapped_column(String(32), nullable=False)
    case_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # When
    occurred_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False), nullable=True, index=True
    )
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)

    # What
    iucr: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    primary_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fbi_code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)

    # Where (text)
    block: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    location_description: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Where (geo)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Where (administrative)
    beat: Mapped[Optional[str]] = mapped_column(String(8), nullable=True, index=True)
    district: Mapped[Optional[str]] = mapped_column(String(8), nullable=True, index=True)
    ward: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    community_area: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)

    # Outcome flags
    arrest: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, index=True)
    domestic: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, index=True)

    # Metadata
    updated_on: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # Compound indices for the queries the app will run most often.
        Index("ix_crimes_city_year", "city_id", "year"),
        Index("ix_crimes_city_type_year", "city_id", "primary_type", "year"),
        Index("ix_crimes_city_beat_year", "city_id", "beat", "year"),
    )