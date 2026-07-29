# Beiyu Stage 2 Content Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally runnable, versioned content platform for home content, ingredients, recipes, bars, and drink knowledge, then connect Expo through a bundled-first repository that remains usable without the backend.

**Architecture:** FastAPI owns typed public and admin contracts over PostgreSQL content tables. Content mutations create immutable snapshots and use optimistic revisions. Expo renders bundled or cached data immediately, validates remote payloads with Zod, and refreshes in the background.

**Tech Stack:** Python 3.12, FastAPI, SQLModel, PostgreSQL, Alembic, Pytest, Expo 57, React Native 0.86, TypeScript, AsyncStorage, Zod, Jest.

## Global Constraints

- Preserve the existing Stage 1 authentication, error envelope, logging, Docker, and CI patterns.
- Keep existing public IDs such as `classic-margarita`; never expose database UUIDs.
- Public endpoints return only `PUBLISHED` content and camelCase fields.
- Admin endpoints require `EDITOR` or `SUPER_ADMIN`.
- Do not add OSS, uploads, a web admin UI, AI, community persistence, notifications, or cloud deployment.
- Do not hardcode a developer IP; missing `EXPO_PUBLIC_API_BASE_URL` means local-only mode.
- Render bundled content before any network request.
- Write a failing behavioral test before each production behavior.
- Commit after each independently verified task.

---

### Task 1: Content Database Models and Migration

**Files:**
- Create: `backend/app/db/models/content.py`
- Create: `backend/app/alembic/versions/20260729_0003_create_content_platform.py`
- Modify: `backend/app/db/models/accounts.py`
- Modify: `backend/app/db/models/__init__.py`
- Modify: `backend/tests/db/test_stage_one_models.py`
- Create: `backend/tests/db/test_content_models.py`
- Modify: `backend/tests/migrations/test_migrations.py`

**Interfaces:**
- Produces: `UserRole`, `ContentStatus`, `ContentType`, `ContentAction`, `Ingredient`, `Recipe`, `RecipeIngredient`, `Bar`, `DrinkKnowledgeEntry`, `HomeBanner`, `HomeShortcut`, and `ContentVersion`.
- Produces: `User.role: UserRole`.
- Consumes: existing `utc_now()` and SQLModel metadata.

- [ ] **Step 1: Write failing model metadata tests**

Assert that all content tables exist in `SQLModel.metadata`, public IDs are unique, `users.role` exists, and recipes expose `revision`, `status`, `steps`, and `tags`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/pytest tests/db/test_content_models.py -q
```

Expected: import or table assertion failure because content models do not exist.

- [ ] **Step 3: Implement enums and SQLModel tables**

Use typed PostgreSQL-compatible columns:

```python
class ContentStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class UserRole(StrEnum):
    USER = "USER"
    EDITOR = "EDITOR"
    SUPER_ADMIN = "SUPER_ADMIN"
```

Use JSON with a JSONB PostgreSQL variant for ordered arrays and structured editorial data. Use UUID foreign keys internally and indexed immutable `public_id` values externally.

- [ ] **Step 4: Run model tests and verify GREEN**

Run the focused model test, then existing Stage 1 model tests.

- [ ] **Step 5: Write the failing migration test**

Extend the migration test to assert revision `20260729_0003`, all new tables, `users.role`, and downgrade/upgrade viability.

- [ ] **Step 6: Run migration test and verify RED**

Expected: head revision or table assertion failure.

- [ ] **Step 7: Add the explicit Alembic migration**

Create all enums, tables, constraints, indexes, foreign keys, and the `users.role` default. Downgrade must remove content tables before enum types and remove `users.role` last.

- [ ] **Step 8: Run migration and model tests**

Run:

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/alembic upgrade head
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/pytest tests/db tests/migrations -q
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/db backend/app/alembic/versions backend/tests/db backend/tests/migrations
git commit -m "feat: add content platform database schema"
```

### Task 2: Canonical Seed Data and Local CLI

**Files:**
- Create: `backend/app/seeds/content/ingredients.json`
- Create: `backend/app/seeds/content/recipes.json`
- Create: `backend/app/seeds/content/bars.json`
- Create: `backend/app/seeds/content/knowledge.json`
- Create: `backend/app/seeds/content/home.json`
- Create: `backend/app/modules/content/seed.py`
- Create: `backend/app/cli/__init__.py`
- Create: `backend/app/cli/__main__.py`
- Create: `backend/tests/modules/content/test_seed.py`
- Create: `backend/tests/cli/test_admin_cli.py`
- Modify: `backend/THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Produces: `seed_content(session: Session, update_existing: bool = False) -> SeedResult`.
- Produces: `promote_admin(session: Session, phone: str, role: UserRole) -> User`.
- Consumes: Stage 1 phone normalization and hashing helpers.

- [ ] **Step 1: Write failing seed tests**

Tests must prove:

```python
first = seed_content(session)
second = seed_content(session)
assert first.created > 0
assert second.created == 0
assert second.skipped == first.created
```

Also prove a validation error rolls back the whole import and `update_existing=False` preserves a manually changed title.

- [ ] **Step 2: Verify seed tests fail**

Expected: module import failure.

- [ ] **Step 3: Add canonical JSON seed files**

Transcribe only ingredients, recipes, bar venues, drink knowledge, hero slides, and home shortcuts. Exclude community posts and shared cellar cards. Preserve every current public ID and image key.

- [ ] **Step 4: Implement transactional seed loading**

Validate JSON through content Pydantic input models before database writes. Upsert by `public_id`, link recipe ingredients by UUID, and return created/updated/skipped counts.

- [ ] **Step 5: Verify seed tests pass**

Run:

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/pytest tests/modules/content/test_seed.py -q
```

- [ ] **Step 6: Write failing CLI tests**

Prove an existing user can be promoted to `EDITOR`, an unknown phone returns a controlled error, and revocation restores `USER`.

- [ ] **Step 7: Implement CLI commands**

Expose:

```bash
python -m app.cli seed-content
python -m app.cli seed-content --update-existing
python -m app.cli promote-admin --phone +8613800000000 --role EDITOR
python -m app.cli revoke-admin --phone +8613800000000
```

Do not print complete phone numbers or secrets.

- [ ] **Step 8: Run seed and CLI tests**

- [ ] **Step 9: Commit**

```bash
git add backend/app/seeds backend/app/modules/content backend/app/cli backend/tests/modules backend/tests/cli backend/THIRD_PARTY_NOTICES.md
git commit -m "feat: add idempotent content seeding and admin cli"
```

### Task 3: Public Content API and Search

**Files:**
- Create: `backend/app/modules/content/__init__.py`
- Create: `backend/app/modules/content/schemas.py`
- Create: `backend/app/modules/content/repository.py`
- Create: `backend/app/modules/content/service.py`
- Create: `backend/app/api/routes/content.py`
- Modify: `backend/app/api/router.py`
- Create: `backend/tests/api/test_content_public.py`
- Create: `backend/tests/api/test_content_search.py`
- Modify: `backend/tests/api/test_openapi.py`

**Interfaces:**
- Produces: public response models matching `CocktailRecipe`, `Ingredient`, `HeroSlide`, `HomeShortcut`, `BarVenue`, and `DrinkKnowledgeEntry`.
- Produces: `GET /api/v1/home`, `/ingredients`, `/recipes`, `/recipes/{publicId}`, `/bars`, `/bars/{publicId}`, `/knowledge`, `/knowledge/{publicId}`, and `/search`.
- Consumes: seeded published content from Task 2.

- [ ] **Step 1: Write failing public API tests**

Seed data in the database fixture and assert:

- only published rows are returned;
- a known recipe preserves `id`, `englishName`, ingredients, steps, and `imageKey`;
- unpublished detail returns 404;
- list responses include stable pagination;
- `/home` preserves banner and shortcut order.

- [ ] **Step 2: Verify public API tests fail**

Expected: 404 because routes are absent.

- [ ] **Step 3: Implement schemas, repository, service, and routes**

Use `Annotated` FastAPI query parameters. Keep blocking SQLModel access in synchronous route functions. Return typed response models only.

- [ ] **Step 4: Verify public API tests pass**

- [ ] **Step 5: Write failing search tests**

Prove one Chinese character can match, matching is case-insensitive for English, archived rows are excluded, and results have deterministic ordering.

- [ ] **Step 6: Implement parameterized PostgreSQL search**

Search names, descriptions, tags, addresses, meanings, stories, and symbols with SQLAlchemy expressions. Cap `pageSize` at 100.

- [ ] **Step 7: Run API and OpenAPI tests**

```bash
cd backend
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/pytest tests/api/test_content_public.py tests/api/test_content_search.py tests/api/test_openapi.py -q
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/modules/content backend/app/api backend/tests/api
git commit -m "feat: expose published content and search APIs"
```

### Task 4: Admin Authorization, Publishing, and Rollback

**Files:**
- Create: `backend/app/modules/admin/__init__.py`
- Create: `backend/app/modules/admin/dependencies.py`
- Create: `backend/app/modules/admin/content_service.py`
- Create: `backend/app/api/routes/admin_content.py`
- Modify: `backend/app/api/router.py`
- Create: `backend/tests/api/test_admin_content_auth.py`
- Create: `backend/tests/api/test_admin_content_lifecycle.py`
- Create: `backend/tests/api/test_admin_content_versions.py`
- Modify: `backend/tests/api/test_openapi.py`

**Interfaces:**
- Produces: `AdminAuth = Annotated[AuthContext, Depends(require_editor)]`.
- Produces: create, patch, publish, archive, version list, and rollback endpoints for every Stage 2 content type.
- Consumes: `expectedRevision` and content input schemas.

- [ ] **Step 1: Write failing authorization tests**

Prove missing token returns 401, a `USER` returns 403, and `EDITOR` and `SUPER_ADMIN` can list admin recipes.

- [ ] **Step 2: Verify authorization tests fail**

- [ ] **Step 3: Implement reusable editor dependency**

Raise:

```python
AppError(
    code="ADMIN_PERMISSION_REQUIRED",
    message="需要内容管理员权限",
    status_code=403,
)
```

- [ ] **Step 4: Verify authorization tests pass**

- [ ] **Step 5: Write failing lifecycle tests**

Prove create defaults to draft, patch increments revision, stale `expectedRevision` returns `CONTENT_REVISION_CONFLICT`, publish exposes public content, and archive hides it.

- [ ] **Step 6: Implement lifecycle service and routes**

Save immutable snapshots for `CREATE`, `UPDATE`, `PUBLISH`, and `ARCHIVE`. Validate all recipe ingredient references before commit.

- [ ] **Step 7: Write failing rollback tests**

Prove versions are ordered newest first and rollback creates a new draft without changing the selected snapshot or publishing automatically.

- [ ] **Step 8: Implement rollback**

Create a new current state from the selected snapshot, increment revision, set status to `DRAFT`, and record a `ROLLBACK` snapshot.

- [ ] **Step 9: Run all admin and OpenAPI tests**

- [ ] **Step 10: Commit**

```bash
git add backend/app/modules/admin backend/app/api backend/tests/api
git commit -m "feat: add versioned admin content workflow"
```

### Task 5: Expo API Boundary and Bundled-First Repository

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/services/content/contentSchemas.ts`
- Create: `src/services/content/bundledContent.ts`
- Create: `src/services/content/apiClient.ts`
- Create: `src/services/content/contentRepository.ts`
- Create: `src/services/__tests__/contentRepository.test.ts`
- Create: `src/services/__tests__/contentSchemas.test.ts`
- Modify: `src/types/mixology.ts`
- Modify: `jest.setup.ts`
- Modify: `.env.example`
- Modify: `backend/THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Produces: `ContentSnapshot`, `ContentRepository`, `createContentRepository(options)`.
- Produces: `refresh(): Promise<RefreshResult>`, `getSnapshot()`, `subscribe(listener)`, and `clearCache()`.
- Consumes: `EXPO_PUBLIC_API_BASE_URL`, AsyncStorage, bundled data, and public API contracts.

- [ ] **Step 1: Install and record Zod**

Run:

```bash
npm install zod
```

Record its MIT license in third-party notices.

- [ ] **Step 2: Write failing schema tests**

Prove valid content parses, missing recipe steps fails, an unsupported shortcut route fails, and cache schema version mismatch fails.

- [ ] **Step 3: Implement Zod schemas**

Define schemas once and infer network-only types from them. Convert parsed payloads to existing `mixology.ts` domain types.

- [ ] **Step 4: Write failing repository tests**

Prove:

- bundled data is available synchronously;
- valid cache replaces bundled data during hydration;
- remote success updates memory and cache;
- timeout, 500, invalid JSON, and invalid shape retain current data;
- missing API URL never calls fetch;
- subscribers are notified only when the snapshot changes.

- [ ] **Step 5: Verify repository tests fail**

- [ ] **Step 6: Implement API client and repository**

Use `AbortController` with a bounded timeout. Accept injected `fetch` and storage in tests. Never throw a background refresh error through a React effect.

- [ ] **Step 7: Run focused frontend tests and typecheck**

```bash
npm test -- --runInBand src/services/__tests__/contentSchemas.test.ts src/services/__tests__/contentRepository.test.ts
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/services/content src/services/__tests__ src/types/mixology.ts jest.setup.ts .env.example backend/THIRD_PARTY_NOTICES.md
git commit -m "feat: add bundled-first mobile content repository"
```

### Task 6: React Content State and Screen Migration

**Files:**
- Create: `src/state/ContentState.tsx`
- Create: `src/state/__tests__/ContentState.test.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/recipes.tsx`
- Modify: `src/app/recipe/[id].tsx`
- Modify: `src/app/bars.tsx`
- Modify: `src/app/bar/[id].tsx`
- Modify: `src/app/drink-knowledge.tsx`
- Modify: `src/app/search.tsx`
- Modify: `src/app/publish-post.tsx`
- Modify: affected component tests under `src/components/mixology/__tests__/`

**Interfaces:**
- Produces: `ContentProvider` and `useContent()`.
- Produces context fields: `snapshot`, `isHydrated`, `isRefreshing`, `refresh`, and `lastRefreshError`.
- Consumes: singleton `ContentRepository`.

- [ ] **Step 1: Write failing provider tests**

Prove children receive bundled content immediately, hydration can replace it with cache, background refresh updates it, and unmount prevents state updates.

- [ ] **Step 2: Implement `ContentProvider`**

Subscribe once, hydrate cache, then refresh in the background. Keep content hydration independent from the account privacy splash gate.

- [ ] **Step 3: Verify provider tests pass**

- [ ] **Step 4: Write failing screen behavior tests**

Update representative Home, Recipes, Bar Detail, Knowledge, Search, and Publish Post tests to provide remote snapshots and assert the screens render those values.

- [ ] **Step 5: Migrate screens to `useContent()`**

Replace direct static service reads. Keep community data and interactions on their existing services. Ensure recipe IDs used by the home mosaic fall back gracefully if remote content omits an item.

- [ ] **Step 6: Add pull-to-refresh where a ScrollView already exists**

Use React Native `RefreshControl`, keep current content visible, and surface a short failure message only for user-triggered refresh.

- [ ] **Step 7: Run all frontend tests**

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

- [ ] **Step 8: Commit**

```bash
git add src/state src/app src/components/mixology/__tests__
git commit -m "feat: connect Expo screens to resilient content state"
```

### Task 7: OpenAPI, Documentation, and Local Demo

**Files:**
- Modify: `backend/openapi.json`
- Modify: `backend/README.md`
- Modify: `backend/.env.example`
- Create: `docs/backend-stage2-local-demo.md`
- Modify: `.github/workflows/backend-ci.yml`
- Create or modify: backend tool tests required by CI changes

**Interfaces:**
- Produces: reproducible commands for migration, seed, admin promotion, Swagger use, Expo API configuration, and fallback verification.

- [ ] **Step 1: Write failing documentation/tooling assertions**

Extend OpenAPI tests to require every public and admin path. If CI gains a seed smoke step, add a tool test that checks it targets the `_test` database.

- [ ] **Step 2: Regenerate OpenAPI**

Run:

```bash
cd backend
./.venv/bin/python scripts/generate_openapi.py
```

- [ ] **Step 3: Document the exact local demo**

Include commands for database startup, migrations, seeding, OTP login, admin promotion, Swagger authorization, publish, Expo configuration, backend shutdown, and fallback verification.

- [ ] **Step 4: Update CI**

Keep the dedicated test database guard. Add migration and seed idempotency coverage without using development or production databases.

- [ ] **Step 5: Run documentation and OpenAPI tests**

- [ ] **Step 6: Commit**

```bash
git add backend/openapi.json backend/README.md backend/.env.example docs/backend-stage2-local-demo.md .github/workflows/backend-ci.yml backend/tests
git commit -m "docs: add stage 2 content workflow and CI coverage"
```

### Task 8: Full Verification, Docker Smoke Test, and Review

**Files:**
- Modify only files required by failing verification tests.

**Interfaces:**
- Produces: a clean Stage 2 branch with reproducible test evidence.

- [ ] **Step 1: Run frontend verification**

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

- [ ] **Step 2: Run backend verification**

```bash
cd backend
./.venv/bin/ruff check .
./.venv/bin/ty check
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/alembic upgrade head
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/pytest
```

- [ ] **Step 3: Run dependency audits**

```bash
npm audit --omit=dev
cd backend
uv export --frozen --no-dev --format requirements-txt > /tmp/beiyu-requirements.txt
```

Review any advisory for runtime reachability; do not hide unresolved high or critical issues.

- [ ] **Step 4: Build and start Docker**

```bash
cd backend
docker compose build api
docker compose up -d db db-test api
docker compose ps
```

- [ ] **Step 5: Run container smoke flow**

Verify health, seed content, call `/api/v1/home` and `/api/v1/recipes`, then stop only containers started by this task if they were not already running.

- [ ] **Step 6: Review the diff**

Use the `code-review-and-quality`, `security-and-hardening`, and `performance-optimization` checklists. Fix findings through failing regression tests.

- [ ] **Step 7: Check repository state**

```bash
git diff --check
git status --short
git log --oneline --decorate -8
```

- [ ] **Step 8: Push and update the stacked pull request**

Push `codex/backend-stage2-content` and open a pull request against `codex/backend-stage1-auth-cellar`.
