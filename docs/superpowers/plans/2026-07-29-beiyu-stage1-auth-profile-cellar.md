# Beiyu Stage 1 Auth, Profile, and Cellar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a locally runnable account system with development SMS codes, secure device sessions, user profile and privacy APIs, bootstrap/local sync, and private cellar CRUD so the Expo app can replace its first group of local mocks before cloud infrastructure exists.

**Architecture:** Keep the Stage 0 synchronous FastAPI and SQLModel modular monolith. Adapt the maintained MIT-licensed `fastapi/full-stack-fastapi-template` security/dependency patterns and the `fastapi-users` authentication strategy boundaries, but use Beiyu-specific phone OTP, opaque rotating refresh tokens, and device sessions. External SMS remains behind a provider interface: development uses a fixed code and production configuration rejects that provider until an approved cloud adapter is supplied.

**Tech Stack:** Python 3.12, FastAPI, SQLModel, PostgreSQL 16, Alembic, PyJWT, phonenumbers, Pydantic 2, pytest, HTTPX, Ruff, ty, Docker Compose.

## Global Constraints

- Mobile API prefix remains `/api/v1`; public JSON fields use camelCase.
- All errors retain `{ "error": { "code": string, "message": string, "details": object } }`.
- Phone numbers are normalized to mainland China E.164 form and are never stored in plaintext.
- Phone lookup and OTP comparison use keyed HMAC values derived from `BEIYU_SECRET_KEY`.
- Access tokens expire after 15 minutes; opaque refresh tokens expire after 90 days and only their hashes are stored.
- Refresh tokens rotate after every successful refresh; logout or device removal revokes the matching sessions.
- A user can have at most five active devices; adding a sixth device revokes the least recently active device and all of its sessions.
- The development SMS provider uses code `123456`; staging and production reject the development provider at startup.
- OTPs expire after five minutes, can be requested once per minute, and are limited per phone, IP, and device.
- User profile and cellar resources are private and always scoped to the authenticated user.
- Stage 1 does not send real SMS, upload media, perform legal-name verification, or call cloud services.
- Adapted source provenance and MIT notices stay current in `backend/THIRD_PARTY_NOTICES.md`.

---

### Task 1: Add Stage 1 dependencies, configuration, schemas, and provenance

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/uv.lock`
- Modify: `backend/.env.example`
- Modify: `backend/app/core/config.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/base.py`
- Modify: `backend/THIRD_PARTY_NOTICES.md`
- Test: `backend/tests/core/test_config.py`
- Test: `backend/tests/schemas/test_base.py`

**Interfaces:**
- Produces: `ApiModel`, a Pydantic base model that accepts snake_case internally and emits camelCase JSON.
- Produces: typed settings for token lifetimes, SMS provider, OTP timing, and device limits.
- Consumes: `BEIYU_SECRET_KEY` as the HMAC/JWT secret.

- [ ] **Step 1: Write failing configuration and camelCase tests**

```python
def test_stage_one_security_defaults_are_safe_in_dev() -> None:
    settings = Settings(database_url="postgresql+psycopg://user:pass@db/beiyu")
    assert settings.access_token_minutes == 15
    assert settings.refresh_token_days == 90
    assert settings.sms_provider == "development"
    assert settings.sms_development_code == "123456"
    assert settings.max_active_devices == 5


def test_prod_rejects_development_sms_provider() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment="prod",
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="x" * 32,
            sms_provider="development",
        )


def test_api_model_serializes_camel_case() -> None:
    class Example(ApiModel):
        refresh_token: str

    assert Example(refresh_token="token").model_dump(by_alias=True) == {
        "refreshToken": "token"
    }
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd backend && .venv/bin/pytest tests/core/test_config.py tests/schemas/test_base.py -q`

Expected: imports or attributes are missing.

- [ ] **Step 3: Add maintained dependencies and typed settings**

Add `pyjwt` and `phonenumbers` with bounded compatible versions. Add integer settings with validation for access token minutes, refresh token days, OTP expiry/retry limits, and active device count. Add a string enum with `development` and `aliyun`; only `development` is executable in Stage 1.

- [ ] **Step 4: Implement `ApiModel`**

Use Pydantic's `to_camel` alias generator with:

```python
model_config = ConfigDict(
    alias_generator=to_camel,
    populate_by_name=True,
    serialize_by_alias=True,
)
```

- [ ] **Step 5: Update provenance**

Record:

- `fastapi/full-stack-fastapi-template` commit `c9e70d65c74f7adda417fc8de0757207ff77514c`.
- `fastapi-users/fastapi-users` commit `d02c73b69582c0e69210a6d7d527b4eb4ebe1bb6`.
- The adapted security, bearer dependency, strategy/provider, and test-fixture patterns.

- [ ] **Step 6: Regenerate the lockfile and verify GREEN**

Run the focused tests, Ruff, and ty. Commit:

```text
build: add stage one auth contracts
```

### Task 2: Add account, session, OTP, profile, and cellar persistence

**Files:**
- Create: `backend/app/db/models/accounts.py`
- Create: `backend/app/db/models/cellar.py`
- Modify: `backend/app/db/models/__init__.py`
- Create: `backend/app/alembic/versions/20260729_0002_create_accounts_and_cellar.py`
- Test: `backend/tests/db/test_stage_one_models.py`
- Modify: `backend/tests/migrations/test_migrations.py`

**Interfaces:**
- Produces: `User`, `UserProfile`, `UserDevice`, `AuthSession`, `SmsCode`, and `CellarItem`.
- Produces: enums `UserStatus`, `MembershipLevel`, `DevicePlatform`, `SmsScene`, and `CellarItemSource`.
- Enforces: unique phone hash, unique active ingredient per user, indexed active sessions and OTP lookup.

- [ ] **Step 1: Write failing metadata and constraint tests**

Assert table names, UUID primary keys, timezone-aware timestamps, foreign-key cascade behavior, and these database constraints:

```text
users.phone_hash unique
user_profiles.user_id unique/primary
user_devices(user_id, installation_id_hash) unique
auth_sessions.refresh_token_hash unique
cellar_items(user_id, ingredient_key) unique for non-deleted ingredient rows
```

- [ ] **Step 2: Run model tests and verify RED**

Expected: account and cellar models do not exist.

- [ ] **Step 3: Implement focused SQLModel tables**

Use PostgreSQL enums, JSONB for validated privacy settings, `DateTime(timezone=True)`, and partial unique indexes where soft deletion requires them. Store OTP failure count and request fingerprints needed by the Stage 1 rate limiter.

- [ ] **Step 4: Write and apply migration `20260729_0002`**

The migration upgrades from `20260728_0001` and downgrades without touching `system_metadata`.

- [ ] **Step 5: Verify model and migration tests**

Run model tests, upgrade/downgrade smoke tests, Ruff, and ty. Commit:

```text
feat: add account and cellar persistence
```

### Task 3: Add security primitives and replaceable SMS delivery

**Files:**
- Create: `backend/app/core/security.py`
- Create: `backend/app/integrations/__init__.py`
- Create: `backend/app/integrations/sms/__init__.py`
- Create: `backend/app/integrations/sms/base.py`
- Create: `backend/app/integrations/sms/development.py`
- Create: `backend/app/modules/__init__.py`
- Create: `backend/app/modules/auth/__init__.py`
- Create: `backend/app/modules/auth/security.py`
- Test: `backend/tests/core/test_security.py`
- Test: `backend/tests/integrations/test_sms_provider.py`

**Interfaces:**
- Produces: `normalize_cn_phone(phone: str) -> str`.
- Produces: `phone_hash`, `mask_phone`, `otp_hash`, `refresh_token_hash`.
- Produces: `create_access_token(user_id, session_id)` and `decode_access_token(token)`.
- Produces: `create_refresh_token() -> tuple[plain_token, token_hash]`.
- Produces: `SmsProvider.send_code(phone, code, expires_minutes)`.

- [ ] **Step 1: Write failing primitive tests**

Cover mainland phone normalization, rejection of invalid/non-mainland numbers, stable keyed hashes, masked output, access-token expiry/type/audience, invalid signatures, opaque refresh-token uniqueness, and provider selection.

- [ ] **Step 2: Verify RED**

Run only security and SMS provider tests.

- [ ] **Step 3: Adapt upstream JWT and strategy boundaries**

Adapt the official template's PyJWT encode/decode flow and `fastapi-users` provider/strategy separation. Extend claims with `sid`, `type="access"`, `aud="beiyu-mobile"`, `iat`, and `exp`. Never log tokens, phone numbers, or OTP values.

- [ ] **Step 4: Implement development SMS**

The provider accepts a normalized phone and records no plaintext data. It performs no network request. The code remains available only to the auth service for hashing and test assertions.

- [ ] **Step 5: Verify GREEN and commit**

Run focused tests, Ruff, and ty. Commit:

```text
feat: add secure token and SMS boundaries
```

### Task 4: Implement OTP issuance and phone login

**Files:**
- Create: `backend/app/modules/auth/schemas.py`
- Create: `backend/app/modules/auth/service.py`
- Create: `backend/app/api/routes/auth.py`
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/api/test_auth_login.py`
- Test: `backend/tests/modules/auth/test_otp_service.py`

**Interfaces:**
- Produces: `POST /api/v1/auth/sms-codes`.
- Produces: `POST /api/v1/auth/login`.
- Creates: a user and default profile on first successful login.
- Creates or updates: a device identified by a hashed installation ID.
- Returns: access token, refresh token, expiry, `isNewUser`, user summary, and current device.

- [ ] **Step 1: Write failing API tests**

Test exact request/response contracts, camelCase output, `123456` success in dev, wrong/expired/consumed code rejection, generic send response, one-minute retry, phone/IP/device limits, and no phone/OTP leakage in responses.

- [ ] **Step 2: Verify RED**

Expected: auth routes are absent.

- [ ] **Step 3: Implement transactional OTP issuance**

Normalize the phone, apply database-backed limits, consume earlier active OTPs, store only keyed hashes, and call `SmsProvider`. Return `202` with:

```json
{"expiresIn": 300, "retryAfter": 60}
```

- [ ] **Step 4: Implement transactional login**

Lock the active OTP row, increment failures atomically, consume on success, find/create the user, create the default profile, upsert the device, enforce the five-device rule, and create one refresh session.

- [ ] **Step 5: Verify GREEN and commit**

Run focused API/service tests and full non-migration tests. Commit:

```text
feat: add phone OTP login
```

### Task 5: Implement authentication dependency, refresh rotation, logout, and devices

**Files:**
- Create: `backend/app/modules/auth/dependencies.py`
- Modify: `backend/app/modules/auth/service.py`
- Modify: `backend/app/modules/auth/schemas.py`
- Modify: `backend/app/api/routes/auth.py`
- Test: `backend/tests/api/test_auth_sessions.py`
- Test: `backend/tests/api/test_auth_devices.py`

**Interfaces:**
- Produces: `CurrentUser`, `CurrentSession`, and `AuthContext` FastAPI dependencies.
- Produces: `POST /api/v1/auth/refresh`.
- Produces: `POST /api/v1/auth/logout`.
- Produces: `GET /api/v1/auth/devices`.
- Produces: `DELETE /api/v1/auth/devices/{deviceId}`.

- [ ] **Step 1: Write failing session tests**

Cover valid bearer access, malformed/expired token, revoked session, deleted user, refresh rotation/replay rejection, logout, cross-user device deletion, current-device flag, and automatic oldest-device revocation on device six.

- [ ] **Step 2: Verify RED**

Expected: protected endpoints/dependencies are absent.

- [ ] **Step 3: Implement bearer dependency**

Decode the access token, load both user and session, verify ownership and revocation, update device `last_active_at` conservatively, and return a typed context. Authentication errors return `401` with `WWW-Authenticate: Bearer`.

- [ ] **Step 4: Implement rotation and device revocation**

Use row locks for refresh rotation. A replayed old refresh token fails. Device removal revokes every session for that device in one transaction.

- [ ] **Step 5: Verify GREEN and commit**

Run auth API tests, full non-migration tests, Ruff, and ty. Commit:

```text
feat: add device-aware auth sessions
```

### Task 6: Implement profile, privacy, age confirmation, bootstrap, and account deletion

**Files:**
- Create: `backend/app/modules/users/__init__.py`
- Create: `backend/app/modules/users/schemas.py`
- Create: `backend/app/modules/users/service.py`
- Create: `backend/app/api/routes/me.py`
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/api/test_me.py`
- Test: `backend/tests/modules/users/test_user_service.py`

**Interfaces:**
- Produces: `GET /api/v1/me/bootstrap`.
- Produces: `GET /api/v1/me/profile`.
- Produces: `PATCH /api/v1/me/profile`.
- Produces: `PATCH /api/v1/me/privacy`.
- Produces: `POST /api/v1/me/age-confirmation`.
- Produces: `DELETE /api/v1/me/account`.

- [ ] **Step 1: Write failing profile/bootstrap tests**

Cover frontend field limits and dates, partial updates, privacy-first defaults, age-confirmation idempotency, token protection, and camelCase bootstrap shape. Ensure profile responses never expose phone hashes or internal token/session values.

- [ ] **Step 2: Verify RED**

Expected: `/me` routes are absent.

- [ ] **Step 3: Implement profile and bootstrap**

Map the existing Expo `UserProfile`, `PrivacySettings`, and `AccountSecurity` shapes into stable API schemas. Return AI quota placeholders and feature flags without claiming cloud integrations are active.

- [ ] **Step 4: Implement deletion**

Mark the user deleted, anonymize profile fields, revoke devices/sessions, and soft-delete private cellar rows. Do not hard-delete rows needed for later public-content anonymization.

- [ ] **Step 5: Verify GREEN and commit**

Run focused and full tests. Commit:

```text
feat: add private user profile APIs
```

### Task 7: Implement private cellar CRUD and idempotent local sync

**Files:**
- Create: `backend/app/modules/cellar/__init__.py`
- Create: `backend/app/modules/cellar/schemas.py`
- Create: `backend/app/modules/cellar/service.py`
- Create: `backend/app/api/routes/cellar.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/api/routes/me.py`
- Test: `backend/tests/api/test_cellar.py`
- Test: `backend/tests/api/test_local_sync.py`
- Test: `backend/tests/modules/cellar/test_cellar_service.py`

**Interfaces:**
- Produces: cellar list/create/update/delete endpoints.
- Produces: `POST /api/v1/cellar/items/batch`.
- Produces: `POST /api/v1/me/local-sync`.
- Accepts: existing frontend ingredient string IDs and private custom items.

- [ ] **Step 1: Write failing ownership and merge tests**

Cover ingredient deduplication, normalized custom-name deduplication, soft-delete restore, cross-user isolation, idempotent repeated batches, cloud-first profile merge, and union of local/cloud cellar IDs.

- [ ] **Step 2: Verify RED**

Expected: cellar routes/services are absent.

- [ ] **Step 3: Implement CRUD**

Every query includes the current user ID and excludes `deleted_at` rows. Ingredient items and custom items obey their own uniqueness rules.

- [ ] **Step 4: Implement local sync**

In one transaction: fill only empty cloud profile fields, preserve privacy-first server defaults unless the user explicitly opts into sync, record age confirmation, merge cellar items, and return the same bootstrap schema used at startup.

- [ ] **Step 5: Verify GREEN and commit**

Run focused and full tests. Commit:

```text
feat: add private cellar and local sync
```

### Task 8: Publish the Stage 1 contract and run full verification

**Files:**
- Modify: `backend/openapi.json`
- Modify: `backend/README.md`
- Modify: `backend/.env.example`
- Modify: `docs/superpowers/specs/2026-07-28-backend-architecture-design.md`
- Test: `backend/tests/api/test_openapi.py`
- Test: `backend/tests/tools/test_compose_config.py`

**Interfaces:**
- Produces: a reviewed OpenAPI snapshot for frontend integration.
- Documents: local fixed-code login and the exact cloud cutover variables.

- [ ] **Step 1: Add contract assertions**

Assert every Stage 1 path, bearer security declaration, camelCase schema, normalized error response, and absence of settings/secrets/internal hash fields.

- [ ] **Step 2: Regenerate and review OpenAPI**

Generate `backend/openapi.json`; inspect the diff for accidental internal fields and unstable operation names.

- [ ] **Step 3: Run the full quality gate**

Run, in order:

```text
alembic upgrade head
ruff format --check .
ruff check .
ty check
pytest --ignore=tests/migrations
pytest tests/migrations/test_migrations.py
docker compose build api
docker compose up -d
GET /health/ready
```

- [ ] **Step 4: Review source provenance and security**

Confirm no plaintext phone, OTP, refresh token, cloud key, `.env`, or test secret appears in tracked files or OpenAPI.

- [ ] **Step 5: Commit documentation**

```text
docs: publish stage one backend contract
```

- [ ] **Step 6: Push and open a stacked pull request**

Push `codex/backend-stage1-auth-cellar`. Until the foundation PR is merged, use `codex/backend-foundation` as the PR base; retarget to `main` after the foundation merge.
