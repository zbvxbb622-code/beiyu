# Beiyu Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Stage 0 Beiyu backend foundation so the FastAPI service starts locally, exposes stable health endpoints, connects to PostgreSQL, runs Alembic migrations, emits structured logs, and has repeatable quality checks.

**Architecture:** Add an independent `backend/` Python workspace beside the Expo app. Reuse the MIT-licensed FastAPI official full-stack template's proven project, configuration, migration, container, and test patterns, then reduce them to a modular API-only service. Keep business modules out of Stage 0 so Stage 1 can add auth, users, bootstrap sync, and cellar behavior on a stable foundation.

**Tech Stack:** Python 3.12, FastAPI, SQLModel, Pydantic Settings, PostgreSQL 16, psycopg 3, Alembic, pytest, HTTPX, Ruff, ty, uv, Docker Compose.

## Global Constraints

- Mobile API prefix is `/api/v1`; operational probes remain unversioned at `/health/live` and `/health/ready`.
- Public JSON fields use camelCase; Python and database fields use snake_case.
- All errors use `{ "error": { "code": string, "message": string, "details": object } }`.
- Environments are exactly `dev`, `staging`, and `prod`.
- Real secrets never enter source control; only placeholder values belong in `.env.example`.
- Stage 0 does not implement authentication, user data, Redis-backed rate limiting, OSS, SMS, AI, moderation, or business tables.
- Python runtime floor is 3.12 so development works with the available local runtime and current Alibaba Cloud images.
- Borrowed or substantially adapted source retains the upstream MIT notice in `backend/THIRD_PARTY_NOTICES.md`.

---

### Task 1: Create the isolated backend workspace and executable health contract

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/uv.lock`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/router.py`
- Create: `backend/app/api/routes/__init__.py`
- Create: `backend/app/api/routes/health.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/api/test_health.py`
- Create: `backend/THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Produces: `app.main:app`, the FastAPI ASGI application.
- Produces: `GET /health/live -> {"status": "ok", "service": "beiyu-api"}`.
- Produces: `GET /api/v1 -> {"name": "Beiyu API", "version": "v1"}`.
- Consumes: no database or external services.

- [ ] **Step 1: Add the dependency manifest and provenance notice**

Use the official `fastapi/full-stack-fastapi-template` backend as the structural reference. Keep only FastAPI, SQLModel, Pydantic Settings, psycopg, Alembic, HTTPX, pytest, Ruff, ty, and coverage dependencies. Set:

```toml
[project]
name = "beiyu-api"
version = "0.1.0"
requires-python = ">=3.12,<3.15"

[tool.fastapi]
entrypoint = "app.main:app"
```

Record the upstream repository URL, the inspected commit, the borrowed categories, and the full MIT license text in `THIRD_PARTY_NOTICES.md`.

- [ ] **Step 2: Write the failing health tests**

```python
def test_liveness(client: TestClient) -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "beiyu-api"}


def test_api_root(client: TestClient) -> None:
    response = client.get("/api/v1")
    assert response.status_code == 200
    assert response.json() == {"name": "Beiyu API", "version": "v1"}
```

- [ ] **Step 3: Run the health tests and verify RED**

Run: `cd backend && uv run pytest tests/api/test_health.py -q`

Expected: collection or import failure because `app.main` and the routes do not exist yet.

- [ ] **Step 4: Implement the minimal app and routers**

Create one route function per HTTP operation, put router prefixes and tags on `APIRouter`, and have `app.main` include the operational and versioned routers.

- [ ] **Step 5: Run the health tests and verify GREEN**

Run: `cd backend && uv run pytest tests/api/test_health.py -q`

Expected: `2 passed`.

- [ ] **Step 6: Commit the workspace**

```bash
git add backend/pyproject.toml backend/uv.lock backend/app backend/tests backend/THIRD_PARTY_NOTICES.md
git commit -m "feat: scaffold Beiyu FastAPI backend"
```

### Task 2: Add validated environment configuration and stable error responses

**Files:**
- Create: `backend/.env.example`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/errors.py`
- Modify: `backend/app/main.py`
- Modify: `.gitignore`
- Create: `backend/tests/core/test_config.py`
- Create: `backend/tests/api/test_errors.py`

**Interfaces:**
- Produces: `Settings`, `Environment`, and cached `get_settings()`.
- Produces: `AppError(code, message, status_code, details)`.
- Produces: normalized validation and unhandled-error response bodies.
- Consumes: environment variables prefixed with `BEIYU_`.

- [ ] **Step 1: Write failing configuration tests**

Cover these exact behaviors:

```python
def test_settings_default_to_dev() -> None:
    settings = Settings(database_url="postgresql+psycopg://user:pass@db/beiyu")
    assert settings.environment is Environment.DEV
    assert settings.api_v1_prefix == "/api/v1"


def test_prod_rejects_placeholder_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="change-me",
        )
```

- [ ] **Step 2: Run configuration tests and verify RED**

Run: `cd backend && uv run pytest tests/core/test_config.py -q`

Expected: import failure because `app.core.config` does not exist.

- [ ] **Step 3: Implement typed settings**

Use `pydantic-settings`, a string enum for `dev`, `staging`, and `prod`, explicit database/Redis URL types, a generated-secret requirement outside dev, and `BEIYU_` environment prefixes. Do not read `.env` in production implicitly.

- [ ] **Step 4: Run configuration tests and verify GREEN**

Run: `cd backend && uv run pytest tests/core/test_config.py -q`

Expected: all tests pass.

- [ ] **Step 5: Write failing error-contract tests**

Add a test-only route that raises `AppError("RESOURCE_CONFLICT", "资源状态冲突", 409, {"field": "id"})`, then assert the exact JSON envelope. Send an invalid query parameter and assert FastAPI validation errors are normalized to code `VALIDATION_ERROR` with HTTP 422.

- [ ] **Step 6: Run error tests and verify RED**

Run: `cd backend && uv run pytest tests/api/test_errors.py -q`

Expected: default FastAPI error JSON or missing handler.

- [ ] **Step 7: Implement exception handlers**

Register handlers through a `register_exception_handlers(app)` function. Never expose exception class names, stack traces, database text, or raw third-party responses.

- [ ] **Step 8: Run error tests and verify GREEN**

Run: `cd backend && uv run pytest tests/api/test_errors.py -q`

Expected: all tests pass with the documented envelope.

- [ ] **Step 9: Protect local secrets**

Add `backend/.env`, `backend/.env.*`, certificates, keys, coverage output, Python caches, and `.venv` to `.gitignore`; explicitly unignore `backend/.env.example`.

- [ ] **Step 10: Commit configuration and errors**

```bash
git add .gitignore backend/.env.example backend/app/core backend/app/main.py backend/tests/core backend/tests/api/test_errors.py
git commit -m "feat: add backend configuration and error contracts"
```

### Task 3: Add structured request logging and request IDs

**Files:**
- Create: `backend/app/core/logging.py`
- Create: `backend/app/core/middleware.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/api/test_request_context.py`

**Interfaces:**
- Produces: `X-Request-ID` on every response.
- Consumes: an optional valid client `X-Request-ID`; generates a UUID when absent or invalid.
- Produces: one structured completion log with method, path template, status, duration, environment, and request ID.

- [ ] **Step 1: Write failing request-context tests**

Test that a missing ID is generated, a valid ID is echoed, an overlong/control-character value is replaced, and the response ID is present on both success and handled errors.

- [ ] **Step 2: Run request-context tests and verify RED**

Run: `cd backend && uv run pytest tests/api/test_request_context.py -q`

Expected: `X-Request-ID` is missing.

- [ ] **Step 3: Implement middleware and structured logging**

Use standard-library logging with JSON output. Redact authorization, cookies, phone numbers, SMS codes, tokens, request bodies, and AI prompts by never logging them in request middleware.

- [ ] **Step 4: Run request-context tests and verify GREEN**

Run: `cd backend && uv run pytest tests/api/test_request_context.py -q`

Expected: all tests pass without warning output.

- [ ] **Step 5: Commit request observability**

```bash
git add backend/app/core/logging.py backend/app/core/middleware.py backend/app/main.py backend/tests/api/test_request_context.py
git commit -m "feat: add request tracing and structured logs"
```

### Task 4: Add PostgreSQL session management, readiness checks, and Alembic

**Files:**
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/models/__init__.py`
- Create: `backend/app/db/models/system.py`
- Create: `backend/alembic.ini`
- Create: `backend/app/alembic/README`
- Create: `backend/app/alembic/env.py`
- Create: `backend/app/alembic/script.py.mako`
- Create: `backend/app/alembic/versions/20260728_0001_create_system_metadata.py`
- Modify: `backend/app/api/routes/health.py`
- Create: `backend/tests/db/test_session.py`
- Create: `backend/tests/api/test_readiness.py`
- Create: `backend/tests/migrations/test_migrations.py`

**Interfaces:**
- Produces: `get_engine()`, `get_session()`, and `check_database()`.
- Produces: `GET /health/ready` returning 200 only when required dependencies are reachable.
- Produces: Alembic upgrade from empty PostgreSQL to `head` and downgrade back to `base`.

- [ ] **Step 1: Write failing session and readiness tests**

Inject a successful database checker and assert:

```python
assert response.status_code == 200
assert response.json() == {
    "status": "ready",
    "checks": {"database": "ok"},
}
```

Inject a failing checker and assert HTTP 503 with code `SERVICE_UNAVAILABLE`, without raw connection text.

- [ ] **Step 2: Run database boundary tests and verify RED**

Run: `cd backend && uv run pytest tests/db/test_session.py tests/api/test_readiness.py -q`

Expected: database module and readiness endpoint are missing.

- [ ] **Step 3: Implement the SQLModel engine and readiness dependency**

Use a lazily cached sync engine with `pool_pre_ping=True`; keep request handlers synchronous while the database path is synchronous. Execute parameterized `SELECT 1` for readiness.

- [ ] **Step 4: Run database boundary tests and verify GREEN**

Run: `cd backend && uv run pytest tests/db/test_session.py tests/api/test_readiness.py -q`

Expected: all tests pass using dependency overrides without requiring Docker.

- [ ] **Step 5: Write failing migration smoke test**

Against the Compose test database, run `alembic upgrade head`, inspect the expected `system_metadata` table and `alembic_version`, then run `alembic downgrade base`.

- [ ] **Step 6: Run migration smoke test and verify RED**

Run: `cd backend && BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/migrations/test_migrations.py -q`

Expected: Alembic configuration or revision is missing.

- [ ] **Step 7: Adapt the official template Alembic wiring**

Point Alembic at the typed settings object and import all SQLModel metadata from `app.db.models`. The initial `system_metadata` table stores only schema bootstrap metadata; no user or business data enters Stage 0.

- [ ] **Step 8: Run migration smoke test and verify GREEN**

Run the same migration test and expect upgrade/downgrade success.

- [ ] **Step 9: Commit the database foundation**

```bash
git add backend/app/db backend/app/alembic backend/alembic.ini backend/app/api/routes/health.py backend/tests/db backend/tests/api/test_readiness.py backend/tests/migrations
git commit -m "feat: add PostgreSQL and Alembic foundation"
```

### Task 5: Add reproducible local services and developer commands

**Files:**
- Create: `backend/compose.yml`
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `backend/Makefile`
- Create: `backend/README.md`
- Create: `backend/scripts/prestart.sh`
- Create: `.github/workflows/backend-ci.yml`

**Interfaces:**
- Produces: local PostgreSQL on port `5432` and test PostgreSQL on port `5433`.
- Produces: `make dev`, `make test`, `make lint`, `make typecheck`, `make migrate`, and `make check`.
- Produces: CI running lockfile-verified install, lint, type checks, tests, and migration smoke checks.

- [ ] **Step 1: Add Compose and image configuration**

Adapt the official template's multi-stage/container patterns to Python 3.12 and API-only scope. Pin PostgreSQL by major version, add health checks, avoid baked-in secrets, run as a non-root application user, and use an explicit production command.

- [ ] **Step 2: Add developer commands and documentation**

Document exact prerequisites, first run, environment setup, migration workflow, tests, API docs URL, health URLs, and the distinction between `dev`, `staging`, and `prod`.

- [ ] **Step 3: Add backend CI**

Trigger only when `backend/**` or the backend workflow changes. Use Python 3.12, install from `uv.lock` with `uv sync --frozen`, start PostgreSQL as a service, run migrations, then run `ruff`, `ty`, and `pytest`.

- [ ] **Step 4: Validate container configuration**

Run: `cd backend && docker compose config`

Expected: valid configuration with no unresolved required variables in dev.

- [ ] **Step 5: Run the full local quality gate**

Run: `cd backend && make check`

Expected: migrations apply, Ruff passes, ty passes, and pytest passes with no warnings.

- [ ] **Step 6: Start the service and probe it**

Run: `cd backend && docker compose up -d --build`

Then verify:

```text
GET http://localhost:8000/health/live   -> 200
GET http://localhost:8000/health/ready  -> 200
GET http://localhost:8000/docs          -> 200 in dev
```

- [ ] **Step 7: Commit developer experience and CI**

```bash
git add backend/compose.yml backend/Dockerfile backend/.dockerignore backend/Makefile backend/README.md backend/scripts .github/workflows/backend-ci.yml
git commit -m "build: add backend development and CI workflow"
```

### Task 6: Stage 0 final verification and contract snapshot

**Files:**
- Create: `backend/openapi.json`
- Modify: `backend/README.md`

**Interfaces:**
- Produces: committed OpenAPI snapshot for frontend contract review.
- Consumes: the complete Stage 0 backend.

- [ ] **Step 1: Generate the OpenAPI snapshot**

Generate `backend/openapi.json` from `app.main:app`, using stable sorted JSON formatting.

- [ ] **Step 2: Run all backend verification**

Run:

```bash
cd backend
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run ty check app
uv run pytest -q
uv run alembic upgrade head
```

Expected: every command exits 0 with no warnings that indicate leaked tasks, unclosed resources, or deprecated APIs.

- [ ] **Step 3: Inspect the public contract**

Confirm the OpenAPI document contains only the Stage 0 endpoints, all documented responses have schemas, and no internal configuration, secret, or stack-trace field appears.

- [ ] **Step 4: Run frontend regression checks**

Run from the repository root:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

Expected: the existing Expo frontend remains green because the backend workspace is isolated.

- [ ] **Step 5: Commit the verified Stage 0 contract**

```bash
git add backend/openapi.json backend/README.md
git commit -m "docs: publish Beiyu backend stage zero contract"
```

