import uuid
from datetime import UTC, datetime
from typing import cast

import pytest
from sqlalchemy import Column, Integer, MetaData, Table, create_engine, select
from sqlalchemy.exc import StatementError

from app.db.models.ai import AiMessage, RecipeIdsType


def ai_message_table() -> Table:
    return cast(Table, vars(AiMessage)["__table__"])


def test_ai_message_sqlite_ddl_and_database_default_are_portable() -> None:
    engine = create_engine("sqlite://")
    table = ai_message_table()

    table.create(engine)
    message_id = uuid.uuid4()
    with engine.begin() as connection:
        connection.execute(
            table.insert().values(
                id=message_id,
                conversation_id=uuid.uuid4(),
                user_id=uuid.uuid4(),
                role="ASSISTANT",
                content="推荐一杯清爽的。",
                created_at=datetime.now(UTC),
            )
        )
        recipe_ids = connection.execute(
            select(table.c.recipe_ids).where(
                table.c.id == message_id
            )
        ).scalar_one()

    assert recipe_ids == []


def test_recipe_ids_type_binds_only_json_arrays_of_canonical_recipe_ids() -> None:
    recipe_ids_type = RecipeIdsType()
    first_id = uuid.uuid4()
    second_id = uuid.uuid4()

    assert recipe_ids_type.process_bind_param(
        [first_id, str(second_id)],
        create_engine("sqlite://").dialect,
    ) == [str(first_id), str(second_id)]


@pytest.mark.parametrize(
    "value",
    [
        None,
        {"recipe": str(uuid.uuid4())},
        str(uuid.uuid4()),
        (uuid.uuid4(),),
        ["not-a-uuid"],
        [str(uuid.uuid4()).upper()],
    ],
)
def test_recipe_ids_type_rejects_invalid_bind_shapes_as_statement_errors(
    value: object,
) -> None:
    engine = create_engine("sqlite://")
    metadata = MetaData()
    probe = Table(
        "recipe_ids_probe",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("recipe_ids", RecipeIdsType(), nullable=False),
    )
    metadata.create_all(engine)

    with engine.begin() as connection:
        with pytest.raises(StatementError) as error:
            connection.execute(probe.insert().values(recipe_ids=value))

    assert isinstance(error.value.orig, (TypeError, ValueError))


@pytest.mark.parametrize(
    "value",
    [
        None,
        {"recipe": str(uuid.uuid4())},
        str(uuid.uuid4()),
        ["not-a-uuid"],
        [str(uuid.uuid4()).upper()],
    ],
)
def test_recipe_ids_type_rejects_invalid_database_result_shapes(value: object) -> None:
    with pytest.raises((TypeError, ValueError)):
        RecipeIdsType().process_result_value(value, create_engine("sqlite://").dialect)
