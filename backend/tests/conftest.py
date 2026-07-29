import os
from collections.abc import Generator

import pytest
from sqlmodel import Session
from starlette.testclient import TestClient

os.environ.setdefault(
    "BEIYU_DATABASE_URL",
    "postgresql+psycopg://user:pass@db/beiyu",
)
os.environ.setdefault("BEIYU_ENVIRONMENT", "dev")
os.environ.setdefault("BEIYU_SECRET_KEY", "change-me")

from app.db.session import get_engine, get_session
from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def database_session() -> Generator[Session, None, None]:
    database_url = os.environ["BEIYU_DATABASE_URL"]
    if not database_url.rsplit("/", maxsplit=1)[-1].endswith("_test"):
        pytest.skip("requires a dedicated database ending in _test")

    connection = get_engine().connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def database_client(database_session: Session) -> Generator[TestClient, None, None]:
    def override_session() -> Session:
        return database_session

    app.dependency_overrides[get_session] = override_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
