# Beiyu API

Stage 0 is the API foundation for Beiyu. It provides operational health
endpoints, a PostgreSQL-backed readiness check, Alembic migrations, structured
request logs, and repeatable local quality commands. It deliberately contains
no authentication, user or business tables, Redis runtime, OSS, SMS, AI,
moderation, or other product integrations.

## Prerequisites

- Docker Engine with Docker Compose v2 for local PostgreSQL and the container
  service.
- Python `>=3.12,<3.15` and [uv](https://docs.astral.sh/uv/) for host commands.
- PostgreSQL is pinned to major version 16 by `compose.yml`.

## First Run

```bash
cd backend
cp .env.example .env
docker compose up -d db db-test
uv sync --frozen
set -a && . ./.env && set +a
make dev
```

The first `make dev` applies migrations to the development database and starts
the API with reload at `http://localhost:8000`.

To run the containerized service instead, use:

```bash
docker compose up --build
```

`compose.yml` provides separate PostgreSQL instances:

- Development: `localhost:5432/beiyu`
- Tests: `localhost:5433/beiyu_test`

The test instance is intentionally separate. Its migration smoke test upgrades
to the current revision and downgrades back to base.

## Environment

Copy `.env.example` to `.env` for development. The supported values for
`BEIYU_ENVIRONMENT` are exactly `dev`, `staging`, and `prod`.

- `dev` is the local default and permits the placeholder secret.
- `staging` requires a generated `BEIYU_SECRET_KEY` of at least 32 characters
  and staging infrastructure URLs.
- `prod` has the same generated-secret requirement and must receive production
  infrastructure URLs through its deployment environment.

Do not commit `.env` files or real secrets. `BEIYU_DATABASE_URL` must use a
PostgreSQL URL such as
`postgresql+psycopg://beiyu:beiyu@localhost:5432/beiyu` for local development.

## Commands

```bash
make dev        # migrate the development database and start the reload server
make migrate    # apply Alembic migrations to BEIYU_DATABASE_URL
make test       # run tests against the dedicated localhost:5433/beiyu_test DB
make lint       # run Ruff
make typecheck  # run ty
make check      # migrate, lint, type-check, and test
```

Override the test database URL only with another dedicated database whose name
ends in `_test`:

```bash
make test TEST_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test
```

To create a new migration after a model change, run:

```bash
uv run alembic revision --autogenerate -m "describe change"
make migrate
```

## Service URLs

- API docs: `http://localhost:8000/docs` in development.
- Liveness: `http://localhost:8000/health/live`
- Readiness: `http://localhost:8000/health/ready`
- Versioned API root: `http://localhost:8000/api/v1`

The API namespace is `/api/v1`; liveness and readiness remain unversioned for
operational tooling.
