# Beiyu Stage 3 AI Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Expo app's local fake login and rule-based chat with real backend authentication, PostgreSQL-backed AI conversations, temporary chat, Beijing-time quota, transparent memories, deterministic safety handling, and a configurable model-provider boundary.

**Architecture:** Stage 3A first connects Expo to the existing Stage 1 authentication, bootstrap, profile, privacy, and cellar APIs. Stage 3B adds a transactional AI domain to FastAPI, with provider calls outside database transactions and strict separation among access, quota, safety, memory, conversation, and provider modules. Stage 3C adds a runtime-only mobile AI repository/provider and rewires the existing Qwen-inspired screen without persisting chat text on the device.

**Tech Stack:** Python 3.12, FastAPI, SQLModel/SQLAlchemy, PostgreSQL 16, Alembic, Pydantic, HTTPX, Pytest, Ruff, ty, Expo 57, React Native 0.86, Expo Router, TypeScript 6, Zod 4, `expo-secure-store`, `expo-crypto`, AsyncStorage, Jest, React Native Testing Library.

**Approved Design:** `docs/superpowers/specs/2026-07-29-beiyu-stage3-ai-core-design.md`

## Global Constraints

- Keep `/api/v1`, camelCase JSON, Bearer authentication, and the existing `ErrorEnvelope`.
- The backend is the only source of truth for normal conversations, messages, quota, and AI memories.
- Use synchronous FastAPI routes and SQLModel sessions, matching the existing backend.
- Use ordinary request/response calls; Stage 3 does not add streaming.
- Default to `DevelopmentAiProvider`; it must never access the network.
- `development` AI and SMS providers are allowed only in `dev`.
- Aliyun calls require HTTPS, an allowlisted base URL, a model, and a secret API key.
- Keep provider calls outside long-running database transactions.
- Normal and temporary chat share 50 successful replies per Beijing calendar day.
- Accept at most 10 AI sends per user per minute and one active reservation per user.
- Reserve quota for 120 seconds; provider timeout is 20 seconds.
- User input is 1-2,000 trimmed characters; provider output is capped at 8,000 characters.
- Context contains at most 20 messages; temporary context is also capped at 12,000 characters.
- Store at most 20 active memories per user.
- Temporary messages and context must never enter PostgreSQL, AsyncStorage, SecureStore, or logs.
- Refresh tokens go only to SecureStore; access tokens stay only in React memory.
- Never log message text, prompts, memories, phone numbers, tokens, API keys, or full user UUIDs.
- Do not add Redis, queues, vector databases, RAG, Guardrails, Presidio, LiteLLM, or Qwen-Agent as runtime dependencies.
- Do not call a real SMS or model service in tests, CI, or local acceptance.
- Write a failing behavioral test before production behavior, run it red, implement the smallest behavior, run it green, and commit.
- Preserve current visual language and phone viewport constraints on the AI screen.

## File Map

### Backend

- `backend/app/core/config.py`: validated AI settings and environment restrictions.
- `backend/app/modules/auth/dependencies.py`: authenticate `ACTIVE` and `BANNED`, reject `DELETED`.
- `backend/app/modules/auth/service.py`: permit a banned account to restore/refresh a session while preserving deleted-account rejection.
- `backend/app/modules/users/service.py`: bootstrap real AI allowance and feature flag.
- `backend/app/db/models/ai.py`: all Stage 3 AI enums and tables.
- `backend/app/alembic/versions/20260729_0004_create_ai_core.py`: explicit PostgreSQL migration and downgrade.
- `backend/app/modules/ai/schemas.py`: API and internal generation contracts.
- `backend/app/modules/ai/access.py`: age, status, and feature checks.
- `backend/app/modules/ai/quota.py`: Beijing date, rate limit, reservation, completion, release, and idempotency.
- `backend/app/modules/ai/safety.py`: deterministic input classification and output replacement.
- `backend/app/modules/ai/context.py`: title generation, content candidates, cellar IDs, memories, and bounded context.
- `backend/app/modules/ai/memory.py`: memory validation, upsert, tombstones, clear, toggle, and source cleanup.
- `backend/app/modules/ai/conversations.py`: owned conversation/message reads, pagination, cleanup, and hard deletion.
- `backend/app/modules/ai/orchestrator.py`: normal and temporary request workflows.
- `backend/app/integrations/ai/base.py`: provider protocol and stable exceptions.
- `backend/app/integrations/ai/development.py`: deterministic local provider.
- `backend/app/integrations/ai/aliyun.py`: OpenAI-compatible HTTPX adapter.
- `backend/app/integrations/ai/__init__.py`: validated provider dependency.
- `backend/app/api/routes/ai.py`: public Stage 3 AI routes.
- `backend/app/api/router.py`: AI router registration.
- `backend/openapi.json`: generated API snapshot.

### Mobile

- `src/services/api/apiSchemas.ts`: shared error envelope.
- `src/services/api/authenticatedClient.ts`: timeout, bearer header, one refresh, and stable `ApiError`.
- `src/services/auth/authSchemas.ts`: Zod contracts for login, tokens, bootstrap, profile, privacy, and cellar.
- `src/services/auth/tokenStore.ts`: SecureStore-only refresh-token persistence.
- `src/services/auth/deviceIdentity.ts`: stable random installation ID and Expo device metadata.
- `src/services/auth/authRepository.ts`: auth and `/me` calls.
- `src/state/AuthState.tsx`: login, restore, refresh coalescing, bootstrap, and logout.
- `src/state/MixologyState.tsx`: apply bootstrap and route logged-in profile/privacy/cellar mutations through the backend.
- `src/services/ai/aiSchemas.ts`: Zod contracts corresponding to backend AI schemas.
- `src/services/ai/aiRepository.ts`: typed AI API operations with no device persistence.
- `src/state/AiState.tsx`: runtime-only normal/temporary chat state and command serialization.
- `src/components/ai/AiHistoryDrawer.tsx`: real grouped history and delete confirmation.
- `src/components/ai/AiMessageList.tsx`: messages, recipe references, memory notice, loading, and errors.
- `src/components/ai/AiInputDock.tsx`: controlled input, send/retry, and low-quota state.
- `src/app/ai.tsx`: screen composition, prompt consumption, and temporary-mode lifecycle.
- `src/app/settings-ai-memory.tsx`: view, toggle, delete, and clear memories.
- `.github/workflows/frontend-ci.yml`: frontend quality gate.

---

## Stage 3A: Real Mobile Authentication

### Task 1: Backend Account Status and Real Bootstrap Allowance

**Files:**
- Modify: `backend/app/core/config.py:21-60`
- Modify: `backend/app/modules/auth/dependencies.py:36-94`
- Modify: `backend/app/modules/auth/service.py:218-240,366-426`
- Modify: `backend/app/modules/users/schemas.py:101-121`
- Modify: `backend/app/modules/users/service.py:145-181`
- Modify: `backend/app/api/routes/me.py:32-121`
- Modify: `backend/tests/api/test_auth_login.py`
- Modify: `backend/tests/api/test_auth_sessions.py`
- Modify: `backend/tests/api/test_me.py`
- Modify: `backend/tests/core/test_config.py`

**Interfaces:**
- Produces: `Settings.ai_enabled: bool`, `Settings.ai_daily_limit: int`.
- Produces: `AiAllowance(daily_message_limit: int, messages_used_today: int, remaining: int, resets_at: datetime)`.
- Preserves: `CurrentAuth = Annotated[AuthContext, Depends(get_auth_context)]`.
- Consumes: `UserStatus`, existing JWT/session validation, and `Asia/Shanghai`.

- [ ] **Step 1: Write failing status and bootstrap tests**

Add tests named `test_banned_user_can_authenticate_but_deleted_user_cannot`,
`test_banned_user_can_refresh`, and `test_bootstrap_exposes_configured_ai_allowance`.
The bootstrap assertion is exact:

```python
assert body["ai"] == {
    "dailyMessageLimit": 50,
    "messagesUsedToday": 0,
    "remaining": 50,
    "resetsAt": "2026-07-29T16:00:00Z",
}
assert body["featureFlags"]["aiChat"] is True
```

Inject a clock into the allowance helper so the test does not depend on wall time.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/api/test_auth_login.py tests/api/test_auth_sessions.py tests/api/test_me.py tests/core/test_config.py -q
```

Expected: banned-session and new allowance assertions fail.

- [ ] **Step 3: Implement status semantics and bootstrap allowance**

Allow `ACTIVE` and `BANNED` in login, refresh, and `get_auth_context`; reject only
missing or `DELETED` users. Add:

```python
def next_beijing_reset(now: datetime) -> datetime:
    local_now = now.astimezone(ZoneInfo("Asia/Shanghai"))
    next_day = local_now.date() + timedelta(days=1)
    return datetime.combine(next_day, time.min, ZoneInfo("Asia/Shanghai")).astimezone(UTC)
```

Inject `Settings` into `/me/bootstrap` and `/me/local-sync`, then pass it to
`bootstrap_response()` and `sync_local_state()`. Set
`FeatureFlags.ai_chat=settings.ai_enabled`. Until the AI quota table exists,
bootstrap returns zero used; Task 7 replaces that value with `quota_snapshot()`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2 and require zero failures.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/app/modules/auth backend/app/modules/users backend/app/api/routes/me.py backend/tests
git commit -m "feat: expose AI-ready account bootstrap"
```

### Task 2: Mobile Auth Contracts, Device Identity, and Secure Token Store

**Files:**
- Modify: `package.json`
- Modify: `app.json:28-40`
- Modify: `jest.setup.ts`
- Create: `src/services/api/apiSchemas.ts`
- Create: `src/services/auth/authSchemas.ts`
- Create: `src/services/auth/deviceIdentity.ts`
- Create: `src/services/auth/tokenStore.ts`
- Create: `src/services/auth/__tests__/authSchemas.test.ts`
- Create: `src/services/auth/__tests__/deviceIdentity.test.ts`
- Create: `src/services/auth/__tests__/tokenStore.test.ts`

**Interfaces:**
- Produces: `ApiErrorPayload`, `LoginResponse`, `TokenResponse`, `BootstrapResponse`.
- Produces: `getDeviceIdentity(): Promise<DeviceInput>`.
- Produces: `tokenStore.getRefreshToken()`, `setRefreshToken(token)`, `clearRefreshToken()`.
- Consumes: `EXPO_PUBLIC_API_BASE_URL`, AsyncStorage, SecureStore, Expo Constants/Device.

- [ ] **Step 1: Install and lock SecureStore**

```bash
npx expo install expo-secure-store expo-crypto
```

Register `expo-secure-store` in `app.json` and add a Jest mock whose in-memory
map is reset between tests.

- [ ] **Step 2: Write failing contract and storage tests**

Prove:

```typescript
expect(loginResponseSchema.parse(validLogin).refreshToken).toBe('refresh-token');
expect(await getDeviceIdentity()).toEqual(expect.objectContaining({
  installationId: expect.any(String),
  platform: expect.stringMatching(/IOS|ANDROID|WEB/),
  appVersion: '1.0.0',
}));
expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
  expect.any(String),
  expect.stringContaining('refresh-token')
);
```

Call `getDeviceIdentity()` twice and require the same installation ID.

- [ ] **Step 3: Run tests and verify RED**

```bash
npm test -- --runInBand src/services/auth
```

Expected: missing module failures.

- [ ] **Step 4: Implement exact storage boundaries**

Use AsyncStorage key `beiyu.installation-id.v1` only for a UUID generated from
`expo-crypto` `randomUUID()`. Use SecureStore key `beiyu.refresh-token.v1`.
Export the concrete types through `z.infer`; do not duplicate handwritten
response interfaces.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
npm test -- --runInBand src/services/auth
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json jest.setup.ts src/services/api src/services/auth
git commit -m "feat: add secure mobile auth contracts"
```

### Task 3: Auth Repository and Refresh-Coalescing API Client

**Files:**
- Create: `src/services/api/authenticatedClient.ts`
- Create: `src/services/api/__tests__/authenticatedClient.test.ts`
- Create: `src/services/auth/authRepository.ts`
- Create: `src/services/auth/__tests__/authRepository.test.ts`

**Interfaces:**
- Produces: `ApiError extends Error { code; status; details }`.
- Produces: `createAuthenticatedClient({ apiBaseUrl, fetch, getAccessToken, refresh, onUnauthorized, timeoutMs })`.
- Produces: `AuthRepository` methods `requestSmsCode`, `login`, `refresh`, `logout`, `bootstrap`, `syncLocalState`, `confirmAge`, `patchProfile`, `patchPrivacy`, and cellar CRUD/batch.
- Consumes: Task 2 Zod schemas and token store.

- [ ] **Step 1: Write failing client concurrency tests**

Start two requests that both return 401, hold the refresh promise, then resolve
it. Require one refresh and two retried requests:

```typescript
expect(refresh).toHaveBeenCalledTimes(1);
expect(fetchMock).toHaveBeenCalledTimes(4);
expect(onUnauthorized).not.toHaveBeenCalled();
```

Also prove a second 401, invalid JSON, timeout, and schema mismatch become
stable `ApiError` instances without including request bodies or tokens.

- [ ] **Step 2: Run tests and verify RED**

```bash
npm test -- --runInBand src/services/api src/services/auth/__tests__/authRepository.test.ts
```

- [ ] **Step 3: Implement one-refresh request flow**

Keep access token in a closure supplied by `AuthState`. Keep one module-local
`refreshPromise`; all 401 callers await it, then retry exactly once. Parse the
error envelope before throwing:

```typescript
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown>
  ) {
    super(code);
  }
}
```

Every repository method supplies its response Zod schema. `logout` accepts 204
without parsing JSON.

- [ ] **Step 4: Run tests and verify GREEN**

Run Step 2 plus `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/services/api src/services/auth
git commit -m "feat: add authenticated mobile API client"
```

### Task 4: AuthProvider, App Restore, and Real Login Screen

**Files:**
- Create: `src/state/AuthState.tsx`
- Create: `src/state/__tests__/AuthState.test.tsx`
- Modify: `src/app/_layout.tsx:17-51`
- Modify: `src/app/login.tsx:1-54`
- Modify: `src/components/mixology/WelcomeScreen.tsx:11-35`
- Create: `src/components/mixology/__tests__/LoginScreen.test.tsx`
- Create: `src/components/mixology/__tests__/WelcomeScreen.test.tsx`
- Modify: `src/components/mixology/__tests__/SettingsScreen.test.tsx`

**Interfaces:**
- Produces: `AuthStatus = 'restoring' | 'signedOut' | 'signedIn'`.
- Produces: `useAuth()` with `requestSmsCode(phone)`, `login(phone, code)`,
  `authenticatedRequest`, `repository: AuthRepository`, `bootstrapData`,
  `bootstrap`, and `logout`.
- Consumes: Tasks 2-3 repositories and the existing local storage services.

- [ ] **Step 1: Write failing provider lifecycle tests**

Cover refresh success, no stored token, refresh failure, new-user local sync,
existing-user bootstrap, logout token cleanup, and unmount during restore.
Require no React state update warning after unmount.

- [ ] **Step 2: Write failing login UI tests**

Use controlled phone/code fields. Require a six-digit code, an accepted
agreement, visible request errors, resend countdown from `retryAfter`, disabled
duplicate submission, and navigation only after successful login/bootstrap.
The welcome test must require age consent to save the local flag and route to
`/login`; remove the “游客可跳过” claim.

- [ ] **Step 3: Run tests and verify RED**

```bash
npm test -- --runInBand src/state/__tests__/AuthState.test.tsx src/components/mixology/__tests__/LoginScreen.test.tsx src/components/mixology/__tests__/WelcomeScreen.test.tsx
```

- [ ] **Step 4: Implement provider hierarchy and login**

Render providers in this order:

```tsx
<ContentProvider>
  <AuthProvider>
    <MixologyProvider>
      <RootContent />
    </MixologyProvider>
  </AuthProvider>
</ContentProvider>
```

Task 5 inserts `AuthenticatedMixologyBridge` around `RootContent`; Task 16 then
inserts `AiProvider` inside that bridge. `AuthProvider` reads the new-user
local-sync payload through a small callback backed by the existing storage
services, so it does not depend on `MixologyProvider`. During `restoring`, show
the existing dark loading screen. The age welcome remains first-run consent;
after consent route to `/login`. Signed-out users may browse bundled public
content, but `/ai` redirects to login.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
npm test -- --runInBand src/state/__tests__/AuthState.test.tsx src/components/mixology/__tests__/LoginScreen.test.tsx src/components/mixology/__tests__/WelcomeScreen.test.tsx src/components/mixology/__tests__/SettingsScreen.test.tsx
npm run lint
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/app/_layout.tsx src/app/login.tsx src/state src/components/mixology/WelcomeScreen.tsx src/components/mixology/__tests__
git commit -m "feat: connect Expo to real authentication"
```

### Task 5: Bootstrap and Logged-In Profile, Privacy, and Cellar Sync

**Files:**
- Modify: `src/state/MixologyState.tsx:29-60,76-149,295-395`
- Modify: `src/state/__tests__/MixologyState.test.tsx`
- Create: `src/state/AuthenticatedMixologyBridge.tsx`
- Create: `src/state/__tests__/AuthenticatedMixologyBridge.test.tsx`
- Modify: `src/services/storageService.ts:86-138`
- Modify: `src/app/edit-profile.tsx`
- Modify: `src/app/settings-general.tsx`
- Modify: `src/app/cellar-ingredients.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Produces: `applyBootstrap(response: BootstrapResponse): Promise<void>`.
- Produces: remote-aware `updateUserProfile`, `verifyAge`,
  `setCellarIngredientIds`, `toggleCellarIngredient`, and
  `updatePrivacySettings`.
- Consumes: `useAuth().repository` and Task 2 `BootstrapResponse`.

- [ ] **Step 1: Write failing bootstrap mapping tests**

Prove one atomic `applyBootstrap()` updates profile, privacy, age, cellar, and
account security in memory and local mirrors. Preserve the existing rapid
interaction update test.

- [ ] **Step 2: Write failing remote-mutation tests**

Require the API call to complete before committing UI state. A rejected patch
must preserve the user's edit buffer and leave the previous saved snapshot
unchanged. For cellar toggles, assert the server response, not optimistic
local state, becomes final state.

- [ ] **Step 3: Run tests and verify RED**

```bash
npm test -- --runInBand src/state
```

- [ ] **Step 4: Implement the authenticated bridge**

`AuthenticatedMixologyBridge` observes `AuthState.bootstrapData` and calls
`applyBootstrap` once per authenticated user ID. Use refs for mutable local
snapshots so rapid writes cannot lose updates. Keep interactions, community,
and blind-box data local in this stage. Update `_layout.tsx` to render:

```tsx
<MixologyProvider>
  <AuthenticatedMixologyBridge>
    <RootContent />
  </AuthenticatedMixologyBridge>
</MixologyProvider>
```

- [ ] **Step 5: Run tests and verify GREEN**

```bash
npm test -- --runInBand src/state src/components/mixology/__tests__/EditProfileScreen.test.tsx
npm run lint
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/state src/services/storageService.ts src/app/edit-profile.tsx src/app/settings-general.tsx src/app/cellar-ingredients.tsx
git commit -m "feat: synchronize authenticated user state"
```

## Stage 3B: AI Backend

### Task 6: AI Models and Alembic Migration

**Files:**
- Create: `backend/app/db/models/ai.py`
- Modify: `backend/app/db/models/__init__.py`
- Create: `backend/app/alembic/versions/20260729_0004_create_ai_core.py`
- Create: `backend/tests/db/test_ai_models.py`
- Modify: `backend/tests/migrations/test_migrations.py`

**Interfaces:**
- Produces: `AiMessageRole`, `AiChatMode`, `AiRequestStatus`,
  `AiSafetyLabel`, `AiMemoryCategory`.
- Produces: `AiConversation`, `AiMessage`, `AiRequest`, `AiDailyQuota`,
  `AiUsageLog`, `AiMemory`, `AiMemorySource`, `AiMemoryTombstone`.
- Consumes: `User`, `Recipe`, and `utc_now()`.

- [ ] **Step 1: Write failing model metadata tests**

Assert all eight table names, five enum names, unique keys, check constraints,
indexes, and foreign-key delete rules. Specifically require:

```python
assert fk("ai_messages", "conversation_id").ondelete == "CASCADE"
assert fk("ai_requests", "conversation_id").ondelete == "SET NULL"
assert fk("ai_requests", "response_message_id").ondelete == "SET NULL"
assert fk("ai_usage_logs", "conversation_id").ondelete == "SET NULL"
assert fk("ai_memory_sources", "conversation_id").ondelete == "CASCADE"
```

- [ ] **Step 2: Run model tests and verify RED**

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/db/test_ai_models.py -q
```

- [ ] **Step 3: Implement enums and tables**

Match every field, length, nullable rule, index, and constraint in design
sections 9.1-9.9. Use JSON with a JSONB PostgreSQL variant for
`AiMessage.recipe_ids`. Use `Numeric(12, 6)` for cost. Do not add message text
to requests or usage logs.

- [ ] **Step 4: Write and run the migration test RED**

Change expected head to `20260729_0004`, assert all tables/enums, upgrade from
`20260729_0003`, and require downgrade removes the five AI enum types.

- [ ] **Step 5: Add explicit migration and verify GREEN**

Create tables in dependency order and downgrade in reverse order. Run:

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run alembic upgrade head
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/db/test_ai_models.py tests/migrations/test_migrations.py -q
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/db backend/app/alembic/versions backend/tests/db backend/tests/migrations
git commit -m "feat: add AI core database schema"
```

### Task 7: AI Configuration, Access Policy, and Quota Snapshot

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/.env.example`
- Modify: `backend/compose.yml:36-48`
- Create: `backend/app/modules/ai/__init__.py`
- Create: `backend/app/modules/ai/access.py`
- Create: `backend/app/modules/ai/quota.py`
- Create: `backend/tests/modules/ai/test_access.py`
- Create: `backend/tests/modules/ai/test_quota.py`
- Modify: `backend/tests/core/test_config.py`
- Modify: `backend/app/modules/users/service.py:145-181`

**Interfaces:**
- Produces: all `BEIYU_AI_*` settings from design section 21.
- Produces: `require_ai_access(user: User, settings: Settings) -> None`.
- Produces: `quota_date(now)`, `next_reset(now)`, and
  `quota_snapshot(session, user_id, settings, now) -> QuotaSnapshot`.

- [ ] **Step 1: Write failing configuration and access tests**

Require invalid non-dev provider combinations to fail `Settings` validation.
Access mapping is exact:

```python
assert_error(banned_user, "AI_ACCESS_SUSPENDED", 403)
assert_error(unconfirmed_user, "AGE_CONFIRMATION_REQUIRED", 403)
assert_error(active_user, "AI_FEATURE_DISABLED", 403, ai_enabled=False)
```

- [ ] **Step 2: Write failing Beijing boundary tests**

With injected UTC times around `2026-07-29T16:00:00Z`, prove quota dates change
from July 29 to July 30 and reset timestamps remain the next Beijing midnight.

- [ ] **Step 3: Run tests and verify RED**

```bash
cd backend
uv run pytest tests/core/test_config.py tests/modules/ai/test_access.py tests/modules/ai/test_quota.py -q
```

- [ ] **Step 4: Implement settings, access, and read-only snapshot**

Use `SecretStr | None` for the provider API key. Use a non-empty `SecretStr`
development default for the memory HMAC key and require an independently
configured value of at least 32 bytes outside `dev`. Permit all development
defaults only in `dev`. `quota_snapshot` returns zero counts when no row exists
and must not create a row on a read.

- [ ] **Step 5: Wire bootstrap and verify GREEN**

Replace Task 1's temporary allowance with `quota_snapshot()`. Run focused tests
and require exact configured limit, used, remaining, and reset values.

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/config.py backend/.env.example backend/compose.yml backend/app/modules/ai backend/app/modules/users backend/tests
git commit -m "feat: add AI access and quota settings"
```

### Task 8: Request Reservation, Rate Limit, and Idempotency

**Files:**
- Modify: `backend/app/modules/ai/quota.py`
- Modify: `backend/tests/modules/ai/test_quota.py`

**Interfaces:**
- Produces: `reserve_request(session, user, client_message_id, mode, conversation_id, settings, now) -> ReservationResult`.
- Produces: `complete_reservation(session, request, usage, now) -> QuotaSnapshot`.
- Produces: `fail_reservation(session, request, failure_code, usage, now) -> None`.
- Produces: `ReservationDisposition = NEW | REPLAY | IN_PROGRESS | TEMPORARY_LOST`.

- [ ] **Step 1: Write failing reservation tests**

Cover successful reservation/completion, 50th accepted, 51st rejected, provider
failure release, two-minute expiry recovery, 10 requests in a rolling minute,
one active reservation, normal success replay, temporary success loss, and a
failed request retry incrementing `attempt_count`.

- [ ] **Step 2: Run tests and verify RED**

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/modules/ai/test_quota.py -q
```

- [ ] **Step 3: Implement transaction boundaries**

Lock the current `AiDailyQuota` row with `FOR UPDATE`. Reclaim expired rows
before checking active reservations. Insert `AiRequest` and increment
`reserved_count` in one commit. Complete or fail in a second short transaction.
Write one `AiUsageLog` per attempt with `unique(request_id, attempt_no)`.

- [ ] **Step 4: Run quota tests and verify GREEN**

Run Step 2 repeatedly twice to expose order or cleanup dependence.

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/ai/quota.py backend/tests/modules/ai/test_quota.py
git commit -m "feat: enforce AI quota and idempotency"
```

### Task 9: AI Schemas, Safety Rules, and Context Builder

**Files:**
- Create: `backend/app/modules/ai/schemas.py`
- Create: `backend/app/modules/ai/safety.py`
- Create: `backend/app/modules/ai/context.py`
- Create: `backend/tests/modules/ai/test_schemas.py`
- Create: `backend/tests/modules/ai/test_safety.py`
- Create: `backend/tests/modules/ai/test_context.py`

**Interfaces:**
- Produces: all request/response models from design section 11.
- Produces: `SafetyDecision(label, fixed_reply, allow_recipes, allow_memory)`.
- Produces: `classify_input(content, user)`, `review_output(result, decision)`.
- Produces: `build_normal_generation_request(session: Session, user: User, conversation: AiConversation, content: str, safety: SafetyDecision, settings: Settings) -> AiGenerationRequest`.
- Produces: `build_temporary_generation_request(session: Session, user: User, content: str, temporary_context: list[TemporaryContextMessage], safety: SafetyDecision, settings: Settings) -> AiGenerationRequest`.
- Produces: `derive_conversation_title(content: str) -> str`.

- [ ] **Step 1: Write failing schema tests**

Reject empty or 2,001-character messages, more than 20 temporary context
messages, more than 12,000 total context characters, and invalid UUIDs. Require
camelCase serialization matching all design examples.

- [ ] **Step 2: Write failing safety and context tests**

Use fixed Chinese fixtures for ordinary distress, explicit drink request,
overuse, minor drinking, self-harm crisis, private identifiers, provider
diagnosis, provider overuse encouragement, and unknown/unpublished recipe IDs.
Assert no drink recommendation for risk paths and no sensitive memory.

- [ ] **Step 3: Run tests and verify RED**

```bash
cd backend
uv run pytest tests/modules/ai/test_schemas.py tests/modules/ai/test_safety.py tests/modules/ai/test_context.py -q
```

- [ ] **Step 4: Implement deterministic rules**

Store keyword/pattern groups as module constants. Return fixed Chinese safety
copy from constants, never from a model. Build normal context in this exact
order: persona, active memories, recent messages, cellar IDs, published recipe
candidates, current message. Temporary context omits memories and normal
history.

- [ ] **Step 5: Verify GREEN**

Run Step 3, then `uv run ruff check app/modules/ai tests/modules/ai` and
`uv run ty check`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/modules/ai backend/tests/modules/ai
git commit -m "feat: add AI contracts and safety rules"
```

### Task 10: Development and Aliyun Provider Adapters

**Files:**
- Create: `backend/app/integrations/ai/base.py`
- Create: `backend/app/integrations/ai/development.py`
- Create: `backend/app/integrations/ai/aliyun.py`
- Create: `backend/app/integrations/ai/__init__.py`
- Create: `backend/tests/integrations/test_ai_providers.py`

**Interfaces:**
- Produces: `AiProvider.generate(request: AiGenerationRequest) -> AiGenerationResult`.
- Produces: `DevelopmentAiProvider`, `AliyunAiProvider`, `get_ai_provider`.
- Produces: `AiProviderUnavailable`, `AiProviderTimeout`, `AiProviderInvalidResponse`.
- Consumes: Task 7 settings and Task 9 generation contracts.

- [ ] **Step 1: Write failing deterministic provider tests**

Require identical input to produce identical output, emotional input to be
acknowledged before advice, explicit drink intent to return only candidate
recipe IDs, and stable memory candidates. Add explicit trigger values used
only in tests for timeout, unavailable, and unsafe-output simulation.

- [ ] **Step 2: Write failing Aliyun transport tests**

Use `httpx.MockTransport`. Assert the exact HTTPS URL, bearer header, model,
messages, JSON response parsing, 20-second timeout, non-2xx mapping, invalid
JSON mapping, and no network access. Capture logs and require they contain
neither API key nor input text.

- [ ] **Step 3: Run tests and verify RED**

```bash
cd backend
uv run pytest tests/integrations/test_ai_providers.py -q
```

- [ ] **Step 4: Implement adapters**

The protocol is:

```python
class AiProvider(Protocol):
    def generate(self, request: AiGenerationRequest) -> AiGenerationResult:
        raise NotImplementedError
```

Concrete providers must implement this method. Aliyun sends OpenAI-compatible
`/chat/completions`, validates returned structured JSON, and maps all transport
errors to the stable exceptions.

- [ ] **Step 5: Run tests and verify GREEN**

Run Step 3, Ruff, and ty. Confirm the test transport received every Aliyun call.

- [ ] **Step 6: Commit**

```bash
git add backend/app/integrations/ai backend/tests/integrations/test_ai_providers.py
git commit -m "feat: add configurable AI providers"
```

### Task 11: AI Memory Service

**Files:**
- Create: `backend/app/modules/ai/memory.py`
- Create: `backend/tests/modules/ai/test_memory.py`

**Interfaces:**
- Produces: `list_memories`, `apply_memory_candidates`, `delete_memory`,
  `clear_memories`, `set_memory_enabled`, and
  `remove_conversation_memory_sources`.
- Consumes: `AiMemoryCandidate`, memory tables, `Settings.ai_memory_limit`,
  and `Settings.ai_memory_hmac_key`.

- [ ] **Step 1: Write failing memory lifecycle tests**

Cover allowed categories, explicit-user-expression requirement, same-key
update, unchanged summary, sensitive rejection, 20-item cap, disabled memory,
temporary exclusion, tombstone suppression, individual delete, clear all,
source sharing, and orphan cleanup after conversation deletion.

- [ ] **Step 2: Run tests and verify RED**

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/modules/ai/test_memory.py -q
```

- [ ] **Step 3: Implement memory normalization and deletion**

Normalize `memory_key` with Unicode normalization, case folding, and collapsed
whitespace. Tombstone with:

```python
def memory_key_hash(key: str, secret: str) -> str:
    payload = f"beiyu-ai-memory-v1:{key}".encode()
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
```

User deletion creates the tombstone before deleting sources and summary.
Conversation deletion removes orphan memories without creating tombstones.

- [ ] **Step 4: Run tests and verify GREEN**

Run Step 2 plus Ruff and ty.

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/ai/memory.py backend/tests/modules/ai/test_memory.py
git commit -m "feat: add transparent AI memory controls"
```

### Task 12: Conversation and Message Persistence

**Files:**
- Create: `backend/app/modules/ai/conversations.py`
- Create: `backend/tests/modules/ai/test_conversations.py`
- Create: `backend/tests/api/test_ai_conversations.py`

**Interfaces:**
- Produces: `create_conversation`, `list_conversations`, `get_owned_conversation`,
  `list_messages`, `save_exchange`, `delete_conversation`,
  and `cleanup_stale_empty_conversations`.
- Consumes: Task 9 response models and Task 11 source cleanup.

- [ ] **Step 1: Write failing ownership and pagination tests**

Test two users. Require the second user to receive
`AI_CONVERSATION_NOT_FOUND` for another user's UUID. Verify deterministic
ordering, page/pageSize bounds, oldest-to-newest message results, hidden empty
conversations, 24-hour empty cleanup, and protection of an empty conversation
with a live reservation.

- [ ] **Step 2: Write failing deletion tests**

Delete one conversation and assert messages disappear, orphan memories
disappear, shared memories remain, usage/request rows remain, and their
conversation/message foreign keys become null.

- [ ] **Step 3: Run tests and verify RED**

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/modules/ai/test_conversations.py tests/api/test_ai_conversations.py -q
```

- [ ] **Step 4: Implement owned queries and hard deletion**

Every select includes both resource ID and `user_id`. Run stale cleanup only
for the current user during list/create. Generate the title from the first
successful user message. Hard deletion and memory-source cleanup share one
transaction.

- [ ] **Step 5: Run tests and verify GREEN**

Run Step 3, Ruff, and ty.

- [ ] **Step 6: Commit**

```bash
git add backend/app/modules/ai/conversations.py backend/tests/modules/ai/test_conversations.py backend/tests/api/test_ai_conversations.py
git commit -m "feat: persist AI conversations and messages"
```

### Task 13: Normal and Temporary Chat Orchestration

**Files:**
- Create: `backend/app/modules/ai/orchestrator.py`
- Create: `backend/tests/modules/ai/test_orchestrator.py`
- Create: `backend/tests/api/test_ai_messages.py`
- Create: `backend/tests/api/test_ai_temporary.py`

**Interfaces:**
- Produces: `send_normal_message(session: Session, user: User, conversation_id: UUID, payload: SendMessageRequest, provider: AiProvider, settings: Settings, now: datetime) -> SendMessageResponse`.
- Produces: `send_temporary_message(session: Session, user: User, payload: TemporaryMessageRequest, provider: AiProvider, settings: Settings, now: datetime) -> TemporaryMessageResponse`.
- Consumes: access, quota, safety, context, memory, conversation, and provider
  interfaces from Tasks 7-12.

- [ ] **Step 1: Write failing normal orchestration tests**

Assert exact call order with fakes: access, reserve, safety, context, provider,
output review, atomic exchange/memory/usage completion. Prove provider calls
occur after the reservation transaction closes. Cover fixed safety replies,
normal replay, timeout release, unavailable release, output replacement,
recipe allowlist, and memory-change responses.

- [ ] **Step 2: Write failing temporary tests**

Require request-supplied context to reach the provider, zero message/memory
rows, one usage row, one used quota, and no text in captured logs or database
metadata. Retry after success must return
`TEMPORARY_RESPONSE_NOT_RETAINED` without another provider call.

- [ ] **Step 3: Run tests and verify RED**

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/modules/ai/test_orchestrator.py tests/api/test_ai_messages.py tests/api/test_ai_temporary.py -q
```

- [ ] **Step 4: Implement both workflows**

Map provider exceptions to `AI_PROVIDER_UNAVAILABLE` 503 and
`AI_PROVIDER_TIMEOUT` 504. Fixed safety replies count as successful quota use.
Normal failure preserves the empty conversation for retry. Temporary success
returns a generated UUID in memory but persists no response ID.

- [ ] **Step 5: Run tests and verify GREEN**

Run Step 3 twice, then Ruff and ty.

- [ ] **Step 6: Commit**

```bash
git add backend/app/modules/ai/orchestrator.py backend/tests/modules/ai/test_orchestrator.py backend/tests/api/test_ai_messages.py backend/tests/api/test_ai_temporary.py
git commit -m "feat: orchestrate normal and temporary AI chat"
```

### Task 14: AI Routes, Memory API, OpenAPI, and Privacy Logging

**Files:**
- Create: `backend/app/api/routes/ai.py`
- Modify: `backend/app/api/router.py:4-28`
- Create: `backend/tests/api/test_ai_memories.py`
- Create: `backend/tests/api/test_ai_access_and_quota.py`
- Modify: `backend/tests/api/test_openapi.py`
- Modify: `backend/tests/api/test_request_context.py`
- Modify: `backend/scripts/generate_openapi.py`
- Modify: `backend/openapi.json`

**Interfaces:**
- Produces: all endpoints in design section 11.
- Produces: the exact stable error codes in design section 20.
- Consumes: Tasks 7-13 services and existing `ErrorEnvelope`.

- [ ] **Step 1: Write failing route and access tests**

Cover all 11 route groups: conversations list/create/detail/messages/delete,
normal send, temporary send, memory list/delete/clear/settings, and usage today.
Require Bearer security, age/status/feature checks, camelCase, and correct
204 bodies.

- [ ] **Step 2: Write failing OpenAPI and log-redaction tests**

Extend the exact path set and protected-operation set. Add AI config keys,
message fields, `prompt`, `memory`, and provider credentials to the forbidden
OpenAPI/log fragments. Capture request logs for normal and temporary sends and
assert neither body appears.

- [ ] **Step 3: Run tests and verify RED**

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/api/test_ai_memories.py tests/api/test_ai_access_and_quota.py tests/api/test_openapi.py tests/api/test_request_context.py -q
```

- [ ] **Step 4: Implement routes and regenerate OpenAPI**

Use synchronous route functions, typed dependencies, explicit success models,
and `ErrorEnvelope` response declarations. Then run:

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5432/beiyu uv run python scripts/generate_openapi.py --output openapi.json
```

- [ ] **Step 5: Run complete backend verification**

```bash
cd backend
uv sync --frozen
uv run ruff check .
uv run ty check
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest
docker compose config
docker compose build api
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api backend/app/modules/ai backend/tests/api backend/openapi.json
git commit -m "feat: expose AI chat and memory APIs"
```

## Stage 3C: Real Mobile AI

### Task 15: Mobile AI Zod Contracts and Repository

**Files:**
- Create: `src/services/ai/aiSchemas.ts`
- Create: `src/services/ai/aiRepository.ts`
- Create: `src/services/ai/__tests__/aiSchemas.test.ts`
- Create: `src/services/ai/__tests__/aiRepository.test.ts`
- Delete: `src/services/aiChatService.ts`
- Delete: `src/services/__tests__/aiChatService.test.ts`

**Interfaces:**
- Produces: `AiConversation`, `AiMessage`, `AiUsage`, `AiMemory`,
  `MemoryChange`, and all list/send responses inferred from Zod.
- Produces: `AiRepository` methods matching every Task 14 route.
- Consumes: Task 3 authenticated client.

- [ ] **Step 1: Write failing schema tests**

Copy representative normal, temporary, memory, quota, pagination, and error
payloads from the approved design. Require invalid role, malformed UUID,
missing usage, and non-array recipe IDs to fail parsing.

- [ ] **Step 2: Write failing repository tests**

Assert exact methods, paths, HTTP verbs, bodies, and response parsing. Confirm
temporary context is included only in the current request and no storage API is
called.

- [ ] **Step 3: Run tests and verify RED**

```bash
npm test -- --runInBand src/services/ai
```

- [ ] **Step 4: Implement contracts and repository**

Generate `clientMessageId` with `Crypto.randomUUID()` from `expo-crypto`.
Accept a caller-provided ID for retry. Remove all production imports of
`createMockAiReply`.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
npm test -- --runInBand src/services/ai
npm run typecheck
rg -n "createMockAiReply" src
```

Expected: tests pass and `rg` returns no matches.

- [ ] **Step 6: Commit**

```bash
git add src/services/ai src/services/aiChatService.ts src/services/__tests__/aiChatService.test.ts
git commit -m "feat: add typed mobile AI repository"
```

### Task 16: Runtime-Only AiProvider State

**Files:**
- Create: `src/state/AiState.tsx`
- Create: `src/state/__tests__/AiState.test.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Produces: `AiViewStatus` states from design section 19.2.
- Produces: `useAi()` commands `loadConversations`, `selectConversation`,
  `startNewChat`, `startTemporaryChat`, `send`, `retry`, `deleteConversation`,
  `loadMemories`, `deleteMemory`, `clearMemories`, and `setMemoryEnabled`.
- Consumes: Task 15 repository and `useAuth()`.

- [ ] **Step 1: Write failing normal-chat state tests**

Cover hidden empty draft, first-send conversation creation, successful
exchange, history selection, stale response protection, duplicate-send
blocking, retry with the same client ID, input retention on error, deletion,
quota low/exhausted, and logout cleanup.

- [ ] **Step 2: Write failing temporary-state tests**

Prove messages exist only in provider state, outgoing context is bounded, mode
switch/unmount/logout clears it, no normal history is read, and no AsyncStorage
or SecureStore calls contain temporary text.

- [ ] **Step 3: Run tests and verify RED**

```bash
npm test -- --runInBand src/state/__tests__/AiState.test.tsx
```

- [ ] **Step 4: Implement serialized state transitions**

Use an operation counter and mounted ref. Only the latest load may replace the
selected conversation. One `sendPromiseRef` prevents duplicate sends. A failed
send retains `draft`, `pendingClientMessageId`, and the created conversation ID
for exact retry.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
npm test -- --runInBand src/state/__tests__/AiState.test.tsx
npm run lint
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/state/AiState.tsx src/state/__tests__/AiState.test.tsx src/app/_layout.tsx
git commit -m "feat: manage runtime AI chat state"
```

### Task 17: Real AI Screen, History, Temporary Chat, and Prompt Consumption

**Files:**
- Create: `src/components/ai/AiHistoryDrawer.tsx`
- Create: `src/components/ai/AiMessageList.tsx`
- Create: `src/components/ai/AiInputDock.tsx`
- Modify: `src/app/ai.tsx`
- Modify: `src/components/mixology/__tests__/AiScreen.test.tsx`
- Create: `src/components/ai/__tests__/AiHistoryDrawer.test.tsx`
- Create: `src/components/ai/__tests__/AiInputDock.test.tsx`

**Interfaces:**
- Consumes: Task 16 `useAi()` and `ContentProvider.snapshot.recipes`.
- Preserves: existing test IDs `ai-menu-button`, `ai-temp-chat-button`,
  `ai-input-dock`, `ai-send-button`, and `ai-history-drawer`.
- Produces: one-time route prompt consumption.

- [ ] **Step 1: Replace mock-based tests with failing repository-state tests**

Require real grouped history labels, new-chat local reset, delete confirmation,
loading states, retryable failure with preserved input, disabled duplicate
send, temporary badge/clear, low quota at 10, exhausted quota at 0, and recipe
cards resolved only from valid content snapshot IDs.

- [ ] **Step 2: Add the prompt regression test**

Mount with `prompt=给我一杯金汤力`, delay auth/AI readiness, rerender twice, then
resolve readiness. Require exactly one `send` call with one stable
`clientMessageId`. Mount temporary mode and require zero automatic sends.

- [ ] **Step 3: Run tests and verify RED**

```bash
npm test -- --runInBand src/components/mixology/__tests__/AiScreen.test.tsx src/components/ai
```

- [ ] **Step 4: Split and wire the existing screen**

Keep the approved dark Qwen-inspired composition and calculate drawer width as
`Math.min(width * 0.82, 340)`. Remove static history arrays and title
derivation. Use backend titles and messages. Keep the temporary-chat icon and
input bar within safe-area and keyboard bounds.

- [ ] **Step 5: Verify behavior and viewport**

```bash
npm test -- --runInBand src/components/mixology/__tests__/AiScreen.test.tsx src/components/ai
npm run lint
npm run typecheck
```

Also start Expo and inspect iPhone SE, iPhone 15, and a 430px-wide viewport.
The drawer, input dock, header actions, long titles, and recipe cards must not
cross the viewport.

- [ ] **Step 6: Commit**

```bash
git add src/app/ai.tsx src/components/ai src/components/mixology/__tests__/AiScreen.test.tsx
git commit -m "feat: connect AI chat screen to real data"
```

### Task 18: AI Memory Settings Screen

**Files:**
- Create: `src/app/settings-ai-memory.tsx`
- Create: `src/components/mixology/__tests__/AiMemorySettingsScreen.test.tsx`
- Modify: `src/app/settings.tsx:48-88`
- Modify: `src/components/mixology/__tests__/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: Task 16 memory state and commands.
- Produces: route `/settings-ai-memory`.

- [ ] **Step 1: Write failing screen tests**

Require category labels, summaries, empty state, memory-enabled switch,
individual delete confirmation, clear-all confirmation, disabled-state
visibility, API-error retention, and a settings-row navigation test.

- [ ] **Step 2: Run tests and verify RED**

```bash
npm test -- --runInBand src/components/mixology/__tests__/AiMemorySettingsScreen.test.tsx src/components/mixology/__tests__/SettingsScreen.test.tsx
```

- [ ] **Step 3: Implement the settings screen**

Use existing `ScreenShell`, compact settings rows, `Toggle`, and theme colors.
Show only user-visible summaries; do not expose memory keys, source message IDs,
confidence, tombstones, or internal safety labels.

- [ ] **Step 4: Run tests and verify GREEN**

Run Step 2 plus lint and typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings-ai-memory.tsx src/app/settings.tsx src/components/mixology/__tests__
git commit -m "feat: add AI memory controls"
```

### Task 19: Frontend CI, Full Regression, and Local Acceptance

**Files:**
- Create: `.github/workflows/frontend-ci.yml`
- Modify: `backend/README.md`
- Create: `docs/backend-stage3-local-demo.md`
- Modify: `docs/superpowers/plans/2026-07-29-beiyu-stage3-ai-core.md` only to check completed boxes during execution.

**Interfaces:**
- Produces: repeatable local Stage 3 demo and independent frontend CI.
- Consumes: all previous tasks.

- [ ] **Step 1: Add failing workflow-shape test**

Create `src/services/__tests__/frontendCi.test.ts` that parses the workflow text
and asserts it runs `npm ci`, lint, typecheck, and Jest in band on both push and
pull request when frontend paths change.

- [ ] **Step 2: Run the test and verify RED**

```bash
npm test -- --runInBand src/services/__tests__/frontendCi.test.ts
```

- [ ] **Step 3: Add frontend workflow and local runbook**

The job uses Node 22 and runs:

```yaml
- run: npm ci
- run: npm run lint
- run: npm run typecheck
- run: npm test -- --runInBand
```

Document Docker startup, migration, content seed, development SMS code, Expo
API URL, normal chat, temporary data inspection, memory deletion, quota
boundary, provider timeout, and safety fixtures. Use example credentials only.

- [ ] **Step 4: Run full backend verification**

```bash
cd backend
uv sync --frozen
uv run ruff check .
uv run ty check
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest
docker compose config
docker compose build api
```

- [ ] **Step 5: Run full frontend verification**

```bash
cd ..
npm ci
npm run lint
npm run typecheck
npm test -- --runInBand
npx expo export --platform ios
```

- [ ] **Step 6: Perform privacy and persistence smoke checks**

Use a unique marker in normal and temporary messages. Query all AI tables and
container logs. Require normal text only in `ai_messages`; require temporary
text nowhere. Delete the normal conversation and require its text and orphan
memory summary to disappear while usage rows remain.

- [ ] **Step 7: Perform the 22-step local acceptance**

Follow design section 27 in order. Record pass/fail evidence in the pull
request description. Do not mark the task complete if Docker, Expo export, or
either complete test suite fails.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/frontend-ci.yml backend/README.md docs/backend-stage3-local-demo.md docs/superpowers/plans/2026-07-29-beiyu-stage3-ai-core.md
git commit -m "ci: verify Stage 3 AI workflows"
```

## Design Coverage Map

- Design sections 2-8, goals, scope, architecture, and real authentication:
  Tasks 1-5.
- Design section 9, database tables and deletion rules: Tasks 6, 11, and 12.
- Design sections 10-14, limits, APIs, request flows, quota, and idempotency:
  Tasks 7-9 and 12-14.
- Design sections 15-16, providers, persona, context, and titles: Tasks 9-10
  and 13.
- Design sections 17-18, safety and transparent memory: Tasks 9, 11, 13-14,
  and 18.
- Design section 19, mobile state and interactions: Tasks 15-18.
- Design sections 20-23, errors, configuration, privacy, and observability:
  Tasks 3, 7-10, 13-14, and 16.
- Design sections 24-28, testing, CI, rollout, local acceptance, and acceptance
  criteria: every task's red/green cycle plus Task 19.

## Final Review Gate

- [ ] Confirm all 19 task commits are present and the worktree is clean.
- [ ] Compare every design requirement in sections 2-28 with at least one test.
- [ ] Confirm no production import references `createMockAiReply`.
- [ ] Confirm temporary text does not appear in device storage, database
  metadata, request logs, provider logs, or test snapshots.
- [ ] Confirm OpenAPI and Zod field names match exactly.
- [ ] Confirm no committed secret or real phone number exists.
- [ ] Run backend and frontend full verification once more from a clean process.
- [ ] Push `codex/backend-stage3-ai` and open a pull request against the Stage 2
  branch until Stage 2 merges; retarget to the default branch after merge.
