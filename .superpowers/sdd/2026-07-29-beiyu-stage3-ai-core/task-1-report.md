# Task 1 Report

Status: DONE

## Summary

Added configurable AI bootstrap allowance values and reset timing, set the AI
feature flag from settings, and changed account status handling so `BANNED`
accounts retain login-session access while `DELETED` accounts remain rejected.
The OpenAPI snapshot was regenerated; its only schema change is the expanded
`AiAllowance` response.

## Files Changed

- `backend/app/api/routes/me.py`
- `backend/app/core/config.py`
- `backend/app/modules/auth/dependencies.py`
- `backend/app/modules/auth/service.py`
- `backend/app/modules/users/schemas.py`
- `backend/app/modules/users/service.py`
- `backend/openapi.json`
- `backend/tests/api/test_auth_login.py`
- `backend/tests/api/test_auth_sessions.py`
- `backend/tests/api/test_me.py`
- `backend/tests/core/test_config.py`

## RED

Requested command:

```bash
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test uv run pytest tests/api/test_auth_login.py tests/api/test_auth_sessions.py tests/api/test_me.py tests/core/test_config.py -q
```

Result: could not start because `uv` was not available on `PATH`.

Equivalent checked-in runtime command:

```bash
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/pytest tests/api/test_auth_login.py tests/api/test_auth_sessions.py tests/api/test_me.py tests/core/test_config.py -q
```

Result: 4 failed, 23 passed. The failures were the banned access token,
banned refresh token, absent AI settings, and absent AI allowance contract.

## GREEN

Focused command:

```bash
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/pytest tests/api/test_auth_login.py tests/api/test_auth_sessions.py tests/api/test_me.py tests/core/test_config.py -q
```

Result: 27 passed, 0 failed.

Final relevant verification:

```bash
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test ./.venv/bin/pytest tests/api/test_auth_login.py tests/api/test_auth_sessions.py tests/api/test_me.py tests/core/test_config.py tests/api/test_openapi.py tests/api/test_local_sync.py -q
./.venv/bin/ruff check app/core/config.py app/modules/auth app/modules/users app/api/routes/me.py tests/api/test_auth_login.py tests/api/test_auth_sessions.py tests/api/test_me.py tests/core/test_config.py
```

Result: 34 passed, 0 failed; Ruff passed with no findings.

## Commit Hashes

- `b3d00b70c5a090438ffa9531c3d5a23586fc4534` - feat: expose AI-ready account bootstrap

## Self-Review

Reviewed tests first, then implementation and generated OpenAPI diff. The
status checks now reject only absent and deleted users in login, refresh, and
request authentication. Allowance calculations take an injected timestamp,
use the required Asia/Shanghai midnight boundary, and expose only configured
public fields. The OpenAPI path set is unchanged; the snapshot diff contains
only `AiAllowance.remaining` and `AiAllowance.resetsAt` plus required-list
updates. No correctness, readability, architecture, security, or performance
findings remain.

## Concerns

- `uv` is not installed or available on `PATH` in this environment. All test,
  OpenAPI, and lint verification used the repository's existing `backend/.venv`
  runtime instead.
