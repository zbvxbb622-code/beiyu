# Task 11 Report: AI Memory Service

## Scope

- Added `backend/app/modules/ai/memory.py` with transparent memory listing,
  candidate application, consent setting, deletion, clearing, and conversation
  source cleanup.
- Added real PostgreSQL lifecycle and concurrency coverage in
  `backend/tests/modules/ai/test_memory.py`.
- Did not modify `progress.md` or Task 12 files.

## RED / GREEN

### RED

1. The initial focused run failed during collection with
   `ModuleNotFoundError: No module named 'app.modules.ai.memory'`.
2. A later regression test showed that a candidate for a rich, sweet drink was
   accepted even though the user only explicitly stated a crisp, low-sugar
   preference. Candidate evidence is now required to overlap non-generic
   summary terms from the owned user message.

### GREEN

```text
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_memory.py -q
14 passed in 0.40s

BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
369 passed in 11.82s

.venv/bin/ruff check .
All checks passed!

.venv/bin/ty check
All checks passed!
```

## Memory And Transaction Semantics

- Keys use NFKC, `casefold`, and collapsed whitespace. Tombstones use the
  exact `beiyu-ai-memory-v1:` HMAC domain with `SecretStr.get_secret_value()`;
  no key, summary, hash, or secret is logged.
- Candidates require normal mode, enabled consent, `SafetyDecision.allow_memory`,
  an owned user-role message, an allowed non-sensitive category, no detected
  private identifier, and direct evidence from the user's expression.
- Same normalized category/key updates one row. An unchanged summary does not
  change `updated_at`, but a distinct message remains a source; sources are
  deduplicated by memory/message. New keys are skipped at the configured cap,
  while existing rows may still update.
- Candidate writes lock the user row and existing memory rows, so concurrent
  writes cannot exceed the cap or duplicate a normalized key. Tests use real
  PostgreSQL sessions for both the cap and same-key races, then remove their
  independently committed setup user.
- Services never commit or roll back their caller's transaction. `flush()` is
  used only to establish the ordering required by the same transaction.
- User delete/clear writes each tombstone before deleting sources and memory.
  Repeated delete/clear is idempotent; foreign IDs use the same `AI_MEMORY_NOT_FOUND`
  response. Conversation cleanup only removes that conversation's sources and
  removes orphan memories without tombstones, allowing a future explicit
  expression to create them again.
- Disabling memory preserves existing rows and only stops later reading/writing;
  it is not treated as a deletion request.

## Commit

`feat: add transparent AI memory controls` (SHA recorded in the final task handoff).

## Residual Risk

The deterministic Chinese expression and privacy rules deliberately reject
ambiguous candidates. Expanding language coverage or adding a classifier would
need a new safety/privacy design review rather than weakening this allowlist.
