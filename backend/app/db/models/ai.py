import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    CHAR,
    JSON,
    CheckConstraint,
    DateTime,
    Enum,
    Index,
    Numeric,
    Text,
    UniqueConstraint,
    desc,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Column, Field, SQLModel

from app.db.models.accounts import utc_now


class AiMessageRole(StrEnum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"


class AiChatMode(StrEnum):
    NORMAL = "NORMAL"
    TEMPORARY = "TEMPORARY"


class AiRequestStatus(StrEnum):
    RESERVED = "RESERVED"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class AiSafetyLabel(StrEnum):
    SAFE = "SAFE"
    ALCOHOL_OVERUSE = "ALCOHOL_OVERUSE"
    MINOR_ALCOHOL = "MINOR_ALCOHOL"
    SELF_HARM_CRISIS = "SELF_HARM_CRISIS"
    PRIVACY_SENSITIVE = "PRIVACY_SENSITIVE"
    OUTPUT_REPLACED = "OUTPUT_REPLACED"


class AiMemoryCategory(StrEnum):
    DRINK_PREFERENCE = "DRINK_PREFERENCE"
    EMOTIONAL_PREFERENCE = "EMOTIONAL_PREFERENCE"
    SAFETY_REMINDER = "SAFETY_REMINDER"


def json_column() -> Column:
    return Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)


class AiConversation(SQLModel, table=True):
    __tablename__ = "ai_conversations"
    __table_args__ = (
        Index(
            "ix_ai_conversations_user_last_message",
            "user_id",
            desc("last_message_at"),
            desc("id"),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    title: str = Field(default="新的对话", max_length=80)
    last_message_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class AiMessage(SQLModel, table=True):
    __tablename__ = "ai_messages"
    __table_args__ = (
        Index(
            "ix_ai_messages_conversation_created",
            "conversation_id",
            "created_at",
            "id",
        ),
        Index(
            "ix_ai_messages_user_created",
            "user_id",
            desc("created_at"),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(
        foreign_key="ai_conversations.id",
        ondelete="CASCADE",
    )
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    role: AiMessageRole = Field(
        sa_column=Column(Enum(AiMessageRole, name="ai_message_role"), nullable=False),
    )
    content: str = Field(sa_column=Column(Text(), nullable=False))
    recipe_ids: list[uuid.UUID] = Field(default_factory=list, sa_column=json_column())
    safety_label: AiSafetyLabel = Field(
        default=AiSafetyLabel.SAFE,
        sa_column=Column(Enum(AiSafetyLabel, name="ai_safety_label"), nullable=False),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class AiRequest(SQLModel, table=True):
    __tablename__ = "ai_requests"
    __table_args__ = (
        CheckConstraint(
            "mode != 'TEMPORARY' OR (conversation_id IS NULL AND response_message_id IS NULL)",
            name="ck_ai_requests_temporary_without_messages",
        ),
        CheckConstraint("attempt_count >= 1", name="ck_ai_requests_attempt_count"),
        UniqueConstraint(
            "user_id",
            "client_message_id",
            name="uq_ai_requests_user_client_message",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    conversation_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="ai_conversations.id",
        ondelete="SET NULL",
    )
    client_message_id: uuid.UUID
    mode: AiChatMode = Field(
        sa_column=Column(Enum(AiChatMode, name="ai_chat_mode"), nullable=False),
    )
    status: AiRequestStatus = Field(
        default=AiRequestStatus.RESERVED,
        sa_column=Column(Enum(AiRequestStatus, name="ai_request_status"), nullable=False),
    )
    attempt_count: int = Field(default=1)
    quota_date: date
    reservation_expires_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    response_message_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="ai_messages.id",
        ondelete="SET NULL",
    )
    failure_code: str | None = Field(default=None, max_length=80)
    safety_label: AiSafetyLabel | None = Field(
        default=None,
        sa_column=Column(Enum(AiSafetyLabel, name="ai_safety_label"), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    completed_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )


class AiDailyQuota(SQLModel, table=True):
    __tablename__ = "ai_daily_quotas"
    __table_args__ = (
        CheckConstraint("used_count >= 0", name="ck_ai_daily_quotas_used_count"),
        CheckConstraint(
            "reserved_count >= 0",
            name="ck_ai_daily_quotas_reserved_count",
        ),
        CheckConstraint(
            "used_count + reserved_count <= free_limit",
            name="ck_ai_daily_quotas_within_limit",
        ),
        UniqueConstraint("user_id", "quota_date", name="uq_ai_daily_quotas_user_date"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    quota_date: date
    free_limit: int = Field(default=50)
    used_count: int = Field(default=0)
    reserved_count: int = Field(default=0)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class AiUsageLog(SQLModel, table=True):
    __tablename__ = "ai_usage_logs"
    __table_args__ = (
        CheckConstraint("attempt_no >= 1", name="ck_ai_usage_logs_attempt_no"),
        CheckConstraint("latency_ms >= 0", name="ck_ai_usage_logs_latency_ms"),
        UniqueConstraint("request_id", "attempt_no", name="uq_ai_usage_logs_attempt"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    request_id: uuid.UUID = Field(foreign_key="ai_requests.id", ondelete="CASCADE")
    attempt_no: int
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    conversation_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="ai_conversations.id",
        ondelete="SET NULL",
    )
    mode: AiChatMode = Field(
        sa_column=Column(Enum(AiChatMode, name="ai_chat_mode"), nullable=False),
    )
    outcome: str = Field(max_length=40)
    provider: str = Field(max_length=80)
    model: str = Field(max_length=120)
    prompt_version: str = Field(max_length=40)
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int
    cost_estimate: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(12, 6), nullable=True),
    )
    safety_label: AiSafetyLabel | None = Field(
        default=None,
        sa_column=Column(Enum(AiSafetyLabel, name="ai_safety_label"), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class AiMemory(SQLModel, table=True):
    __tablename__ = "ai_memories"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category",
            "memory_key",
            name="uq_ai_memories_user_category_key",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    category: AiMemoryCategory = Field(
        sa_column=Column(Enum(AiMemoryCategory, name="ai_memory_category"), nullable=False),
    )
    memory_key: str = Field(max_length=80)
    summary: str = Field(max_length=240)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class AiMemorySource(SQLModel, table=True):
    __tablename__ = "ai_memory_sources"
    __table_args__ = (
        UniqueConstraint(
            "memory_id",
            "source_message_id",
            name="uq_ai_memory_sources_memory_message",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    memory_id: uuid.UUID = Field(foreign_key="ai_memories.id", ondelete="CASCADE")
    conversation_id: uuid.UUID = Field(
        foreign_key="ai_conversations.id",
        ondelete="CASCADE",
    )
    source_message_id: uuid.UUID = Field(
        foreign_key="ai_messages.id",
        ondelete="CASCADE",
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class AiMemoryTombstone(SQLModel, table=True):
    __tablename__ = "ai_memory_tombstones"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category",
            "key_hash",
            name="uq_ai_memory_tombstones_user_category_hash",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    category: AiMemoryCategory = Field(
        sa_column=Column(Enum(AiMemoryCategory, name="ai_memory_category"), nullable=False),
    )
    key_hash: str = Field(sa_column=Column(CHAR(64), nullable=False))
    deleted_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
