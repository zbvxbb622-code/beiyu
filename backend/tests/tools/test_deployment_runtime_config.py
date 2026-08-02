from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = REPO_ROOT / "backend"
ECS_ROOT = REPO_ROOT / "deploy" / "ecs"


def _load_yaml(path: Path) -> dict[str, Any]:
    config = yaml.safe_load(path.read_text())
    assert isinstance(config, dict)
    return config


def test_api_container_does_not_run_migrations_on_startup() -> None:
    dockerfile = (BACKEND_ROOT / "Dockerfile").read_text()

    assert 'ENTRYPOINT ["./scripts/prestart.sh"]' not in dockerfile
    assert "alembic upgrade head" not in dockerfile


def test_dockerfile_installs_requirements_without_ghcr_or_uv_sync() -> None:
    dockerfile = (BACKEND_ROOT / "Dockerfile").read_text()

    assert "ghcr.io/astral-sh/uv" not in dockerfile
    assert "uv sync" not in dockerfile
    assert "ARG PIP_INDEX_URL=" in dockerfile
    assert "python -m venv .venv" in dockerfile
    assert "pip install --no-cache-dir --index-url ${PIP_INDEX_URL} -r requirements.txt" in dockerfile


def test_compose_exposes_one_off_migration_jobs() -> None:
    for compose_path in (BACKEND_ROOT / "compose.yml", ECS_ROOT / "compose.yml"):
        services = _load_yaml(compose_path)["services"]

        assert "migrate" in services
        assert services["migrate"]["profiles"] == ["migration"]
        assert services["migrate"]["command"] == ["alembic", "upgrade", "head"]
        assert services["migrate"]["restart"] == "no"


def test_nginx_api_root_has_exact_locations_without_redirect_loop() -> None:
    config = (ECS_ROOT / "nginx" / "beiyu-api.conf").read_text()

    assert "location = /api/v1 {" in config
    assert "location = /api/v1/ {" in config
    api_v1_block = config.split("location = /api/v1 {", maxsplit=1)[1].split("}", maxsplit=1)[0]
    api_v1_slash_block = config.split("location = /api/v1/ {", maxsplit=1)[1].split("}", maxsplit=1)[0]

    assert "return 301" not in api_v1_block
    assert "return 307" not in api_v1_block
    assert "return 301" not in api_v1_slash_block
    assert "return 307" not in api_v1_slash_block
    assert "proxy_pass http://127.0.0.1:8000;" in api_v1_block
    assert "proxy_pass http://127.0.0.1:8000/api/v1;" in api_v1_slash_block
