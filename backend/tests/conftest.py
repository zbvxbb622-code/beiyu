import os

import pytest
from starlette.testclient import TestClient

os.environ["BEIYU_DATABASE_URL"] = "postgresql+psycopg://user:pass@db/beiyu"
os.environ["BEIYU_ENVIRONMENT"] = "dev"
os.environ["BEIYU_SECRET_KEY"] = "change-me"

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
