from pathlib import Path
from typing import Any

import yaml
from sqlalchemy.engine import make_url

BACKEND_ROOT = Path(__file__).resolve().parents[2]
COMPOSE_PATH = BACKEND_ROOT / "compose.yml"


def load_compose() -> dict[str, Any]:
    compose = yaml.safe_load(COMPOSE_PATH.read_text())
    assert isinstance(compose, dict)
    return compose


def interpolation_default(value: str) -> tuple[str, str]:
    assert value.startswith("${")
    assert value.endswith("}")
    variable, default = value[2:-1].split(":-", maxsplit=1)
    return variable, default


def test_api_uses_compose_only_internal_database_url_with_aligned_defaults() -> None:
    services = load_compose()["services"]
    api_database_source = services["api"]["environment"]["BEIYU_DATABASE_URL"]

    variable, default_database_url = interpolation_default(api_database_source)
    database_url = make_url(default_database_url)

    assert variable == "BEIYU_COMPOSE_DATABASE_URL"
    assert database_url.host == "db"
    assert database_url.port == 5432

    database_environment = services["db"]["environment"]
    database_name_variable, database_name = interpolation_default(
        database_environment["POSTGRES_DB"]
    )
    database_user_variable, database_user = interpolation_default(
        database_environment["POSTGRES_USER"]
    )
    database_password_variable, database_password = interpolation_default(
        database_environment["POSTGRES_PASSWORD"]
    )

    assert database_name_variable == "BEIYU_COMPOSE_POSTGRES_DB"
    assert database_user_variable == "BEIYU_COMPOSE_POSTGRES_USER"
    assert database_password_variable == "BEIYU_COMPOSE_POSTGRES_PASSWORD"
    assert database_url.database == database_name
    assert database_url.username == database_user
    assert database_url.password == database_password


def test_development_and_test_ports_are_bound_to_loopback() -> None:
    services = load_compose()["services"]

    assert services["api"]["ports"] == ["127.0.0.1:8000:8000"]
    assert services["db"]["ports"] == ["127.0.0.1:5432:5432"]
    assert services["db-test"]["ports"] == ["127.0.0.1:5433:5432"]
