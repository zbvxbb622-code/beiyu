"""create AI core

Revision ID: 20260729_0004
Revises: 20260729_0003
Create Date: 2026-07-29 16:30:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260729_0004"
down_revision: str | Sequence[str] | None = "20260729_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    ai_message_role = postgresql.ENUM(
        "USER",
        "ASSISTANT",
        name="ai_message_role",
        create_type=False,
    )
    ai_chat_mode = postgresql.ENUM(
        "NORMAL",
        "TEMPORARY",
        name="ai_chat_mode",
        create_type=False,
    )
    ai_request_status = postgresql.ENUM(
        "RESERVED",
        "SUCCEEDED",
        "FAILED",
        "EXPIRED",
        name="ai_request_status",
        create_type=False,
    )
    ai_safety_label = postgresql.ENUM(
        "SAFE",
        "ALCOHOL_OVERUSE",
        "MINOR_ALCOHOL",
        "SELF_HARM_CRISIS",
        "PRIVACY_SENSITIVE",
        "OUTPUT_REPLACED",
        name="ai_safety_label",
        create_type=False,
    )
    ai_memory_category = postgresql.ENUM(
        "DRINK_PREFERENCE",
        "EMOTIONAL_PREFERENCE",
        "SAFETY_REMINDER",
        name="ai_memory_category",
        create_type=False,
    )
    for enum_type in (
        ai_message_role,
        ai_chat_mode,
        ai_request_status,
        ai_safety_label,
        ai_memory_category,
    ):
        enum_type.create(bind, checkfirst=True)

    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "title",
            sa.String(length=80),
            server_default=sa.text("'新的对话'"),
            nullable=False,
        ),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    # Preserve newest-message ordering for conversation history scans.
    op.create_index(
        "ix_ai_conversations_user_last_message",
        "ai_conversations",
        ["user_id", sa.text("last_message_at DESC"), sa.text("id DESC")],
        unique=False,
    )

    op.create_table(
        "ai_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", ai_message_role, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "recipe_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "safety_label",
            ai_safety_label,
            server_default=sa.text("'SAFE'"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["ai_conversations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_messages_conversation_created",
        "ai_messages",
        ["conversation_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_messages_user_created",
        "ai_messages",
        ["user_id", sa.text("created_at DESC")],
        unique=False,
    )

    op.create_table(
        "ai_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=True),
        sa.Column("client_message_id", sa.Uuid(), nullable=False),
        sa.Column("mode", ai_chat_mode, nullable=False),
        sa.Column(
            "status",
            ai_request_status,
            server_default=sa.text("'RESERVED'"),
            nullable=False,
        ),
        sa.Column("attempt_count", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("quota_date", sa.Date(), nullable=False),
        sa.Column("reservation_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response_message_id", sa.Uuid(), nullable=True),
        sa.Column("failure_code", sa.String(length=80), nullable=True),
        sa.Column("safety_label", ai_safety_label, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "mode != 'TEMPORARY' OR (conversation_id IS NULL AND response_message_id IS NULL)",
            name="ck_ai_requests_temporary_without_messages",
        ),
        sa.CheckConstraint("attempt_count >= 1", name="ck_ai_requests_attempt_count"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["ai_conversations.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["response_message_id"],
            ["ai_messages.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "client_message_id",
            name="uq_ai_requests_user_client_message",
        ),
    )

    op.create_table(
        "ai_daily_quotas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("quota_date", sa.Date(), nullable=False),
        sa.Column("free_limit", sa.Integer(), server_default=sa.text("50"), nullable=False),
        sa.Column("used_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("reserved_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("used_count >= 0", name="ck_ai_daily_quotas_used_count"),
        sa.CheckConstraint(
            "reserved_count >= 0",
            name="ck_ai_daily_quotas_reserved_count",
        ),
        sa.CheckConstraint(
            "used_count + reserved_count <= free_limit",
            name="ck_ai_daily_quotas_within_limit",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "quota_date", name="uq_ai_daily_quotas_user_date"),
    )

    op.create_table(
        "ai_usage_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("attempt_no", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=True),
        sa.Column("mode", ai_chat_mode, nullable=False),
        sa.Column("outcome", sa.String(length=40), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("prompt_version", sa.String(length=40), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("cost_estimate", sa.Numeric(precision=12, scale=6), nullable=True),
        sa.Column("safety_label", ai_safety_label, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("attempt_no >= 1", name="ck_ai_usage_logs_attempt_no"),
        sa.CheckConstraint("latency_ms >= 0", name="ck_ai_usage_logs_latency_ms"),
        sa.CheckConstraint(
            "input_tokens IS NULL OR input_tokens >= 0",
            name="ck_ai_usage_logs_input_tokens",
        ),
        sa.CheckConstraint(
            "output_tokens IS NULL OR output_tokens >= 0",
            name="ck_ai_usage_logs_output_tokens",
        ),
        sa.CheckConstraint(
            "cost_estimate IS NULL OR cost_estimate >= 0",
            name="ck_ai_usage_logs_cost_estimate",
        ),
        sa.ForeignKeyConstraint(
            ["request_id"],
            ["ai_requests.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["ai_conversations.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("request_id", "attempt_no", name="uq_ai_usage_logs_attempt"),
    )

    op.create_table(
        "ai_memories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("category", ai_memory_category, nullable=False),
        sa.Column("memory_key", sa.String(length=80), nullable=False),
        sa.Column("summary", sa.String(length=240), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "category",
            "memory_key",
            name="uq_ai_memories_user_category_key",
        ),
    )

    op.create_table(
        "ai_memory_sources",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("memory_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("source_message_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["memory_id"],
            ["ai_memories.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["ai_conversations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_message_id"],
            ["ai_messages.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "memory_id",
            "source_message_id",
            name="uq_ai_memory_sources_memory_message",
        ),
    )

    op.create_table(
        "ai_memory_tombstones",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("category", ai_memory_category, nullable=False),
        sa.Column("key_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "category",
            "key_hash",
            name="uq_ai_memory_tombstones_user_category_hash",
        ),
    )


def downgrade() -> None:
    op.drop_table("ai_memory_tombstones")
    op.drop_table("ai_memory_sources")
    op.drop_table("ai_memories")
    op.drop_table("ai_usage_logs")
    op.drop_table("ai_daily_quotas")
    op.drop_table("ai_requests")
    op.drop_index("ix_ai_messages_user_created", table_name="ai_messages")
    op.drop_index("ix_ai_messages_conversation_created", table_name="ai_messages")
    op.drop_table("ai_messages")
    op.drop_index(
        "ix_ai_conversations_user_last_message",
        table_name="ai_conversations",
    )
    op.drop_table("ai_conversations")

    bind = op.get_bind()
    for enum_name in (
        "ai_memory_category",
        "ai_safety_label",
        "ai_request_status",
        "ai_chat_mode",
        "ai_message_role",
    ):
        postgresql.ENUM(name=enum_name).drop(bind, checkfirst=True)
