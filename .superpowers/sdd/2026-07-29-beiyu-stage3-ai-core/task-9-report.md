# Task 9 Report: AI Contracts, Safety Rules, and Context Builder

## Scope

- Added Pydantic v2 request, response, provider, memory, pagination, feedback,
  and regenerate contracts with the repository's camelCase API behavior.
- Added deterministic Chinese input/output safety rules and fixed replies.
- Added PostgreSQL-backed normal and temporary generation context builders.
- Did not modify `progress.md` or any Task 10 provider files.

## RED / GREEN

### RED

1. The initial focused test run failed during collection because `schemas.py`,
   `safety.py`, and `context.py` did not exist.
2. The first implementation run exposed exhausted generator-based rule groups;
   a prior safe classification consumed every pattern. Rule groups are now
   immutable tuples.
3. A trim-boundary regression test failed because Pydantic checked the raw
   string length before trimming. Content normalization now runs before the
   1..2,000 character constraint.

### GREEN

- Focused schemas, safety, and real PostgreSQL context coverage: 18 passed.
- Full backend suite: 237 passed.
- Full repository Ruff and ty checks: no diagnostics.

## Safety Decision Table

| Input or output condition | Label | Provider call | Recipes | Memory | Reply source |
| --- | --- | --- | --- | --- | --- |
| Ordinary emotional distress or ordinary drink request | `SAFE` | Allowed | Candidate allowlist only | Allowed subject to later memory validation | Provider, then output review |
| Explicit self-harm or severe crisis | `SELF_HARM_CRISIS` | No | Disabled | Disabled | `SELF_HARM_CRISIS_REPLY` |
| Minor drinking expression | `MINOR_ALCOHOL` | No | Disabled | Disabled | `MINOR_ALCOHOL_REPLY` |
| Intoxication plus continued drinking or direct binge request | `ALCOHOL_OVERUSE` | No | Disabled | Disabled | `ALCOHOL_OVERUSE_REPLY` |
| Phone, ID card, bank card, detailed address, or diagnosis request | `PRIVACY_SENSITIVE` | No | Disabled | Disabled | `PRIVACY_REPLY` |
| Provider diagnosis, overuse encouragement, prompt leakage, blank or unsafe reply | `OUTPUT_REPLACED` | Already complete | Removed | Removed | `OUTPUT_REPLACED_REPLY` |

Input priority is crisis, minor drinking, overuse, then privacy/diagnosis;
ordinary low mood does not match crisis patterns. Context builders redact
private identifiers defensively even though privacy decisions bypass Provider
calls.

## Context and Recipe Boundary

- Normal context is built as persona, active owned memories, the owned
  conversation's most recent 20 messages in chronological order, active cellar
  ingredient IDs, published recipe candidates, then the current message.
- Temporary context reads only its request context plus cellar and published
  candidates. It does not read normal messages or memories and does not write
  the database.
- `review_output` accepts server-owned recipe IDs as an explicit third argument.
  Task 13 must pass IDs derived from `AiGenerationRequest.candidate_recipes`;
  no result-model field can grant recipe authorization.

## Commands and Results

```text
RED
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_schemas.py \
  tests/modules/ai/test_safety.py tests/modules/ai/test_context.py -q
3 collection errors: target Task 9 modules did not yet exist

GREEN (focused)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_schemas.py \
  tests/modules/ai/test_safety.py tests/modules/ai/test_context.py -q
18 passed in 0.17s

GREEN (full)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
237 passed in 23.06s

.venv/bin/ruff check .
All checks passed!

.venv/bin/ty check
All checks passed!
```

## Residual Risk

The deterministic Chinese rules intentionally provide a bounded safety net,
not complete clinical or privacy detection. Production enablement still needs
expanded safety evaluation and provider content-safety review as specified in
the design. The downstream orchestration must pass the recipe allowlist noted
above before calling `review_output`; an empty allowlist safely returns no
recipe IDs.

## Review Round 1 / 5

### Important Fixes

1. `review_output` now requires `server_allowed_recipe_ids`. The result schema
   no longer has `candidateRecipeIds`; a Provider-supplied extra field is
   ignored under the existing API extra policy. Recipe IDs are intersected with
   the explicit server list and stably deduplicated.
2. The redaction function now covers phone, identity and bank identifiers,
   reasonable email addresses, prefixed addresses, and exact Chinese
   province/city/district/road/number/unit addresses. Classification, current
   input, persisted history, title generation, Provider reply, and memory
   candidates all reuse it. Sensitive memory candidates are dropped rather than
   stored in redacted form.
3. A user with `memory_enabled=false` receives no memories and does not issue
   an `ai_memories` query. A PostgreSQL connection event test proves the query
   is absent.
4. Crisis matching distinguishes direct current-user language from explicit
   negation and third-party attribution. A later positive statement after a
   negation still takes precedence.
5. Output review now replaces diagnostic claims, alcohol-as-relief language,
   exclusive-dependency language, blank replies, and oversized replies with a
   fixed Chinese response while clearing recipes and memory candidates.
6. Provider generation messages validate content by role: user messages allow
   2,000 characters and persisted assistant history allows 8,000.
7. Both builders use the Section 21 `ai_context_messages` limit and the
   design's existing 12,000-character temporary-context maximum as one shared
   Provider transcript budget. No new config variable exists in Section 21.

### Shared Budget Algorithm

The fixed transcript skeleton always contains persona and the current message.
It then admits whole units in this deterministic order: active memories,
newest recent history (returned chronologically), cellar ingredient IDs, then
published recipe candidates. A unit is kept only if serializing the complete
transcript remains within 12,000 characters. IDs, recipe candidates, and roles
are never sliced; lower-priority units are omitted. Temporary mode uses only
the request's temporary context as its history source, never normal history or
memory. The existing temporary request role/content accounting was deliberately
left unchanged for this review round.

### RED / GREEN

```text
RED
AiGenerationResult rejected blank and 8,001-character Provider replies before
review_output could replace them:
2 failed, 22 passed

GREEN (focused PostgreSQL)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_schemas.py \
  tests/modules/ai/test_safety.py tests/modules/ai/test_context.py -q
39 passed in 0.39s

.venv/bin/ruff check app/modules/ai tests/modules/ai
All checks passed!

.venv/bin/ty check app/modules/ai tests/modules/ai
All checks passed!
```

### Full Regression

```text
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
258 tests collected; final single-run progress completed without failures.

BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/api -q
79 passed in 15.72s

.venv/bin/ruff check .
All checks passed!

.venv/bin/ty check
All checks passed!
```
