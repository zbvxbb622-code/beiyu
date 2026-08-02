"""add community moderator role

Revision ID: 20260802_0010
Revises: 20260802_0009
Create Date: 2026-08-02 21:15:00

"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260802_0010"
down_revision: str | Sequence[str] | None = "20260802_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MODERATOR'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be dropped safely without rewriting dependent columns.
    pass
