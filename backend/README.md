# Beiyu API

Stage 3 is the locally runnable account, content, and AI backend for Beiyu. It
includes phone OTP login, rotating access and refresh sessions, device
management, profile and privacy settings, age confirmation, startup bootstrap,
local-data sync, private cellar CRUD, published recipes, ingredients, bars,
drink knowledge, home configuration, search, versioned editorial
administration, normal AI conversations, temporary AI chat, controllable AI
memory, daily quota, deterministic safety routing, and a replaceable AI provider
boundary. PostgreSQL persistence, Alembic migrations, structured request logs,
health checks, OpenAPI contracts, Docker, and repeatable quality commands are
included.

Real SMS, media upload, legal-name verification, community persistence, payment,
and cloud infrastructure are intentionally not active yet.

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

`BEIYU_AI_PROVIDER=development` is accepted only in `dev`. It uses a local,
deterministic provider and never calls a model vendor. The production-ready
adapter boundary is present for Aliyun DashScope/OpenAI-compatible mode, but
staging and production require `BEIYU_AI_PROVIDER=aliyun`,
`BEIYU_AI_BASE_URL`, `BEIYU_AI_API_KEY`, a non-development model name, and an
independent `BEIYU_AI_MEMORY_HMAC_KEY`.

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

# Import canonical app content; repeating this is safe.
uv run python -m app.cli seed-content

# Promote a user who has logged in at least once.
uv run python -m app.cli promote-admin \
  --phone +8613800138000 \
  --role EDITOR
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

## Local Login Flow

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
`/auth/devices`, `/cellar`, and `/ai` endpoints. Refresh tokens are opaque,
stored only as hashes, rotate on every refresh, and expire after 90 days by
default. Phone numbers and OTP values are never stored in plaintext.

The API namespace is `/api/v1`; liveness and readiness remain unversioned for
operational tooling.

## Content Flow

Apply migrations and import the bundled editorial content:

```bash
cd backend
set -a && . ./.env && set +a
uv run alembic upgrade head
uv run python -m app.cli seed-content
```

Public content is available from `/home`, `/ingredients`, `/recipes`, `/bars`,
`/knowledge`, and `/search` under `/api/v1`. Public routes return only
`PUBLISHED` rows.

All `/api/v1/admin/*` content routes require a bearer token belonging to an
`EDITOR` or `SUPER_ADMIN`. New content starts as `DRAFT`; updates, publishing,
archiving, and rollback require `expectedRevision`. Every successful action
creates an immutable version snapshot. Rollback creates a new draft and never
publishes automatically.

The complete phone-to-Swagger-to-Expo walkthrough is in
[`docs/backend-stage2-local-demo.md`](../docs/backend-stage2-local-demo.md).

## AI Flow

AI endpoints are under `/api/v1/ai` and require a bearer token. A user must also
have completed age confirmation, must not be banned or deleted, and the
`BEIYU_AI_ENABLED` feature flag must be true.

The primary routes are:

- `GET /api/v1/ai/conversations`
- `POST /api/v1/ai/conversations`
- `GET /api/v1/ai/conversations/{conversationId}`
- `GET /api/v1/ai/conversations/{conversationId}/messages`
- `POST /api/v1/ai/conversations/{conversationId}/messages`
- `DELETE /api/v1/ai/conversations/{conversationId}`
- `POST /api/v1/ai/temporary-messages`
- `GET /api/v1/ai/memories`
- `DELETE /api/v1/ai/memories/{memoryId}`
- `DELETE /api/v1/ai/memories`
- `PATCH /api/v1/ai/memory-settings`
- `GET /api/v1/ai/usage/today`

Normal conversations persist user and assistant messages. Temporary chat uses
the caller-supplied context only during the request; it stores quota and usage
metadata but no temporary message text, no response message ID, and no memory.
Successful fixed safety replies still consume quota; provider timeout or
unavailable errors release the reserved quota.

The complete local AI walkthrough is in
[`docs/backend-stage3-ai-local-demo.md`](../docs/backend-stage3-ai-local-demo.md).
It also includes the Stage 3 end-to-end local acceptance checklist, Expo
`EXPO_PUBLIC_API_BASE_URL` startup examples, privacy and persistence smoke
queries, quota boundary setup, provider-timeout checks, and safety fixtures.
Frontend changes are guarded separately by
`.github/workflows/frontend-ci.yml`, which runs `npm ci`, lint, type checking,
and Jest in band on mobile frontend path changes.

## OpenAPI Contract Snapshot

`openapi.json` is the committed Stage 3 contract snapshot for frontend review.
Regenerate it from the running application schema after an intentional public
API change, then review its diff before committing:

```bash
cd backend
BEIYU_ENVIRONMENT=dev \
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu@localhost:5433/beiyu_test \
BEIYU_SECRET_KEY=change-me \
uv run python scripts/generate_openapi.py
```

The snapshot also contains public content routes, administrative content routes,
and AI routes. Review every change for unexpected paths and accidental exposure
of configuration, hashes, secrets, tokens, database UUIDs, chat text, provider
payloads, memory HMAC keys, API keys, or internal error details.
