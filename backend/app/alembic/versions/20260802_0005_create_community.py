"""create community posts and comments

Revision ID: 20260802_0005
Revises: 20260729_0004
Create Date: 2026-08-02 10:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260802_0005"
down_revision: str | Sequence[str] | None = "20260729_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    feed_category = postgresql.ENUM(
        "recommended",
        "following",
        "nearby",
        name="community_feed_category",
        create_type=False,
    )
    post_visibility = postgresql.ENUM(
        "public",
        "private",
        name="community_post_visibility",
        create_type=False,
    )
    feed_category.create(bind, checkfirst=True)
    post_visibility.create(bind, checkfirst=True)

    op.create_table(
        "community_posts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("category", feed_category, nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("image_key", sa.String(length=80), nullable=False),
        sa.Column(
            "images",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "topics",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("venue_id", sa.String(length=120), nullable=True),
        sa.Column("visibility", post_visibility, nullable=False),
        sa.Column("allow_comments", sa.Boolean(), nullable=False),
        sa.Column("like_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("like_count >= 0", name="ck_community_posts_like_count"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_community_posts_public_created",
        "community_posts",
        ["visibility", sa.text("created_at DESC"), sa.text("id DESC")],
        unique=False,
    )
    op.create_index(
        "ix_community_posts_author_created",
        "community_posts",
        ["author_id", sa.text("created_at DESC"), sa.text("id DESC")],
        unique=False,
    )

    op.create_table(
        "community_comments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["community_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_community_comments_post_created",
        "community_comments",
        ["post_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_community_comments_author_created",
        "community_comments",
        ["author_id", sa.text("created_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_community_comments_author_created", table_name="community_comments")
    op.drop_index("ix_community_comments_post_created", table_name="community_comments")
    op.drop_table("community_comments")
    op.drop_index("ix_community_posts_author_created", table_name="community_posts")
    op.drop_index("ix_community_posts_public_created", table_name="community_posts")
    op.drop_table("community_posts")
    bind = op.get_bind()
    postgresql.ENUM(name="community_post_visibility").drop(bind, checkfirst=True)
    postgresql.ENUM(name="community_feed_category").drop(bind, checkfirst=True)
