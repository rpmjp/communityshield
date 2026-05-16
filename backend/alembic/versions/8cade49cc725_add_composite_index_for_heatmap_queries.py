"""add composite index for heatmap queries

Revision ID: 8cade49cc725
Revises: 64023d052426
Create Date: 2026-05-15 23:04:39.718705

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8cade49cc725'
down_revision: Union[str, None] = '64023d052426'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_beat_rollups_heatmap_query",
        "beat_rollups",
        ["city_id", "year", "primary_type", "hour", "beat_number"],
    )


def downgrade() -> None:
    op.drop_index("ix_beat_rollups_heatmap_query", table_name="beat_rollups")