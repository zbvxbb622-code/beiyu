import os
import re
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

AI_COLUMN_MANIFEST: dict[str, dict[str, tuple[str, bool, str | None]]] = {
    "ai_conversations": {
        "id": ("uuid", False, None),
        "user_id": ("uuid", False, None),
        "title": ("varchar(80)", False, "'新的对话'::character varying"),
        "last_message_at": ("timestamptz", True, None),
        "created_at": ("timestamptz", False, None),
        "updated_at": ("timestamptz", False, None),
    },
    "ai_messages": {
        "id": ("uuid", False, None),
        "conversation_id": ("uuid", False, None),
        "user_id": ("uuid", False, None),
        "role": ("ai_message_role", False, None),
        "content": ("text", False, None),
        "recipe_ids": ("jsonb", False, "'[]'::jsonb"),
        "safety_label": ("ai_safety_label", False, "'SAFE'::ai_safety_label"),
        "created_at": ("timestamptz", False, None),
    },
    "ai_requests": {
        "id": ("uuid", False, None),
        "user_id": ("uuid", False, None),
        "conversation_id": ("uuid", True, None),
        "client_message_id": ("uuid", False, None),
        "mode": ("ai_chat_mode", False, None),
        "status": ("ai_request_status", False, "'RESERVED'::ai_request_status"),
        "attempt_count": ("integer", False, "1"),
        "quota_date": ("date", False, None),
        "reservation_expires_at": ("timestamptz", True, None),
        "response_message_id": ("uuid", True, None),
        "failure_code": ("varchar(80)", True, None),
        "safety_label": ("ai_safety_label", True, None),
        "created_at": ("timestamptz", False, None),
        "completed_at": ("timestamptz", True, None),
    },
    "ai_daily_quotas": {
        "id": ("uuid", False, None),
        "user_id": ("uuid", False, None),
        "quota_date": ("date", False, None),
        "free_limit": ("integer", False, "50"),
        "used_count": ("integer", False, "0"),
        "reserved_count": ("integer", False, "0"),
        "created_at": ("timestamptz", False, None),
        "updated_at": ("timestamptz", False, None),
    },
    "ai_usage_logs": {
        "id": ("uuid", False, None),
        "request_id": ("uuid", False, None),
        "attempt_no": ("integer", False, None),
        "user_id": ("uuid", False, None),
        "conversation_id": ("uuid", True, None),
        "mode": ("ai_chat_mode", False, None),
        "outcome": ("varchar(40)", False, None),
        "provider": ("varchar(80)", False, None),
        "model": ("varchar(120)", False, None),
        "prompt_version": ("varchar(40)", False, None),
        "input_tokens": ("integer", True, None),
        "output_tokens": ("integer", True, None),
        "latency_ms": ("integer", False, None),
        "cost_estimate": ("numeric(12,6)", True, None),
        "safety_label": ("ai_safety_label", True, None),
        "created_at": ("timestamptz", False, None),
    },
    "ai_memories": {
        "id": ("uuid", False, None),
        "user_id": ("uuid", False, None),
        "category": ("ai_memory_category", False, None),
        "memory_key": ("varchar(80)", False, None),
        "summary": ("varchar(240)", False, None),
        "created_at": ("timestamptz", False, None),
        "updated_at": ("timestamptz", False, None),
    },
    "ai_memory_sources": {
        "id": ("uuid", False, None),
        "memory_id": ("uuid", False, None),
        "conversation_id": ("uuid", False, None),
        "source_message_id": ("uuid", False, None),
        "created_at": ("timestamptz", False, None),
    },
    "ai_memory_tombstones": {
        "id": ("uuid", False, None),
        "user_id": ("uuid", False, None),
        "category": ("ai_memory_category", False, None),
        "key_hash": ("char(64)", False, None),
        "deleted_at": ("timestamptz", False, None),
    },
}

AI_FOREIGN_KEY_MANIFEST = {
    "ai_conversations": {(("user_id",), "public", "users", ("id",), "CASCADE")},
    "ai_messages": {
        (("conversation_id",), "public", "ai_conversations", ("id",), "CASCADE"),
        (("user_id",), "public", "users", ("id",), "CASCADE"),
    },
    "ai_requests": {
        (("user_id",), "public", "users", ("id",), "CASCADE"),
        (("conversation_id",), "public", "ai_conversations", ("id",), "SET NULL"),
        (("response_message_id",), "public", "ai_messages", ("id",), "SET NULL"),
    },
    "ai_daily_quotas": {(("user_id",), "public", "users", ("id",), "CASCADE")},
    "ai_usage_logs": {
        (("request_id",), "public", "ai_requests", ("id",), "CASCADE"),
        (("user_id",), "public", "users", ("id",), "CASCADE"),
        (("conversation_id",), "public", "ai_conversations", ("id",), "SET NULL"),
    },
    "ai_memories": {(("user_id",), "public", "users", ("id",), "CASCADE")},
    "ai_memory_sources": {
        (("memory_id",), "public", "ai_memories", ("id",), "CASCADE"),
        (("conversation_id",), "public", "ai_conversations", ("id",), "CASCADE"),
        (("source_message_id",), "public", "ai_messages", ("id",), "CASCADE"),
    },
    "ai_memory_tombstones": {(("user_id",), "public", "users", ("id",), "CASCADE")},
}

AI_CHECK_MANIFEST = {
    "ai_conversations": {},
    "ai_messages": {},
    "ai_requests": {
        "ck_ai_requests_temporary_without_messages": "(mode <> 'TEMPORARY'::ai_chat_mode) OR ((conversation_id IS NULL) AND (response_message_id IS NULL))",
        "ck_ai_requests_attempt_count": "attempt_count >= 1",
    },
    "ai_daily_quotas": {
        "ck_ai_daily_quotas_used_count": "used_count >= 0",
        "ck_ai_daily_quotas_reserved_count": "reserved_count >= 0",
        "ck_ai_daily_quotas_within_limit": "(used_count + reserved_count) <= free_limit",
    },
    "ai_usage_logs": {
        "ck_ai_usage_logs_attempt_no": "attempt_no >= 1",
        "ck_ai_usage_logs_latency_ms": "latency_ms >= 0",
        "ck_ai_usage_logs_input_tokens": "(input_tokens IS NULL) OR (input_tokens >= 0)",
        "ck_ai_usage_logs_output_tokens": "(output_tokens IS NULL) OR (output_tokens >= 0)",
        "ck_ai_usage_logs_cost_estimate": "(cost_estimate IS NULL) OR (cost_estimate >= (0)::numeric)",
    },
    "ai_memories": {},
    "ai_memory_sources": {},
    "ai_memory_tombstones": {},
}

AI_UNIQUE_MANIFEST = {
    "ai_conversations": set(),
    "ai_messages": set(),
    "ai_requests": {("user_id", "client_message_id")},
    "ai_daily_quotas": {("user_id", "quota_date")},
    "ai_usage_logs": {("request_id", "attempt_no")},
    "ai_memories": {("user_id", "category", "memory_key")},
    "ai_memory_sources": {("memory_id", "source_message_id")},
    "ai_memory_tombstones": {("user_id", "category", "key_hash")},
}

AI_INDEX_MANIFEST = {
    "ix_ai_conversations_user_last_message": (
        "user_id, last_message_at DESC, id DESC",
        ("uuid_ops", "timestamptz_ops", "uuid_ops"),
    ),
    "ix_ai_messages_conversation_created": (
        "conversation_id, created_at, id",
        ("uuid_ops", "timestamptz_ops", "uuid_ops"),
    ),
    "ix_ai_messages_user_created": (
        "user_id, created_at DESC",
        ("uuid_ops", "timestamptz_ops"),
    ),
}


@pytest.mark.parametrize(
    ("left", "right"),
    [
        ("(a AND b) OR c", "a AND (b OR c)"),
        ("(a OR b) AND c", "a OR (b AND c)"),
    ],
)
def test_normalize_sql_preserves_logical_grouping(left: str, right: str) -> None:
    assert normalize_sql(left) != normalize_sql(right)


def normalize_sql(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r'"([^"]+)"', r"\1", value)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if normalized.startswith("CHECK"):
        normalized = normalized.removeprefix("CHECK").strip()
    return strip_outer_parentheses(normalized)


def strip_outer_parentheses(value: str) -> str:
    result = value
    while result.startswith("(") and result.endswith(")"):
        depth = 0
        quote_open = False
        encloses_entire_expression = True
        for index, character in enumerate(result):
            if character == "'":
                quote_open = not quote_open
            elif not quote_open and character == "(":
                depth += 1
            elif not quote_open and character == ")":
                depth -= 1
                if depth == 0 and index != len(result) - 1:
                    encloses_entire_expression = False
                    break
        if not encloses_entire_expression:
            break
        result = result[1:-1].strip()
    return result


def assert_ai_core_design_manifest(connection: Any) -> None:
    column_rows = connection.execute(
        text(
            "SELECT table_name, column_name, data_type, udt_name, "
            "character_maximum_length, numeric_precision, numeric_scale, "
            "is_nullable, column_default "
            "FROM information_schema.columns "
            "WHERE table_schema = current_schema() "
            "AND table_name = ANY(:table_names)"
        ),
        {"table_names": list(AI_COLUMN_MANIFEST)},
    ).mappings()
    actual_columns: dict[str, dict[str, tuple[str, bool, str | None]]] = {}
    for row in column_rows:
        data_type = str(row["data_type"])
        if data_type == "USER-DEFINED":
            column_type = str(row["udt_name"])
        elif data_type == "character varying":
            column_type = f"varchar({row['character_maximum_length']})"
        elif data_type == "character":
            column_type = f"char({row['character_maximum_length']})"
        elif data_type == "numeric":
            column_type = f"numeric({row['numeric_precision']},{row['numeric_scale']})"
        elif data_type == "timestamp with time zone":
            column_type = "timestamptz"
        else:
            column_type = data_type
        actual_columns.setdefault(str(row["table_name"]), {})[str(row["column_name"])] = (
            column_type,
            row["is_nullable"] == "YES",
            normalize_sql(row["column_default"]),
        )
    assert actual_columns == AI_COLUMN_MANIFEST

    foreign_key_rows = connection.execute(
        text(
            "SELECT source.relname AS table_name, "
            "array_agg(source_column.attname ORDER BY key_pair.ordinality) AS source_columns, "
            "target_namespace.nspname AS target_schema, target.relname AS target_table, "
            "array_agg(target_column.attname ORDER BY key_pair.ordinality) AS target_columns, "
            "con.confdeltype "
            "FROM pg_constraint AS con "
            "JOIN pg_class AS source ON source.oid = con.conrelid "
            "JOIN pg_class AS target ON target.oid = con.confrelid "
            "JOIN pg_namespace AS target_namespace ON target_namespace.oid = target.relnamespace "
            "CROSS JOIN LATERAL unnest(con.conkey, con.confkey) "
            "WITH ORDINALITY AS key_pair(source_attribute_number, target_attribute_number, ordinality) "
            "JOIN pg_attribute AS source_column "
            "ON source_column.attrelid = source.oid "
            "AND source_column.attnum = key_pair.source_attribute_number "
            "JOIN pg_attribute AS target_column "
            "ON target_column.attrelid = target.oid "
            "AND target_column.attnum = key_pair.target_attribute_number "
            "WHERE con.contype = 'f' "
            "AND source.relname = ANY(:table_names) "
            "GROUP BY source.relname, target_namespace.nspname, target.relname, con.confdeltype"
        ),
        {"table_names": list(AI_FOREIGN_KEY_MANIFEST)},
    )
    delete_actions = {"a": "NO ACTION", "c": "CASCADE", "n": "SET NULL"}
    actual_foreign_keys: dict[
        str,
        set[tuple[tuple[str, ...], str, str, tuple[str, ...], str]],
    ] = {
        table_name: set() for table_name in AI_FOREIGN_KEY_MANIFEST
    }
    for (
        table_name,
        source_columns,
        target_schema,
        target_table,
        target_columns,
        delete_action,
    ) in foreign_key_rows:
        actual_foreign_keys[str(table_name)].add(
            (
                tuple(source_columns),
                str(target_schema),
                str(target_table),
                tuple(target_columns),
                delete_actions[str(delete_action)],
            )
        )
    assert actual_foreign_keys == AI_FOREIGN_KEY_MANIFEST

    check_rows = connection.execute(
        text(
            "SELECT table_class.relname, con.conname, "
            "pg_get_constraintdef(con.oid) "
            "FROM pg_constraint AS con "
            "JOIN pg_class AS table_class ON table_class.oid = con.conrelid "
            "WHERE con.contype = 'c' "
            "AND table_class.relname = ANY(:table_names)"
        ),
        {"table_names": list(AI_CHECK_MANIFEST)},
    )
    actual_checks: dict[str, dict[str, str]] = {
        table_name: {} for table_name in AI_CHECK_MANIFEST
    }
    for table_name, constraint_name, expression in check_rows:
        actual_checks[str(table_name)][str(constraint_name)] = str(
            normalize_sql(str(expression))
        )
    assert actual_checks == AI_CHECK_MANIFEST

    unique_rows = connection.execute(
        text(
            "SELECT table_class.relname, con.conname, "
            "array_agg(attribute.attname ORDER BY key.ordinality) "
            "FROM pg_constraint AS con "
            "JOIN pg_class AS table_class ON table_class.oid = con.conrelid "
            "CROSS JOIN LATERAL unnest(con.conkey) "
            "WITH ORDINALITY AS key(attribute_number, ordinality) "
            "JOIN pg_attribute AS attribute "
            "ON attribute.attrelid = table_class.oid "
            "AND attribute.attnum = key.attribute_number "
            "WHERE con.contype = 'u' "
            "AND table_class.relname = ANY(:table_names) "
            "GROUP BY table_class.relname, con.conname"
        ),
        {"table_names": list(AI_UNIQUE_MANIFEST)},
    )
    actual_uniques: dict[str, set[tuple[str, ...]]] = {
        table_name: set() for table_name in AI_UNIQUE_MANIFEST
    }
    for table_name, _, columns in unique_rows:
        actual_uniques[str(table_name)].add(tuple(columns))
    assert actual_uniques == AI_UNIQUE_MANIFEST

    index_rows = connection.execute(
        text(
            "SELECT index_class.relname, pg_get_indexdef(index_entry.indexrelid), "
            "array_agg(opclass.opcname ORDER BY key.ordinality) "
            "FROM pg_index AS index_entry "
            "JOIN pg_class AS table_class ON table_class.oid = index_entry.indrelid "
            "JOIN pg_class AS index_class ON index_class.oid = index_entry.indexrelid "
            "JOIN pg_namespace AS namespace ON namespace.oid = table_class.relnamespace "
            "CROSS JOIN LATERAL unnest(index_entry.indclass) "
            "WITH ORDINALITY AS key(opclass_oid, ordinality) "
            "JOIN pg_opclass AS opclass ON opclass.oid = key.opclass_oid "
            "WHERE namespace.nspname = current_schema() "
            "AND table_class.relname = ANY(:table_names) "
            "AND NOT index_entry.indisprimary "
            "GROUP BY index_class.relname, index_entry.indexrelid"
        ),
        {"table_names": ["ai_conversations", "ai_messages"]},
    )
    actual_indexes: dict[str, tuple[str, tuple[str, ...]]] = {}
    for index_name, index_definition, opclasses in index_rows:
        expression = str(index_definition).rsplit("(", maxsplit=1)[1].rstrip(")")
        actual_indexes[str(index_name)] = (
            str(normalize_sql(expression)),
            tuple(opclasses),
        )
    assert actual_indexes == AI_INDEX_MANIFEST


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
                assert_ai_core_design_manifest(connection)
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
