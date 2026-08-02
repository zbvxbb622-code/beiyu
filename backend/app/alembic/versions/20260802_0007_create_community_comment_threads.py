"""create community comment replies and likes

Revision ID: 20260802_0007
Revises: 20260802_0006
Create Date: 2026-08-02 13:30:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260802_0007"
down_revision: str | Sequence[str] | None = "20260802_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "community_comments",
        sa.Column("parent_comment_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "community_comments",
        sa.Column("like_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.create_check_constraint(
        "ck_community_comments_like_count",
        "community_comments",
        "like_count >= 0",
    )
    op.create_foreign_key(
        "fk_community_comments_parent_comment_id",
        "community_comments",
        "community_comments",
        ["parent_comment_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_community_comments_parent_comment_id",
        "community_comments",
        ["parent_comment_id"],
        unique=False,
    )
    op.create_table(
        "community_comment_likes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("comment_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["community_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_community_comment_likes_comment_user"),
    )
    op.create_index(
        "ix_community_comment_likes_comment_created",
        "community_comment_likes",
        ["comment_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "ix_community_comment_likes_user_created",
        "community_comment_likes",
        ["user_id", sa.text("created_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_community_comment_likes_user_created", table_name="community_comment_likes")
    op.drop_index("ix_community_comment_likes_comment_created", table_name="community_comment_likes")
    op.drop_table("community_comment_likes")
    op.drop_index("ix_community_comments_parent_comment_id", table_name="community_comments")
    op.drop_constraint("fk_community_comments_parent_comment_id", "community_comments", type_="foreignkey")
    op.drop_constraint("ck_community_comments_like_count", "community_comments", type_="check")
    op.drop_column("community_comments", "like_count")
    op.drop_column("community_comments", "parent_comment_id")
