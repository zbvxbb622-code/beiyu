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
