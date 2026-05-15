"""create cities table

Revision ID: ce113c797d3f
Revises: 
Create Date: 2026-05-15 11:49:21.334495
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'ce113c797d3f'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cities',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('slug', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('state', sa.String(length=8), nullable=False),
        sa.Column('timezone', sa.String(length=64), nullable=False),
        sa.Column('center_lat', sa.Float(), nullable=False),
        sa.Column('center_lng', sa.Float(), nullable=False),
        sa.Column('default_zoom', sa.Integer(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_cities_slug'), 'cities', ['slug'], unique=True)

    # Seed initial city
    op.execute("""
        INSERT INTO cities (id, slug, name, state, timezone, center_lat, center_lng, default_zoom, active)
        VALUES (
            gen_random_uuid(),
            'chicago',
            'Chicago',
            'IL',
            'America/Chicago',
            41.8781,
            -87.6298,
            11,
            true
        )
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_cities_slug'), table_name='cities')
    op.drop_table('cities')
