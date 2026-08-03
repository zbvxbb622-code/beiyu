"""create community moderation

Revision ID: 20260802_0008
Revises: 20260802_0007
Create Date: 2026-08-02 18:20:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260802_0008"
down_revision: str | Sequence[str] | None = "20260802_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    moderation_status = postgresql.ENUM(
        "approved",
        "hidden",
        "rejected",
        name="community_moderation_status",
        create_type=False,
    )
    report_target_type = postgresql.ENUM(
        "post",
        "comment",
        name="community_report_target_type",
        create_type=False,
    )
    report_status = postgresql.ENUM(
        "open",
        "resolved",
        name="community_report_status",
        create_type=False,
    )
    audit_action = postgresql.ENUM(
        "report_post",
        "report_comment",
        "approve_post",
        "hide_post",
        "reject_post",
        "approve_comment",
        "hide_comment",
        "reject_comment",
        name="community_audit_action",
        create_type=False,
    )
    for enum_type in (
        moderation_status,
        report_target_type,
        report_status,
        audit_action,
    ):
        enum_type.create(bind, checkfirst=True)

    op.add_column(
        "community_posts",
        sa.Column(
            "moderation_status",
            moderation_status,
            server_default=sa.text("'approved'"),
            nullable=False,
        ),
    )
    op.add_column(
        "community_posts",
        sa.Column("moderation_note", sa.String(length=500), server_default="", nullable=False),
    )
    op.create_index(
        op.f("ix_community_posts_moderation_status"),
        "community_posts",
        ["moderation_status"],
        unique=False,
    )
    op.add_column(
        "community_comments",
        sa.Column(
            "moderation_status",
            moderation_status,
            server_default=sa.text("'approved'"),
            nullable=False,
        ),
    )
    op.add_column(
        "community_comments",
        sa.Column("moderation_note", sa.String(length=500), server_default="", nullable=False),
    )
    op.create_index(
        op.f("ix_community_comments_moderation_status"),
        "community_comments",
        ["moderation_status"],
        unique=False,
    )

    op.create_table(
        "community_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("reporter_id", sa.Uuid(), nullable=False),
        sa.Column("target_type", report_target_type, nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=True),
        sa.Column("comment_id", sa.Uuid(), nullable=True),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("status", report_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["comment_id"], ["community_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["post_id"], ["community_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_community_reports_status_created",
        "community_reports",
        ["status", sa.text("created_at DESC")],
        unique=False,
    )
    op.create_index(op.f("ix_community_reports_comment_id"), "community_reports", ["comment_id"], unique=False)
    op.create_index(op.f("ix_community_reports_created_at"), "community_reports", ["created_at"], unique=False)
    op.create_index(op.f("ix_community_reports_post_id"), "community_reports", ["post_id"], unique=False)
    op.create_index(op.f("ix_community_reports_reporter_id"), "community_reports", ["reporter_id"], unique=False)
    op.create_index(op.f("ix_community_reports_target_type"), "community_reports", ["target_type"], unique=False)

    op.create_table(
        "community_audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("target_type", report_target_type, nullable=False),
        sa.Column("post_id", sa.Uuid(), nullable=True),
        sa.Column("comment_id", sa.Uuid(), nullable=True),
        sa.Column("action", audit_action, nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["comment_id"], ["community_comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["post_id"], ["community_posts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_community_audit_logs_action"), "community_audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_community_audit_logs_actor_id"), "community_audit_logs", ["actor_id"], unique=False)
    op.create_index(op.f("ix_community_audit_logs_comment_id"), "community_audit_logs", ["comment_id"], unique=False)
    op.create_index(op.f("ix_community_audit_logs_created_at"), "community_audit_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_community_audit_logs_post_id"), "community_audit_logs", ["post_id"], unique=False)
    op.create_index(op.f("ix_community_audit_logs_target_type"), "community_audit_logs", ["target_type"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    op.drop_index(op.f("ix_community_audit_logs_target_type"), table_name="community_audit_logs")
    op.drop_index(op.f("ix_community_audit_logs_post_id"), table_name="community_audit_logs")
    op.drop_index(op.f("ix_community_audit_logs_created_at"), table_name="community_audit_logs")
    op.drop_index(op.f("ix_community_audit_logs_comment_id"), table_name="community_audit_logs")
    op.drop_index(op.f("ix_community_audit_logs_actor_id"), table_name="community_audit_logs")
    op.drop_index(op.f("ix_community_audit_logs_action"), table_name="community_audit_logs")
    op.drop_table("community_audit_logs")

    op.drop_index(op.f("ix_community_reports_target_type"), table_name="community_reports")
    op.drop_index(op.f("ix_community_reports_reporter_id"), table_name="community_reports")
    op.drop_index(op.f("ix_community_reports_post_id"), table_name="community_reports")
    op.drop_index(op.f("ix_community_reports_created_at"), table_name="community_reports")
    op.drop_index(op.f("ix_community_reports_comment_id"), table_name="community_reports")
    op.drop_index("ix_community_reports_status_created", table_name="community_reports")
    op.drop_table("community_reports")

    op.drop_index(op.f("ix_community_comments_moderation_status"), table_name="community_comments")
    op.drop_column("community_comments", "moderation_note")
    op.drop_column("community_comments", "moderation_status")
    op.drop_index(op.f("ix_community_posts_moderation_status"), table_name="community_posts")
    op.drop_column("community_posts", "moderation_note")
    op.drop_column("community_posts", "moderation_status")

    postgresql.ENUM(name="community_audit_action").drop(bind, checkfirst=True)
    postgresql.ENUM(name="community_report_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="community_report_target_type").drop(bind, checkfirst=True)
    postgresql.ENUM(name="community_moderation_status").drop(bind, checkfirst=True)
