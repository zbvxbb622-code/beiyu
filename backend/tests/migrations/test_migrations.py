import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url


def test_migrations_upgrade_to_head_and_downgrade_to_base() -> None:
    database_url = os.environ["BEIYU_DATABASE_URL"]
    url = make_url(database_url)
    assert url.get_backend_name() == "postgresql", "Migration tests require PostgreSQL"
    if url.database is None or not url.database.endswith("_test"):
        pytest.skip("BEIYU_DATABASE_URL does not name a dedicated test database")

    config = Config("alembic.ini")
    engine = create_engine(database_url)

    try:
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
            } <= set(inspector.get_table_names())
            columns = inspector.get_columns("system_metadata")
            assert {column["name"] for column in columns} == {"key", "value"}
            user_columns = inspector.get_columns("users")
            assert "role" in {column["name"] for column in user_columns}

            with engine.connect() as connection:
                revision = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one()
            assert revision == "20260729_0003"
        finally:
            command.downgrade(config, "base")

        inspector = inspect(engine)
        assert "system_metadata" not in inspector.get_table_names()
        with engine.connect() as connection:
            revisions = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalars()
            assert list(revisions) == []
            remaining_enum_types = connection.execute(
                text(
                    "SELECT typname FROM pg_type "
                    "WHERE typname = ANY(:enum_names) ORDER BY typname"
                ),
                {
                    "enum_names": [
                        "cellar_item_source",
                        "content_action",
                        "content_status",
                        "content_type",
                        "device_platform",
                        "ingredient_category",
                        "membership_level",
                        "sms_scene",
                        "user_role",
                        "user_status",
                    ]
                },
            ).scalars()
            assert list(remaining_enum_types) == []
    finally:
        command.upgrade(config, "head")
        engine.dispose()
