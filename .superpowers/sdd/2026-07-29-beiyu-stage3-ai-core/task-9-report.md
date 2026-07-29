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
- `review_output` deny-lists recipe IDs by default: only IDs supplied through
  the server-controlled `candidate_recipe_ids` field survive. Task 13 must bind
  that field from `AiGenerationRequest.candidate_recipes` after Provider parsing;
  it must never take this allowlist from the Provider payload.

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
the design. The downstream orchestration must bind the recipe allowlist noted
above before calling `review_output`; an unbound result safely returns no
recipe IDs.
