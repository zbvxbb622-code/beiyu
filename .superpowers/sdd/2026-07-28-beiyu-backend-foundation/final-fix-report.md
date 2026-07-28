# Beiyu Stage 0 Backend Final Fix Report

Date: 2026-07-28

Base: `22f29e095157b92dc756dc413eff35b01b75f76b`

Scope: the single final-review fix wave for the Stage 0 backend. No frontend
source was changed.

## Findings Mapped to Fixes

### 1. Container database URL

Root cause: copying `.env.example` to `.env` made Docker Compose interpolate
the host-development `BEIYU_DATABASE_URL`. Its `localhost` host then referred
to the API container, so the prestart Alembic migration could not reach the
PostgreSQL service.

Fix:

- Preserved host command configuration in `BEIYU_DATABASE_URL`, including the
  documented `localhost:5432` development placeholder.
- Added the Compose-only `BEIYU_COMPOSE_DATABASE_URL` and mapped it to the API
  container's `BEIYU_DATABASE_URL`.
- Gave the Compose-only URL a development placeholder using service host `db`
  and port `5432`.
- Namespaced Compose PostgreSQL component overrides under
  `BEIYU_COMPOSE_POSTGRES_*` and documented that component and URL overrides
  must be updated together.
- Bound API, development PostgreSQL, and test PostgreSQL published ports to
  `127.0.0.1`.
- Added PyYAML only to the development dependency group and regenerated
  `uv.lock`.
- Added structured tests that parse `compose.yml` with `yaml.safe_load`, parse
  the database URL with SQLAlchemy, prove default credential alignment, and
  assert exact loopback port mappings.

### 2. OpenAPI response contracts

Root cause: route return annotations used arbitrary dictionaries, so FastAPI
generated open-ended object schemas. The readiness route also did not declare
its actual unified `503` response.

Fix:

- Added explicit `ApiRootResponse`, `LivenessResponse`, `ReadinessChecks`, and
  `ReadinessResponse` Pydantic models.
- Added explicit `ErrorPayload` and `ErrorEnvelope` Pydantic models matching
  `{"error":{"code":string,"message":string,"details":object}}`.
- Applied explicit success response models to all three Stage 0 routes.
- Declared the readiness `503` response with `ErrorEnvelope`.
- Made the runtime error response builder serialize the same typed envelope
  used by OpenAPI.
- Added a deterministic OpenAPI generator and regenerated `openapi.json`.
- Added tests for the exact path set, response schema references, exact
  properties and required fields, readiness `503`, schema leakage, and
  byte-identical regeneration.

## Files

- `backend/.env.example`
- `backend/README.md`
- `backend/app/api/router.py`
- `backend/app/api/routes/health.py`
- `backend/app/core/errors.py`
- `backend/compose.yml`
- `backend/openapi.json`
- `backend/pyproject.toml`
- `backend/uv.lock`
- `backend/scripts/generate_openapi.py`
- `backend/tests/api/test_openapi.py`
- `backend/tests/tools/test_compose_config.py`
- `.superpowers/sdd/2026-07-28-beiyu-backend-foundation/final-fix-report.md`

## TDD Evidence

Baseline:

```text
uv run pytest --ignore=tests/migrations -q
31 passed in 2.43s
```

RED was recorded after adding only the focused tests and direct dev-only YAML
dependency:

```text
uv run pytest tests/tools/test_compose_config.py tests/api/test_openapi.py -q
5 failed, 1 passed in 0.09s
```

The five expected failures proved:

- the API still consumed `BEIYU_DATABASE_URL` instead of the Compose-only name;
- ports were not loopback-bound;
- success responses were inferred arbitrary dictionaries;
- readiness had no declared `503`;
- no deterministic OpenAPI generator existed.

GREEN after implementation:

```text
uv run pytest tests/tools/test_compose_config.py tests/api/test_openapi.py -q
6 passed in 0.45s
```

The leakage test passed during RED because the old schema happened not to leak
configuration. The remaining five tests demonstrated the missing behavior and
then passed after the implementation.

## Verification

The shell did not have `uv` on `PATH`. All uv checks used the available
`uv 0.9.26` binary at
`/Applications/Kimi.app/Contents/Resources/resources/daimon-bundle/runtime/uv/uv`.

Backend:

```text
uv sync --frozen
Audited 56 packages in 11ms

uv run ruff check .
All checks passed!

uv run ruff format --check .
33 files already formatted

uv run ty check
All checks passed!

BEIYU_DATABASE_URL=postgresql+psycopg://beiyu@localhost:5433/beiyu_test \
  uv run pytest -q
38 passed in 3.40s

BEIYU_DATABASE_URL=postgresql+psycopg://beiyu@localhost:5433/beiyu_test \
  uv run alembic upgrade head
Running upgrade  -> 20260728_0001, Create system metadata.
```

The full backend suite used the real dedicated PostgreSQL instance. The final
Alembic command restored it to head after the migration test's downgrade.

Frontend:

```text
npm run typecheck
exit 0

npm run lint
exit 0

npm test -- --runInBand
51 suites passed, 151 tests passed
```

OpenAPI:

```text
uv run pytest \
  tests/api/test_openapi.py::test_openapi_does_not_expose_secrets_configuration_or_stack_traces \
  tests/api/test_openapi.py::test_openapi_snapshot_is_byte_identical_to_regeneration -q
2 passed in 0.47s
```

The complete focused OpenAPI/Compose suite and full backend suite repeated
these checks successfully.

Compose:

```text
uv run pytest tests/tools/test_compose_config.py -q
2 passed in 0.02s

docker compose config
zsh: command not found: docker
```

Docker is not installed locally, so Docker-backed config validation, image
build, prestart smoke, and service probes remain unavailable. The best
available static validation uses a real YAML parser and validates the
consumer-visible URL and port structures rather than searching source text.

Security and repository hygiene:

```text
git grep --untracked -n -I -E <private-key/access-token patterns>
no matches (expected exit 1)

git diff --check
exit 0
```

The complete diff was inspected. Added credential values are only the existing
local-development placeholders `beiyu` and `change-me`; no real secret,
certificate, key, token, stack trace, database URL, or internal configuration
is present in `openapi.json`. No frontend file appears in the change set.

## Self-Review

- Correctness: changing the API URL back to the host variable, changing its
  default host from `db`, desynchronizing default credentials, removing a
  loopback binding, removing a response model, or removing readiness `503`
  documentation causes a focused test failure.
- Readability: response models remain beside their small owning route modules;
  the error envelope remains beside error serialization; the generator has one
  deterministic serialization path.
- Architecture: the change stays within Stage 0 operational/configuration
  boundaries and introduces no business module, authentication, or frontend
  dependency.
- Security: public bindings are narrowed to loopback, examples remain obvious
  development placeholders, and both schema and repository secret scans pass.
- Performance: response model validation and schema generation add negligible
  Stage 0 overhead; no request I/O or database-query behavior changed.
- Dependency review: PyYAML was already present transitively through the
  FastAPI standard toolchain. It is now declared directly only for tests, with
  a two-line lockfile metadata change and no new resolved package.

## Residual Risks

- Container runtime behavior could not be exercised because Docker is absent.
  Static parsed Compose validation covers the reviewed defect, but not image
  build, engine-specific interpolation, health-check timing, or prestart
  execution.
- Custom Compose credentials are intentionally configured through separate
  component and URL variables. They are aligned by default and explicitly
  documented, but operators must update them together when overriding them.
