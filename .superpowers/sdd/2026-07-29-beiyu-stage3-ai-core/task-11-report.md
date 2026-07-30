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

## Review Round 1 / 5

### Important Fixes

1. Candidate `sensitive=false` is now only one rejection signal, never an
   authorization. Source content, normalized key, and summary are canonicalized
   with NFKC/casefold before server-side privacy and conservative medical-detail
   checks. The shared Task 9 safety helper now covers full-width identifiers and
   medical terms including diabetes, anxiety disorder, hypertension, cancer,
   inflammation, syndromes, disorders, diagnosis, medication, and history.
   A normal low-sugar preference remains allowed. Safety reminders are limited
   to one `避免 X` or `偏好无酒精` conclusion, with medical reasons rejected.
2. Privacy checks now run against the canonical content/key/summary tuple.
   Real PostgreSQL tests cover full-width phone, ID card, email, and address
   values and assert that no memory row is written.
3. `apply_memory_candidates` no longer trusts caller-owned model attributes.
   It uses only supplied IDs, locks and reads the current user, conversation,
   and user-role source message from PostgreSQL, and rejects missing, foreign,
   or mismatched rows before candidate processing.
4. Consent is read only after a `FOR UPDATE` user lock with
   `populate_existing=True`; `set_memory_enabled` takes the same lock. Real
   two-session tests prove a committed disable defeats a stale apply, while an
   already locked apply completes before a waiting disable, yielding explicit
   linearized behavior.
5. The common lock hierarchy is `user -> conversation -> source message ->
   memory -> memory source`. Conversation cleanup takes the user and
   conversation locks before snapshotting sources, locks affected memories
   before source rows, and removes orphans. A real concurrent cleanup plus
   conversation-delete test proves a stale apply is rejected rather than
   leaving a source-less memory. Task 12 must call
   `remove_conversation_memory_sources()` before deleting a conversation in the
   same transaction.

### RED / GREEN

```text
RED
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_memory.py -q
10 failed, 20 passed

The failing cases covered medical candidates marked non-sensitive, full-width
privacy data, forged detached source models, stale consent, and cleanup/apply
foreign-key races. A final single-conclusion safety-reminder test also failed
before its validator was added.

GREEN (focused)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_memory.py -q
31 passed in 0.63s

GREEN (full)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
386 passed in 15.17s

.venv/bin/ruff check .
All checks passed!

.venv/bin/ty check
All checks passed!
```

### Transaction Boundary

Memory services still do not commit or roll back caller work. Any flush remains
inside the caller transaction; the only ordering guarantee is tombstone flush
before user-driven source/summary deletion. Concurrent test workers use bounded
barriers and `Future.result(timeout=10)` and remove their independently
committed setup users after observation.

## Review Round 2 / 5

### Important Fix

`contains_medical_memory_detail()` no longer relies on raw single-character
medical substrings. After the existing NFKC/casefold canonicalization it uses
two explainable, bounded regular expressions: a direct list of common
multi-character conditions (including diabetes, hypertension, depression and
anxiety disorders, asthma, cancer, hepatitis, and gastritis), and medical
context markers (`得了`, `患有`, `确诊`, `诊断为`, `病史`, `病情`, `发作`,
`正在治疗`, `服药`, `用药`, `医生说`) followed by one to 24 non-sentence-boundary
characters. The latter conservatively rejects an unknown nearby condition such
as `得了罕见病` without requiring Chinese segmentation or unbounded matching.

The check continues to run on canonicalized user source content, normalized
key, and summary before a provider's `sensitive` flag is considered. Real
PostgreSQL tests prove that a provider-marked-non-sensitive candidate is not
stored for source-only `得了哮喘`, an unknown condition in medical context, or a
summary mentioning diabetes. Negated medical information (for example,
`没有被诊断为糖尿病`) remains rejected intentionally: it is still medical detail
that must not be retained. Ordinary preferences containing non-medical uses of
these characters (`炎热天气`, `发炎色`, `酸甜苦辣`, and `低糖低酒精`) remain
storable.

### Lock Hierarchy And Transactions

This round does not alter the established order: `user -> conversation ->
source message -> memory -> memory source`. Candidate application still locks
and re-reads the user before consent and source validation; cleanup and consent
paths retain their compatible ordering. No service commits or rolls back the
caller's transaction, and the bounded detector performs no database work.

### RED / GREEN

```text
RED
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/pytest tests/modules/ai/test_memory.py \
  -k 'medical_candidate or non_medical_preferences_near_medical_terms'
3 failed, 10 passed, 25 deselected

The failures showed that source-only `得了哮喘` and `得了罕见病` were written,
while the ordinary `炎热天气` preference was incorrectly rejected.

GREEN (focused)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/pytest tests/modules/ai/test_memory.py
39 passed in 0.72s

GREEN (full)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/pytest
394 passed in 11.98s

.venv/bin/ruff check .
All checks passed!

.venv/bin/ty check
All checks passed!
```

### Residual Risk

The 24-character contextual window is deliberately conservative and can reject
non-diagnostic text immediately following a medical marker. It avoids storing
medical detail and avoids the prior broad single-character false positive;
expanding it should be reviewed as a privacy-policy change.
