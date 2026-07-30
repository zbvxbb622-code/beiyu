# Task 12 Report: Conversation and Message Persistence

## Scope

- Added owned AI conversation and message persistence, pagination, stale-empty
  cleanup, idempotent exchange storage, and hard deletion.
- Added PostgreSQL coverage for ownership, pagination, cleanup boundaries,
  reservation protection, deletion foreign keys, and concurrent exchange and
  cleanup operations.
- Added a Task9 schema-contract fixture only; AI routes remain Task14 work.
- Did not modify `progress.md` or Task13 files.

## RED / GREEN

### RED

The initial focused run failed during collection because
`app.modules.ai.conversations` did not exist.

### GREEN

```text
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_conversations.py \
  tests/api/test_ai_conversations.py -q
9 passed in 0.31s

BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
412 passed in 12.30s

.venv/bin/ruff check .
All checks passed!

.venv/bin/ty check
All checks passed!
```

## Persistence And Locking Semantics

- All resource lookups include the resource ID and `user_id`; foreign or absent
  conversation UUIDs return `AI_CONVERSATION_NOT_FOUND` without revealing
  ownership. Caller `User` attributes are not trusted beyond the ID.
- List/create cleanup only considers the current user. It deletes only rows
  older than 24 hours, with zero messages and no non-expired `RESERVED`
  request. The exact 24-hour boundary is retained. Expired reservations do not
  protect an empty conversation; Task8 can still reclaim their quota state by
  user/request after the conversation foreign key becomes null.
- Empty conversations remain accessible by get/send but are excluded from the
  list until a successful exchange writes messages. Conversation ordering is
  `last_message_at DESC, id DESC`; message ordering is `created_at ASC, id ASC`.
- Mutations lock `user -> conversation`. A save locks its owned normal request,
  creates both messages, stores the reviewed recipe IDs only, assigns strictly
  increasing timestamps under the conversation lock, derives the first title
  through Task9 redaction, and sets the request response-message anchor. A
  repeated save returns the anchored exchange rather than inserting a second
  pair. No function commits or rolls back its caller transaction.
- Delete invokes Task11 source cleanup before hard-deleting the conversation in
  the same transaction. Message cascades remove message rows; database FKs set
  request/usage conversation and request response-message references to null.
  Shared memories remain, orphan memories are removed without tombstones.

## Residual Risk

Task13 must call `save_exchange`, memory application, and Task8
`complete_reservation` in its single short transaction. This module deliberately
does not perform provider I/O, quota finalization, or route handling.
