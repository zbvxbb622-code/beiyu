from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
WORKFLOW_PATH = REPOSITORY_ROOT / ".github" / "workflows" / "backend-ci.yml"


def test_backend_ci_seeds_only_the_dedicated_test_database() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert (
        "BEIYU_DATABASE_URL: "
        "postgresql+psycopg://beiyu:beiyu@localhost:5432/beiyu_test"
        in workflow
    )
    assert workflow.count("uv run python -m app.cli seed-content") == 2
    assert workflow.index("uv run alembic upgrade head") < workflow.index(
        "uv run python -m app.cli seed-content"
    )
    assert workflow.index("uv run pytest --ignore=tests/migrations") < workflow.index(
        "uv run python -m app.cli seed-content"
    )
