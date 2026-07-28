import os

import pytest
from starlette.testclient import TestClient

os.environ.setdefault(
    "BEIYU_DATABASE_URL",
    "postgresql+psycopg://user:pass@db/beiyu",
)
os.environ.setdefault("BEIYU_ENVIRONMENT", "dev")
os.environ.setdefault("BEIYU_SECRET_KEY", "change-me")

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
