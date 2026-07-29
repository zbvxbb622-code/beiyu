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

## Review Round 2 / 5

### Important Fixes

1. Output review now uses deterministic token groups rather than only exact
   sentences. It replaces combinations that exclude other support, claim
   exclusive dependence, assert a diagnosis, or frame alcohol as emotional
   treatment. Nearby negated and supportive phrasing remains allowed.
2. Crisis classification removes reported or quoted crisis clauses introduced
   by another person saying, asking, or worrying before evaluating the current
   user. A following contrast clause remains available for current intent, so
   `但现在我真的不想活了` still takes the crisis path.
3. `context_text` is now excluded from the Provider payload. The exported
   `serialize_generation_request()` is the single canonical provider contract:
   camelCase `model_dump_json(by_alias=True)`. Both normal and temporary
   builders iteratively admit whole units only while this exact JSON string is
   within the 12,000-character limit. The adapter in Task 10 must reuse this
   serializer.
4. `tests/tools/test_makefile_test_database.py` no longer recursively executes
   the complete suite from inside the complete suite. Its fake `uv` runner
   returns a pytest sentinel while still exercising Makefile database validation
   and migration command composition. This removes competing PostgreSQL test
   transactions and allows the outer run to exit naturally.

### RED / GREEN

```text
RED
tests/tools/test_makefile_test_database.py::test_make_test_accepts_a_dedicated_test_database
failed because the nested runner output did not include the sentinel.
The nested command itself ran 267 passed, 3 deselected in 21.41s.

GREEN (focused PostgreSQL and lifecycle)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_schemas.py \
  tests/modules/ai/test_safety.py tests/modules/ai/test_context.py \
  tests/tools/test_makefile_test_database.py -q
54 passed in 5.97s

GREEN (full, natural exit)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
270 passed in 28.37s
PYTEST_EXIT=0

.venv/bin/ruff check .
All checks passed!

.venv/bin/ty check
All checks passed!
```

### Round 2 Re-review Verification

The dependency rule was narrowed after a RED nearby-safe assertion:
`不要依赖我，也可以找其他人支持你。` must remain supportive rather than
exclude outside support. The final deterministic rule therefore requires a
local negative-plus-other-support combination, or a local `只/只有` plus
exclusive-self-support combination. It does not join unrelated tokens across
clauses.

RED also covered `朋友说："我想自杀"` being treated as the current user's
intent. Reported direct quotes are now removed through their closing quote;
reported indirect clauses are removed through their sentence or contrast
boundary. A following `但现在我真的不想活了` remains in the evaluated text.

The canonical Provider contract is the camelCase JSON produced by
`serialize_generation_request()`. `contextText` is excluded, so the diagnostic
transcript is not double-sent. The 12,000-character budget is measured against
that exact serialized structured payload (Python character count, including
Chinese, escaping, and UUIDs) in both normal and temporary builders.

```text
GREEN (focused PostgreSQL and lifecycle)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_schemas.py \
  tests/modules/ai/test_safety.py tests/modules/ai/test_context.py \
  tests/tools/test_makefile_test_database.py -q
57 passed in 5.82s

GREEN (full suite; natural exit)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
273 passed in 25.49s
PYTEST_EXIT=0

.venv/bin/ruff check .
All checks passed!

.venv/bin/ty check
All checks passed!
```

## Review Round 3 / 5

### Critical Attribution Fix

Reported-crisis handling now segments the input at Chinese and English commas,
semicolons, and sentence-ending punctuation. Only a clause containing both a
third-party reporting verb and a crisis phrase has that reported phrase
removed. Later clauses are evaluated independently. Within one clause, `但`,
`而`, `不过`, `可是`, `然而`, and explicit current-intent starts such as
`我现在`, `我真的`, and `其实我` split the reported portion from the current
user portion. This makes `朋友说我想自杀，我现在真的不想活了。` and the
semicolon, `而`, and unpunctuated-current-intent variants take the crisis path,
while third-party reports and a following user denial remain safe.

### Output Review Rules

Table-driven fixtures cover unsafe and nearby-safe variants for:

1. Exclusive dependency, including `只要有我就够了` and `只要我一个就足够了`,
   while preserving `有我陪你，也请联系可信任的人`.
2. Diagnosis assertions, including `你得了抑郁症` and `你这是焦虑症`, while
   preserving `我不能判断你是否得了抑郁症`.
3. Alcohol as emotional treatment, including `喝一杯/来一杯/灌一杯` paired
   with forgetting, relief, or numbing emotional pain, while preserving
   `喝一杯不能解决难过`.

Every unsafe Provider result is replaced with the fixed safety reply and label,
and clears recipe IDs and memory candidates.

### RED / GREEN

```text
RED
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_safety.py -q
10 failed, 45 passed

GREEN (focused PostgreSQL)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest tests/modules/ai/test_schemas.py \
  tests/modules/ai/test_safety.py tests/modules/ai/test_context.py \
  tests/tools/test_makefile_test_database.py -q
73 passed in 3.73s

GREEN (full, natural exit)
BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test \
  .venv/bin/python -m pytest -q
289 passed in 12.86s
PYTEST_EXIT=0

.venv/bin/ruff check .
All checks passed!

.venv/bin/ty check
All checks passed!
```
