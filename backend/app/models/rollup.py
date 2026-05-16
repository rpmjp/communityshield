"""Pre-aggregated crime counts by beat, time, and type.

This is the table the map queries instead of the raw 8.5M-row crimes table.
One row per (beat, year, month, hour, day_of_week, primary_type) combination.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class BeatRollup(Base):
    __tablename__ = "beat_rollups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    city_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    beat_number: Mapped[str] = mapped_column(String(8), nullable=False)

    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    hour: Mapped[int] = mapped_column(Integer, nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday, 6=Sunday

    primary_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    incident_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    arrest_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    domestic_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "city_id", "beat_number", "year", "month", "hour", "day_of_week", "primary_type",
            name="uq_beat_rollup_key",
        ),
        Index("ix_beat_rollups_city_beat_year", "city_id", "beat_number", "year"),
        Index("ix_beat_rollups_city_year_hour", "city_id", "year", "hour"),
        Index("ix_beat_rollups_primary_type", "primary_type"),
    )