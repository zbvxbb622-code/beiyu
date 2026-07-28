from collections.abc import Generator
from typing import Any, cast

import pytest
from sqlalchemy import Select
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session

from app.db.session import check_database, get_engine, get_session


@pytest.fixture(autouse=True)
def clear_engine_cache() -> Generator[None, None, None]:
    get_engine.cache_clear()
    yield
    get_engine.cache_clear()


def test_get_engine_is_cached_and_enables_pre_ping() -> None:
    engine = get_engine()

    assert get_engine() is engine
    assert engine.pool._pre_ping is True


def test_get_session_binds_the_cached_engine() -> None:
    dependency = get_session()
    session = next(dependency)

    try:
        assert isinstance(session, Session)
        assert session.get_bind() is get_engine()
    finally:
        dependency.close()


class ScalarResult:
    def one(self) -> int:
        return 1


class RecordingSession:
    def __init__(self) -> None:
        self.statement: Select[Any] | None = None
        self.params: dict[str, Any] | None = None

    def exec(self, statement: Select[Any], *, params: dict[str, Any]) -> ScalarResult:
        self.statement = statement
        self.params = params
        return ScalarResult()


def test_check_database_executes_a_parameterized_probe() -> None:
    session = RecordingSession()

    assert check_database(cast(Session, session)) is True
    assert str(session.statement) == "SELECT :probe AS anon_1"
    assert session.params == {"probe": 1}


class FailingSession:
    def exec(self, statement: Select[Any], *, params: dict[str, Any]) -> None:
        raise SQLAlchemyError("could not connect password=secret")


def test_check_database_reports_connection_failure() -> None:
    assert check_database(cast(Session, FailingSession())) is False
