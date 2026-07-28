UV ?= uv
TEST_DATABASE_URL ?= postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test

.PHONY: dev test lint typecheck migrate check

dev: migrate

	$(UV) run fastapi dev app/main.py --host 0.0.0.0 --port 8000

test:
	BEIYU_DATABASE_URL=$(TEST_DATABASE_URL) $(UV) run pytest

lint:
	$(UV) run ruff check .

typecheck:
	$(UV) run ty check

migrate:
	$(UV) run alembic upgrade head

check: migrate lint typecheck test
