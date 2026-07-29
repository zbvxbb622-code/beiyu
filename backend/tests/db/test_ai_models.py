from datetime import UTC, date
from typing import cast
from uuid import uuid4

from sqlalchemy import CheckConstraint, Enum, Numeric, String, Table, UniqueConstraint
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB

from app.db.models.ai import (
    AiChatMode,
    AiConversation,
    AiDailyQuota,
    AiMemory,
    AiMemoryCategory,
    AiMemorySource,
    AiMemoryTombstone,
    AiMessage,
    AiMessageRole,
    AiRequest,
    AiRequestStatus,
    AiSafetyLabel,
    AiUsageLog,
)


def model_table(model: type[object]) -> Table:
    return cast(Table, vars(model)["__table__"])


def foreign_key(table: Table, column_name: str):
    return next(iter(table.columns[column_name].foreign_keys))


def unique_columns(table: Table) -> set[tuple[str, ...]]:
    return {
        tuple(constraint.columns.keys())
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }


def check_names(table: Table) -> set[str]:
    return {
        constraint.name
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
        and isinstance(constraint.name, str)
    }


def enum_name(table: Table, column_name: str) -> str | None:
    return cast(Enum, table.columns[column_name].type).name


def string_length(table: Table, column_name: str) -> int | None:
    return cast(String, table.columns[column_name].type).length


def test_ai_models_publish_the_expected_enum_contracts() -> None:
    assert [role.value for role in AiMessageRole] == ["USER", "ASSISTANT"]
    assert [mode.value for mode in AiChatMode] == ["NORMAL", "TEMPORARY"]
    assert [status.value for status in AiRequestStatus] == [
        "RESERVED",
        "SUCCEEDED",
        "FAILED",
        "EXPIRED",
    ]
    assert [label.value for label in AiSafetyLabel] == [
        "SAFE",
        "ALCOHOL_OVERUSE",
        "MINOR_ALCOHOL",
        "SELF_HARM_CRISIS",
        "PRIVACY_SENSITIVE",
        "OUTPUT_REPLACED",
    ]
    assert [category.value for category in AiMemoryCategory] == [
        "DRINK_PREFERENCE",
        "EMOTIONAL_PREFERENCE",
        "SAFETY_REMINDER",
    ]

    assert enum_name(model_table(AiMessage), "role") == "ai_message_role"
    assert enum_name(model_table(AiRequest), "mode") == "ai_chat_mode"
    assert enum_name(model_table(AiRequest), "status") == "ai_request_status"
    assert enum_name(model_table(AiMessage), "safety_label") == "ai_safety_label"
    assert enum_name(model_table(AiMemory), "category") == "ai_memory_category"


def test_ai_models_define_all_tables_columns_and_defaults() -> None:
    tables = {
        AiConversation: {
            "id", "user_id", "title", "last_message_at", "created_at", "updated_at"
        },
        AiMessage: {
            "id", "conversation_id", "user_id", "role", "content", "recipe_ids",
            "safety_label", "created_at",
        },
        AiRequest: {
            "id", "user_id", "conversation_id", "client_message_id", "mode", "status",
            "attempt_count", "quota_date", "reservation_expires_at", "response_message_id",
            "failure_code", "safety_label", "created_at", "completed_at",
        },
        AiDailyQuota: {
            "id", "user_id", "quota_date", "free_limit", "used_count", "reserved_count",
            "created_at", "updated_at",
        },
        AiUsageLog: {
            "id", "request_id", "attempt_no", "user_id", "conversation_id", "mode",
            "outcome", "provider", "model", "prompt_version", "input_tokens", "output_tokens",
            "latency_ms", "cost_estimate", "safety_label", "created_at",
        },
        AiMemory: {
            "id", "user_id", "category", "memory_key", "summary", "created_at", "updated_at"
        },
        AiMemorySource: {
            "id", "memory_id", "conversation_id", "source_message_id", "created_at"
        },
        AiMemoryTombstone: {"id", "user_id", "category", "key_hash", "deleted_at"},
    }
    expected_names = {
        "ai_conversations",
        "ai_messages",
        "ai_requests",
        "ai_daily_quotas",
        "ai_usage_logs",
        "ai_memories",
        "ai_memory_sources",
        "ai_memory_tombstones",
    }

    assert {model.__tablename__ for model in tables} == expected_names
    for model, expected_columns in tables.items():
        assert set(model_table(model).columns.keys()) == expected_columns

    conversation = AiConversation(user_id=uuid4(), title="新的对话")
    message = AiMessage(
        conversation_id=conversation.id,
        user_id=conversation.user_id,
        role=AiMessageRole.USER,
        content="你好",
    )
    request = AiRequest(
        user_id=conversation.user_id,
        client_message_id=uuid4(),
        mode=AiChatMode.TEMPORARY,
        quota_date=date.today(),
    )
    quota = AiDailyQuota(user_id=conversation.user_id, quota_date=request.quota_date)
    usage = AiUsageLog(
        request_id=request.id,
        attempt_no=1,
        user_id=conversation.user_id,
        mode=AiChatMode.TEMPORARY,
        outcome="SUCCEEDED",
        provider="development",
        model="development-ai",
        prompt_version="v1",
        latency_ms=0,
    )

    assert message.recipe_ids == []
    assert message.safety_label is AiSafetyLabel.SAFE
    assert request.status is AiRequestStatus.RESERVED
    assert request.attempt_count == 1
    assert quota.free_limit == 50
    assert quota.used_count == 0
    assert quota.reserved_count == 0
    assert usage.cost_estimate is None
    assert conversation.created_at.tzinfo is UTC
    assert message.created_at.tzinfo is UTC


def test_ai_models_match_field_shapes_and_nullability() -> None:
    conversation = model_table(AiConversation)
    message = model_table(AiMessage)
    request = model_table(AiRequest)
    usage = model_table(AiUsageLog)
    memory = model_table(AiMemory)
    source = model_table(AiMemorySource)
    tombstone = model_table(AiMemoryTombstone)

    assert string_length(conversation, "title") == 80
    assert conversation.columns["last_message_at"].nullable is True
    assert message.columns["content"].type.__class__.__name__ == "Text"
    assert isinstance(message.columns["recipe_ids"].type.dialect_impl(postgresql.dialect()), JSONB)
    assert message.columns["recipe_ids"].nullable is False
    assert string_length(request, "failure_code") == 80
    assert request.columns["conversation_id"].nullable is True
    assert request.columns["reservation_expires_at"].nullable is True
    assert request.columns["response_message_id"].nullable is True
    assert request.columns["failure_code"].nullable is True
    assert request.columns["safety_label"].nullable is True
    assert request.columns["completed_at"].nullable is True
    assert string_length(usage, "outcome") == 40
    assert string_length(usage, "provider") == 80
    assert string_length(usage, "model") == 120
    assert string_length(usage, "prompt_version") == 40
    assert usage.columns["input_tokens"].nullable is True
    assert usage.columns["output_tokens"].nullable is True
    assert usage.columns["conversation_id"].nullable is True
    cost_estimate = cast(Numeric, usage.columns["cost_estimate"].type)
    assert cost_estimate.precision == 12
    assert cost_estimate.scale == 6
    assert string_length(memory, "memory_key") == 80
    assert string_length(memory, "summary") == 240
    assert string_length(tombstone, "key_hash") == 64
    assert source.columns["memory_id"].nullable is False


def test_ai_models_define_foreign_key_delete_rules() -> None:
    tables = {model.__tablename__: model_table(model) for model in (
        AiConversation, AiMessage, AiRequest, AiDailyQuota, AiUsageLog, AiMemory,
        AiMemorySource, AiMemoryTombstone,
    )}

    assert foreign_key(tables["ai_conversations"], "user_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_messages"], "conversation_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_messages"], "user_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_requests"], "user_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_requests"], "conversation_id").ondelete == "SET NULL"
    assert foreign_key(tables["ai_requests"], "response_message_id").ondelete == "SET NULL"
    assert foreign_key(tables["ai_daily_quotas"], "user_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_usage_logs"], "request_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_usage_logs"], "user_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_usage_logs"], "conversation_id").ondelete == "SET NULL"
    assert foreign_key(tables["ai_memories"], "user_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_memory_sources"], "memory_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_memory_sources"], "conversation_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_memory_sources"], "source_message_id").ondelete == "CASCADE"
    assert foreign_key(tables["ai_memory_tombstones"], "user_id").ondelete == "CASCADE"


def test_ai_models_define_constraints_and_ordering_indexes() -> None:
    conversation = model_table(AiConversation)
    message = model_table(AiMessage)
    request = model_table(AiRequest)
    quota = model_table(AiDailyQuota)
    usage = model_table(AiUsageLog)
    memory = model_table(AiMemory)
    source = model_table(AiMemorySource)
    tombstone = model_table(AiMemoryTombstone)

    assert unique_columns(request) == {("user_id", "client_message_id")}
    assert unique_columns(quota) == {("user_id", "quota_date")}
    assert unique_columns(usage) == {("request_id", "attempt_no")}
    assert unique_columns(memory) == {("user_id", "category", "memory_key")}
    assert unique_columns(source) == {("memory_id", "source_message_id")}
    assert unique_columns(tombstone) == {("user_id", "category", "key_hash")}
    assert {"ck_ai_requests_temporary_without_messages"} <= check_names(request)
    assert {
        "ck_ai_daily_quotas_used_count",
        "ck_ai_daily_quotas_reserved_count",
        "ck_ai_daily_quotas_within_limit",
    } <= check_names(quota)
    assert {"ck_ai_usage_logs_latency_ms"} <= check_names(usage)

    conversation_indexes = {str(index.name): index for index in conversation.indexes}
    message_indexes = {str(index.name): index for index in message.indexes}
    assert [str(expression) for expression in conversation_indexes[
        "ix_ai_conversations_user_last_message"
    ].expressions] == ["ai_conversations.user_id", "last_message_at DESC", "id DESC"]
    assert [str(expression) for expression in message_indexes[
        "ix_ai_messages_conversation_created"
    ].expressions] == [
        "ai_messages.conversation_id",
        "ai_messages.created_at",
        "ai_messages.id",
    ]
    assert [str(expression) for expression in message_indexes[
        "ix_ai_messages_user_created"
    ].expressions] == ["ai_messages.user_id", "created_at DESC"]
