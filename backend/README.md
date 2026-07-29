# Beiyu API

Stage 1 is the locally runnable private-data backend for Beiyu. It includes
phone OTP login, rotating access and refresh sessions, device management,
profile and privacy settings, age confirmation, startup bootstrap, local-data
sync, and private cellar CRUD. PostgreSQL persistence, Alembic migrations,
structured request logs, health checks, and repeatable quality commands are
included.

Real SMS, media upload, legal-name verification, AI chat, community features,
and cloud infrastructure are intentionally not active yet. Their boundaries
remain explicit so later providers can be added without changing the mobile
contracts delivered in this stage.

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

The API and both database ports are published on `127.0.0.1` only.
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

`BEIYU_SMS_PROVIDER=development` is accepted only in `dev`. It uses the fixed
local verification code `123456` and makes no network request. Staging and
production reject this provider at startup. A production SMS adapter and its
cloud credentials must be configured before either environment can start.

Do not commit `.env` files or real secrets. `BEIYU_DATABASE_URL` must use a
PostgreSQL URL such as
`postgresql+psycopg://beiyu:beiyu@localhost:5432/beiyu` for local development.
It is reserved for commands running on the host.

The containerized API receives `BEIYU_COMPOSE_DATABASE_URL` as its
`BEIYU_DATABASE_URL`. Its development placeholder uses Compose service hostname
`db` on port `5432`, because `localhost` inside the API container refers to the
API container itself. If you override the Compose database name, user, or
password, update `BEIYU_COMPOSE_DATABASE_URL` and the matching
`BEIYU_COMPOSE_POSTGRES_*` values together. All example credentials are local
development placeholders only.

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

## Local Stage 1 Flow

With the API running, request a local login code:

```bash
curl -X POST http://localhost:8000/api/v1/auth/sms-codes \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","scene":"LOGIN","installationId":"local-device-001"}'
```

Log in with development code `123456`:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","code":"123456","device":{"installationId":"local-device-001","platform":"IOS","deviceName":"Local iPhone","appVersion":"1.0.0"}}'
```

Use the returned access token as `Authorization: Bearer <token>` for `/me`,
`/auth/devices`, and `/cellar` endpoints. Refresh tokens are opaque, stored
only as hashes, rotate on every refresh, and expire after 90 days by default.
Phone numbers and OTP values are never stored in plaintext.

The API namespace is `/api/v1`; liveness and readiness remain unversioned for
operational tooling.

## OpenAPI Contract Snapshot

`openapi.json` is the committed Stage 1 contract snapshot for frontend review.
Regenerate it from the running application schema after an intentional public
API change, then review its diff before committing:

```bash
cd backend
BEIYU_ENVIRONMENT=dev \
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu@localhost:5433/beiyu_test \
BEIYU_SECRET_KEY=change-me \
uv run python scripts/generate_openapi.py
```

The snapshot contains health, authentication, device, profile, privacy,
bootstrap, local-sync, and private-cellar endpoints. Review every change for
unexpected paths and accidental exposure of configuration, hashes, secrets,
tokens, or internal error details.
