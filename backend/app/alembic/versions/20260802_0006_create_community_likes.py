"""create community post likes

Revision ID: 20260802_0006
Revises: 20260802_0005
Create Date: 2026-08-02 11:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260802_0006"
down_revision: str | Sequence[str] | None = "20260802_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "community_post_likes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["community_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "user_id", name="uq_community_post_likes_post_user"),
    )
    op.create_index(
        "ix_community_post_likes_post_created",
        "community_post_likes",
        ["post_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "ix_community_post_likes_user_created",
        "community_post_likes",
        ["user_id", sa.text("created_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_community_post_likes_user_created", table_name="community_post_likes")
    op.drop_index("ix_community_post_likes_post_created", table_name="community_post_likes")
    op.drop_table("community_post_likes")
