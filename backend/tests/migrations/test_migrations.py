import os
from collections.abc import Mapping
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import (
    CHAR,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import make_url
from sqlalchemy.engine.reflection import Inspector

AI_TABLE_COLUMNS = {
    "ai_conversations": {
        "id", "user_id", "title", "last_message_at", "created_at", "updated_at"
    },
    "ai_messages": {
        "id", "conversation_id", "user_id", "role", "content", "recipe_ids",
        "safety_label", "created_at",
    },
    "ai_requests": {
        "id", "user_id", "conversation_id", "client_message_id", "mode", "status",
        "attempt_count", "quota_date", "reservation_expires_at", "response_message_id",
        "failure_code", "safety_label", "created_at", "completed_at",
    },
    "ai_daily_quotas": {
        "id", "user_id", "quota_date", "free_limit", "used_count", "reserved_count",
        "created_at", "updated_at",
    },
    "ai_usage_logs": {
        "id", "request_id", "attempt_no", "user_id", "conversation_id", "mode",
        "outcome", "provider", "model", "prompt_version", "input_tokens", "output_tokens",
        "latency_ms", "cost_estimate", "safety_label", "created_at",
    },
    "ai_memories": {
        "id", "user_id", "category", "memory_key", "summary", "created_at", "updated_at"
    },
    "ai_memory_sources": {
        "id", "memory_id", "conversation_id", "source_message_id", "created_at"
    },
    "ai_memory_tombstones": {"id", "user_id", "category", "key_hash", "deleted_at"},
}

AI_ENUM_VALUES = {
    "ai_message_role": ["USER", "ASSISTANT"],
    "ai_chat_mode": ["NORMAL", "TEMPORARY"],
    "ai_request_status": ["RESERVED", "SUCCEEDED", "FAILED", "EXPIRED"],
    "ai_safety_label": [
        "SAFE",
        "ALCOHOL_OVERUSE",
        "MINOR_ALCOHOL",
        "SELF_HARM_CRISIS",
        "PRIVACY_SENSITIVE",
        "OUTPUT_REPLACED",
    ],
    "ai_memory_category": [
        "DRINK_PREFERENCE",
        "EMOTIONAL_PREFERENCE",
        "SAFETY_REMINDER",
    ],
}


def column(
    inspector: Inspector,
    table_name: str,
    column_name: str,
) -> Mapping[str, Any]:
    columns = inspector.get_columns(table_name)
    return next(item for item in columns if item["name"] == column_name)


def foreign_key_ondelete(inspector: Inspector, table_name: str, column_name: str) -> str:
    foreign_keys = inspector.get_foreign_keys(table_name)
    foreign_key = next(
        key for key in foreign_keys if key["constrained_columns"] == [column_name]
    )
    return str(foreign_key["options"]["ondelete"])


def constraint_names(inspector: Inspector, table_name: str) -> set[str]:
    checks = inspector.get_check_constraints(table_name)
    return {str(check["name"]) for check in checks}


def unique_columns(inspector: Inspector, table_name: str) -> set[tuple[str, ...]]:
    uniques = inspector.get_unique_constraints(table_name)
    return {tuple(unique["column_names"]) for unique in uniques}


def assert_ai_core_migration_schema(inspector: Inspector) -> None:
    for table_name, expected_columns in AI_TABLE_COLUMNS.items():
        assert {
            column_info["name"] for column_info in inspector.get_columns(table_name)
        } == expected_columns

    assert isinstance(column(inspector, "ai_conversations", "id")["type"], Uuid)
    assert isinstance(column(inspector, "ai_conversations", "title")["type"], String)
    assert column(inspector, "ai_conversations", "title")["type"].length == 80
    assert column(inspector, "ai_conversations", "last_message_at")["nullable"] is True
    assert isinstance(column(inspector, "ai_conversations", "created_at")["type"], DateTime)
    assert column(inspector, "ai_conversations", "created_at")["type"].timezone is True
    assert "新的对话" in str(column(inspector, "ai_conversations", "title")["default"])

    assert isinstance(column(inspector, "ai_messages", "content")["type"], Text)
    assert isinstance(column(inspector, "ai_messages", "recipe_ids")["type"], JSONB)
    assert column(inspector, "ai_messages", "recipe_ids")["nullable"] is False
    assert "[]" in str(column(inspector, "ai_messages", "recipe_ids")["default"])
    assert "SAFE" in str(column(inspector, "ai_messages", "safety_label")["default"])

    assert column(inspector, "ai_requests", "conversation_id")["nullable"] is True
    assert column(inspector, "ai_requests", "response_message_id")["nullable"] is True
    assert column(inspector, "ai_requests", "failure_code")["type"].length == 80
    assert "RESERVED" in str(column(inspector, "ai_requests", "status")["default"])
    assert "1" in str(column(inspector, "ai_requests", "attempt_count")["default"])

    assert isinstance(column(inspector, "ai_daily_quotas", "free_limit")["type"], Integer)
    assert "50" in str(column(inspector, "ai_daily_quotas", "free_limit")["default"])
    assert "0" in str(column(inspector, "ai_daily_quotas", "used_count")["default"])
    assert "0" in str(column(inspector, "ai_daily_quotas", "reserved_count")["default"])

    cost_estimate = column(inspector, "ai_usage_logs", "cost_estimate")["type"]
    assert isinstance(cost_estimate, Numeric)
    assert (cost_estimate.precision, cost_estimate.scale) == (12, 6)
    assert column(inspector, "ai_usage_logs", "input_tokens")["nullable"] is True
    assert column(inspector, "ai_usage_logs", "output_tokens")["nullable"] is True
    assert isinstance(column(inspector, "ai_memories", "memory_key")["type"], String)
    assert column(inspector, "ai_memories", "memory_key")["type"].length == 80
    assert isinstance(column(inspector, "ai_memory_tombstones", "key_hash")["type"], CHAR)
    assert column(inspector, "ai_memory_tombstones", "key_hash")["type"].length == 64

    assert foreign_key_ondelete(inspector, "ai_messages", "conversation_id") == "CASCADE"
    assert foreign_key_ondelete(inspector, "ai_requests", "conversation_id") == "SET NULL"
    assert foreign_key_ondelete(inspector, "ai_requests", "response_message_id") == "SET NULL"
    assert foreign_key_ondelete(inspector, "ai_usage_logs", "conversation_id") == "SET NULL"
    assert foreign_key_ondelete(inspector, "ai_memory_sources", "conversation_id") == "CASCADE"

    assert {
        "ck_ai_requests_temporary_without_messages",
        "ck_ai_requests_attempt_count",
    } <= constraint_names(inspector, "ai_requests")
    assert {
        "ck_ai_daily_quotas_used_count",
        "ck_ai_daily_quotas_reserved_count",
        "ck_ai_daily_quotas_within_limit",
    } <= constraint_names(inspector, "ai_daily_quotas")
    assert {
        "ck_ai_usage_logs_attempt_no",
        "ck_ai_usage_logs_latency_ms",
        "ck_ai_usage_logs_input_tokens",
        "ck_ai_usage_logs_output_tokens",
        "ck_ai_usage_logs_cost_estimate",
    } <= constraint_names(inspector, "ai_usage_logs")
    assert unique_columns(inspector, "ai_requests") == {("user_id", "client_message_id")}
    assert unique_columns(inspector, "ai_daily_quotas") == {("user_id", "quota_date")}
    assert unique_columns(inspector, "ai_usage_logs") == {("request_id", "attempt_no")}
    assert unique_columns(inspector, "ai_memories") == {
        ("user_id", "category", "memory_key")
    }
    assert unique_columns(inspector, "ai_memory_sources") == {
        ("memory_id", "source_message_id")
    }
    assert unique_columns(inspector, "ai_memory_tombstones") == {
        ("user_id", "category", "key_hash")
    }

    indexes = {
        index["name"]: tuple(index["column_names"])
        for table_name in ("ai_conversations", "ai_messages")
        for index in inspector.get_indexes(table_name)
    }
    assert indexes["ix_ai_conversations_user_last_message"] == (
        "user_id", "last_message_at", "id"
    )
    assert indexes["ix_ai_messages_conversation_created"] == (
        "conversation_id", "created_at", "id"
    )
    assert indexes["ix_ai_messages_user_created"] == ("user_id", "created_at")


def test_migrations_upgrade_ai_core_from_0003_and_downgrade() -> None:
    database_url = os.environ["BEIYU_DATABASE_URL"]
    url = make_url(database_url)
    assert url.get_backend_name() == "postgresql", "Migration tests require PostgreSQL"
    if url.database is None or not url.database.endswith("_test"):
        pytest.skip("BEIYU_DATABASE_URL does not name a dedicated test database")

    config = Config("alembic.ini")
    engine = create_engine(database_url)

    try:
        command.upgrade(config, "20260729_0003")
        command.upgrade(config, "head")
        try:
            inspector = inspect(engine)
            assert {
                "alembic_version",
                "auth_sessions",
                "bars",
                "cellar_items",
                "content_versions",
                "drink_knowledge_entries",
                "home_banners",
                "home_shortcuts",
                "ingredients",
                "recipe_ingredients",
                "recipes",
                "sms_codes",
                "system_metadata",
                "user_devices",
                "user_profiles",
                "users",
                "ai_conversations",
                "ai_messages",
                "ai_requests",
                "ai_daily_quotas",
                "ai_usage_logs",
                "ai_memories",
                "ai_memory_sources",
                "ai_memory_tombstones",
            } <= set(inspector.get_table_names())
            columns = inspector.get_columns("system_metadata")
            assert {column["name"] for column in columns} == {"key", "value"}
            user_columns = inspector.get_columns("users")
            assert "role" in {column["name"] for column in user_columns}
            assert_ai_core_migration_schema(inspector)

            with engine.connect() as connection:
                revision = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one()
                enum_values = connection.execute(
                    text(
                        "SELECT pg_type.typname, array_agg(pg_enum.enumlabel "
                        "ORDER BY pg_enum.enumsortorder) "
                        "FROM pg_type JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid "
                        "WHERE pg_type.typname = ANY(:enum_names) "
                        "GROUP BY pg_type.typname"
                    ),
                    {"enum_names": list(AI_ENUM_VALUES)},
                ).all()
            assert revision == "20260729_0004"
            assert {enum_name: list(values) for enum_name, values in enum_values} == AI_ENUM_VALUES
        finally:
            command.downgrade(config, "20260729_0003")

        inspector = inspect(engine)
        assert not {
            "ai_conversations",
            "ai_messages",
            "ai_requests",
            "ai_daily_quotas",
            "ai_usage_logs",
            "ai_memories",
            "ai_memory_sources",
            "ai_memory_tombstones",
        } & set(inspector.get_table_names())
        with engine.connect() as connection:
            revisions = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalars()
            assert list(revisions) == ["20260729_0003"]
            remaining_ai_enum_types = connection.execute(
                text(
                    "SELECT typname FROM pg_type "
                    "WHERE typname = ANY(:enum_names) ORDER BY typname"
                ),
                {
                    "enum_names": [
                        "ai_chat_mode",
                        "ai_memory_category",
                        "ai_message_role",
                        "ai_request_status",
                        "ai_safety_label",
                    ]
                },
            ).scalars()
            assert list(remaining_ai_enum_types) == []
    finally:
        command.upgrade(config, "head")
        engine.dispose()
