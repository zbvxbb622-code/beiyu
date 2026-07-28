import sys

from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


def validate_test_database_url(database_url: str) -> None:
    try:
        database_name = make_url(database_url).database
    except ArgumentError as error:
        raise ValueError("TEST_DATABASE_URL must be a valid database URL") from error

    if database_name is None or not database_name.endswith("_test"):
        raise ValueError(
            "TEST_DATABASE_URL must name a dedicated database ending in _test"
        )


def main() -> int:
    try:
        validate_test_database_url(sys.argv[1])
    except (IndexError, ValueError) as error:
        sys.stderr.write(f"{error}\n")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
