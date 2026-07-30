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

## Review Round 1 / 5

### Important Fixes

1. Pagination is now resource-specific at every available Task12 boundary.
   `ConversationPaginationResponse` and `list_conversations` limit page size
   to 50; `MessagePaginationResponse` and `list_messages` allow 100. The
   service raises a stable `ValueError` naming the resource and range, ready for
   Task14's 422 mapping. Contract and PostgreSQL tests cover conversation 51,
   message 51/100, and message 101.
2. Task11 now exposes a public bulk source-cleanup helper that locks the user,
   verifies every supplied conversation belongs to that user, locks those rows
   by sorted UUID, locks all sources and affected memories with set queries,
   bulk-deletes sources, performs one remaining-source query, and bulk-deletes
   only orphan memories. No tombstones are created. Task12 cleanup and single
   deletion reuse the internal already-locked set path, avoiding redundant user
   locks and the previous per-conversation helper loop.

### Query And Concurrency Evidence

- A real PostgreSQL SQLAlchemy `before_cursor_execute` test measures only the
  cleanup call and always removes its listener in `finally`. Cleaning 1 versus
  100 stale empty conversations differs by at most one `SELECT` and one
  `DELETE`; the 100-row batch remains within five `SELECT`s and two `DELETE`s.
- A bulk semantic test removes two conversations at once, confirms an orphaned
  memory is deleted, a memory with a retained third-conversation source remains,
  and no tombstone is written. The existing concurrent cleanup and exchange
  tests continue to exercise real independent PostgreSQL sessions.
- Lock order is `user -> conversations (sorted UUID) -> sources -> memories`.
  Cleanup candidates are also selected by UUID before using the private locked
  path; the public helper never accepts a caller assertion that rows are already
  locked.

### RED / GREEN

```text
RED
Focused collection failed because both ConversationPaginationResponse and
remove_conversation_memory_sources_bulk were absent.

GREEN (focused)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_conversations.py \
  tests/api/test_ai_conversations.py tests/modules/ai/test_memory.py \
  tests/modules/ai/test_schemas.py -q
68 passed in 1.24s

GREEN (full)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
416 passed in 15.67s
```

## Review Round 2 / 5

### Important Fix

Database-side `CASCADE` and `SET NULL` effects now synchronize the caller's
loaded ORM state immediately after the hard-delete statement flushes, without a
commit, rollback, or global `expire_all()`. Before deleting an owned
conversation, Task12 records the affected message IDs and already-loaded
conversation/message/request/usage instances. After the parent delete it
expires only those instances: deleted conversations/messages reload as absent,
and the affected request `conversation_id`/`response_message_id` and usage
`conversation_id` reload as null.

Task11's bulk source cleanup uses the same precise behavior for its direct
bulk deletes: loaded removed sources and orphan memories are expired after
flush, while shared memories remain usable. All three bulk deletes explicitly
use `synchronize_session=False`, preserving their mapped objects long enough
for the targeted expire; default ORM synchronization would otherwise expunge
only directly deleted rows while leaving database-cascaded rows stale.

### Regression Coverage

- The single-delete test loads request, usage, user and assistant messages,
  memory source, orphan/shared memory, and an unrelated profile before deletion
  without an afterward test-side expire. It verifies the request/usage nulls,
  `session.get(...) is None` for deleted messages/source/orphan, and
  `ObjectDeletedError` for retained deleted-object references.
- The stale cleanup test preloads its request and usage, marks an unrelated
  profile nickname dirty, and verifies cleanup refreshes only the nullified
  associations while preserving the profile's in-memory pending value. No
  commit-dependent `expire_on_commit` behavior is used.

### RED / GREEN

```text
RED
2 failed: loaded messages remained returned by session.get after single
delete, and a loaded stale-cleanup request retained its old conversation_id.

GREEN (focused)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_conversations.py \
  tests/modules/ai/test_memory.py -q
60 passed in 1.64s

GREEN (full)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
417 passed in 19.69s
```

## Review Round 3 / 5

### Important Fixes

The delete path no longer scans `Session.identity_map` or reads attributes from
possibly expired/deleted objects. It now selects the owned target messages,
uses targeted `UPDATE ... synchronize_session="fetch"` statements to null
`AiRequest.conversation_id`, `AiRequest.response_message_id`, and
`AiUsageLog.conversation_id`, then directly deletes the target messages and
conversations. The target instances are expired by the already-selected lists,
so a session can delete conversation A and then conversation B without
dereferencing A's deleted state.

The conversation service paths and Task11 bulk source-cleanup path now run
their database work inside `session.no_autoflush`. The former broad deletion
flushes are removed; only the pre-existing exchange/create persistence uses
targeted `flush(objects=[...])`. This leaves unrelated caller-owned pending
changes intact and unpersisted until the caller chooses to flush or commit.

### Regression Coverage

- A real PostgreSQL regression preloads two conversations, their requests,
  usages, and messages, deletes both in the same session, and checks the
  loaded request/usage associations are null with no deleted-message rows left.
- Single delete and stale batch cleanup dirty an unrelated loaded
  `UserProfile` before the call. They assert it remains dirty immediately
  afterward; an independent session still sees the original stored nickname.
- Existing loaded source/orphan/shared-memory tests continue to confirm the
  explicit source/memory deletion semantics, including retained shared memory.

### RED / GREEN

```text
RED
4 failed: unrelated dirty profiles were autoflushed, and deleting a second
preloaded conversation read the expired/deleted first conversation while
scanning the identity map.

GREEN (focused)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_conversations.py \
  tests/modules/ai/test_memory.py -q
62 passed in 1.35s

GREEN (full)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
419 passed in 14.08s

STATIC
.venv/bin/ruff check app tests
.venv/bin/ty check
All checks passed.
```
