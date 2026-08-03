# Task 7 Report: AI Configuration, Access Policy, and Quota Snapshot

## Implementation

- Implementation commit: `f8dae17 feat: add AI access and quota settings`
- Scope: `BEIYU_AI_*` settings, AI access policy, Beijing quota snapshot, and
  bootstrap quota wiring.
- No changes were made to `progress.md` or Task 8+ implementation code.

## RED

Initial focused test command (the requested `uv` executable is not installed in
this environment):

```text
.venv/bin/pytest tests/core/test_config.py tests/modules/ai/test_access.py tests/modules/ai/test_quota.py tests/api/test_me.py -q
```

Result before implementation:

```text
ImportError: cannot import name 'AiProvider' from app.core.config
ModuleNotFoundError: No module named 'app.modules.ai'
3 errors during collection
```

These failures established the absent configuration enum and AI module
boundaries before production code was added.

## GREEN

Focused tests with the dedicated PostgreSQL database:

```text
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/pytest tests/core/test_config.py tests/modules/ai/test_access.py \
  tests/modules/ai/test_quota.py tests/api/test_me.py -q
35 passed in 7.54s
```

Static checks:

```text
.venv/bin/ruff check app tests
All checks passed!

.venv/bin/ty check app tests
All checks passed!
```

Full backend suite with the dedicated PostgreSQL database:

```text
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/pytest -q
177 passed in 227.06s (0:03:47)
```

The Makefile test intentionally launches a nested complete backend suite; it
was also verified directly:

```text
test_make_test_accepts_a_dedicated_test_database: 1 passed in 123.06s
test_make_test_rejects_a_non_test_database: 2 passed in 2.72s
```

## Risk

Production and staging deployments must provide independent non-development
memory HMAC, application, and provider secrets. The configuration rejects
development defaults and unsafe provider combinations, but it cannot create or
rotate deployment secrets.

## Review Fix Round 1/5

- Implementation commit: `2a867e1 fix: harden AI quota snapshots`

### Bootstrap Policy

`/me/bootstrap` remains successful for users without AI access and returns a
zero allowance without querying `ai_daily_quotas`. This follows design section
8.4, where bootstrap retrieves final account state, and section 8.6, which
allows `BANNED` users to restore a session and read basic data while requiring
`AI_ACCESS_SUSPENDED` at AI module behavior entries. Section 20 defines the
AI-specific 403 errors; it does not make bootstrap an AI behavior entry.

The feature flag continues to report the deployment-level setting. A banned or
unconfirmed user therefore receives their account state plus a zero allowance;
the dedicated AI endpoint remains responsible for returning the stable access
error.

### Quota Semantics

`messages_used_today` is the clamped completed-reply count only. A clamped
reserved count is subtracted only when calculating `remaining`, so in-flight
requests cannot make available allowance exceed the configured limit. Any total
at or above the configured limit returns zero remaining allowance.

### RED

The review regression suite initially failed with the expected symptoms:

```text
9 failed, 33 passed
- whitespace model/API key and all-whitespace HMAC passed validation
- quota snapshot autoflushed pending and dirty caller state
- negative counts produced messages_used_today=-8 and remaining=61
- banned, unconfirmed, and feature-disabled bootstrap called quota_snapshot
```

### GREEN

Focused real PostgreSQL test command:

```text
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/pytest tests/core/test_config.py tests/modules/ai/test_access.py \
  tests/modules/ai/test_quota.py tests/api/test_me.py -q
46 passed in 4.92s
```

The focused quota test uses an actual SQLModel/PostgreSQL session with both a
pending user and a dirty user, calls `quota_snapshot`, and verifies that the
objects remain pending/dirty and the pending row is invisible from another
session. It does not roll back caller work.

Static and full checks:

```text
.venv/bin/ruff check app tests
All checks passed!

.venv/bin/ty check app tests
All checks passed!

BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/pytest -q
188 passed in 199.28s (0:03:19)
```

## Review Fix Round 2/5

- Implementation commit: `c1d16b0 fix: clamp AI bootstrap eligibility`

### Contract Decision

Task 1 introduced `featureFlags.aiChat` as the bootstrap AI availability
signal. The backend OpenAPI and the existing mobile Zod schema already expose
that boolean, so no new field was needed. It now means the current user may
enter AI: it is true only for an active, age-confirmed user when deployment AI
is enabled. It is false for banned, deleted, unconfirmed, and feature-disabled
states. This preserves the bootstrap response shape and frontend compatibility.

Quota exhaustion is distinct from access denial: an eligible user with no
remaining allowance receives `aiChat=true` and `remaining=0`; an ineligible
user receives `aiChat=false`, a zero allowance, and does not query quota. AI
behavior entries still call `require_ai_access` and return the stable detailed
code without exposing the reason in bootstrap.

### Quota And Secret Semantics

`messagesUsedToday` now represents clamped occupied allowance:
`min(limit, max(0, usedCount) + max(0, reservedCount))`; `remaining` is exactly
`limit - messagesUsedToday`. `ai_daily_limit` has a validated lower bound of
one, so a zero-limit snapshot is not constructible through production settings.

Memory HMAC input is stripped before storage and validation. The canonical
value must be non-empty and at least 32 UTF-8 bytes, and it is compared with
trimmed application and provider secrets. Validation errors do not include any
secret value.

### RED

The round2 focused suite initially produced the expected failures:

```text
10 failed, 43 passed
- raw completed/reserved counts leaked above the configured limit
- HMAC whitespace bypassed independent-secret checks and was not canonicalized
- deleted users passed AI access checks
- bootstrap returned aiChat=true for banned and unconfirmed users
```

### GREEN

Focused real PostgreSQL validation:

```text
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/pytest tests/core/test_config.py tests/modules/ai/test_access.py \
  tests/modules/ai/test_quota.py tests/api/test_me.py -q
53 passed in 5.39s
```

This covers raw completed-only overflow, reserved-only overflow, negative plus
positive count combinations, zero-limit settings rejection, canonical Unicode
UTF-8 HMAC boundaries, trimmed-secret equality, quota exhaustion with AI still
enabled, and ineligible bootstrap paths that make no quota query.

```text
.venv/bin/ruff check app tests
All checks passed!

.venv/bin/ty check app tests
All checks passed!

BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/pytest -q
195 passed in 197.38s (0:03:17)
```
