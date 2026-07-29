import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]
DEFAULT_TEST_DATABASE_URL = "postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test"
configured_database_url = os.environ.get("BEIYU_DATABASE_URL", "")
VALID_TEST_DATABASE_URL = (
    configured_database_url
    if configured_database_url.rsplit("/", maxsplit=1)[-1].endswith("_test")
    else DEFAULT_TEST_DATABASE_URL
)
NON_TEST_DATABASE_URL = VALID_TEST_DATABASE_URL.removesuffix("_test")


def run_make_target(
    tmp_path: Path, target: str, test_database_url: str
) -> subprocess.CompletedProcess[str]:
    uv_runner = tmp_path / "uv-runner"
    uv_runner.write_text(
        f"""#!{sys.executable}
import subprocess
import sys

arguments = sys.argv[1:]
assert arguments.pop(0) == "run"
if arguments[0] in {"alembic", "pytest"}:
    arguments = [sys.executable, "-m", *arguments]
elif arguments[0] == "python":
    arguments = [sys.executable, *arguments[1:]]
else:
    arguments = [sys.executable, *arguments]
raise SystemExit(subprocess.call(arguments))
"""
    )
    uv_runner.chmod(0o755)
    environment = os.environ | {
        "BEIYU_DATABASE_URL": VALID_TEST_DATABASE_URL,
        "BEIYU_ENVIRONMENT": "dev",
        "BEIYU_SECRET_KEY": "change-me",
        "PYTEST_ADDOPTS": "-k 'not test_makefile_test_database'",
    }

    return subprocess.run(
        [
            "make",
            target,
            f"TEST_DATABASE_URL={test_database_url}",
            f"UV={uv_runner}",
        ],
        cwd=BACKEND_DIRECTORY,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


def test_make_test_accepts_a_dedicated_test_database(tmp_path: Path) -> None:
    result = run_make_target(tmp_path, "test", VALID_TEST_DATABASE_URL)

    assert result.returncode == 0, result.stderr
    assert "passed" in result.stdout


def test_make_test_rejects_a_non_test_database(tmp_path: Path) -> None:
    result = run_make_target(tmp_path, "test", NON_TEST_DATABASE_URL)

    assert result.returncode != 0
    assert "ending in _test" in result.stderr
    assert "run pytest" not in result.stdout


def test_make_check_rejects_a_non_test_database_before_migration(
    tmp_path: Path,
) -> None:
    result = run_make_target(tmp_path, "check", NON_TEST_DATABASE_URL)

    assert result.returncode != 0
    assert "ending in _test" in result.stderr
    assert "alembic upgrade head" not in result.stdout
