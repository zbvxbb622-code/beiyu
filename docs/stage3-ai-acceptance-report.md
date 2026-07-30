# Stage 3 AI Acceptance Report

Date: 2026-07-30

Branch: `codex/stage3-ai-acceptance`

Base reviewed for PR: `codex/backend-stage2-content`

## Scope

Task 19 completed the frontend CI quality gate, refreshed the local Stage 3 AI
runbook, regenerated the OpenAPI snapshot to match the current generator, and
ran full backend/frontend regression plus local privacy and persistence smoke
checks.

The branch includes the prior Stage 3 backend and mobile work:

- Backend Stage 3 commits from `a7e3ff0` through `0f69063`.
- Mobile Tasks 15-18 commits `4cd173e`, `9f5f0bb`, `6afc4f6`, and `4f2b451`.
- Task 19 commits `f29ef97` and `c38ed2d`.

## Verification

Backend commands:

- PASS: `python3 -m uv sync --frozen`
- PASS: `python3 -m uv run ruff check .`
- PASS: `python3 -m uv run ty check`
- PASS: `BEIYU_DATABASE_URL=postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test python3 -m uv run pytest`
- PASS: `docker compose config`
- PASS: `docker compose build api`

The local shell did not have a `uv` executable on PATH, so backend verification
used the equivalent `python3 -m uv ...`. The installed uv module reported
version `0.12.0`.

Frontend commands:

- PASS: `npm ci`
- PASS: `npm run lint`
- PASS: `npm run typecheck`
- PASS after rerun: `npm test -- --runInBand`
- PASS: `npx expo export --platform ios`
- PASS: `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1 npx expo start --port 8099 --non-interactive`

The first full Jest run had one transient timeout in
`src/components/mixology/__tests__/AiScreen.test.tsx`. A focused rerun of that
file passed, and a second full Jest run passed with `74 passed` suites and
`279 passed` tests.

## Smoke Evidence

Backend API and PostgreSQL were run through Docker Compose. Development SMS and
Development AI providers were used; no real SMS or model provider was called.

Privacy and persistence smoke:

- Normal marker: `stage3-normal-1785401002110`
- Temporary marker: `stage3-temp-1785401002110`
- PASS: normal marker existed in `ai_messages` with count `1`.
- PASS: temporary marker count across `ai_messages`, `ai_memories`, and
  `ai_memory_sources` was `0`.
- PASS: temporary marker had `0` hits in container logs.
- PASS: temporary marker had `0` hits in source, workflow, docs, lockfile,
  app config, OpenAPI, or `dist`.
- PASS: manual memory delete removed the generated memory; remaining count was
  `0`.

Deletion, quota, timeout, and safety smoke:

- Delete-session marker user: `19901042837`.
- PASS: memory existed before conversation deletion: `1`.
- PASS: message count after conversation deletion: `0`.
- PASS: memory count after conversation deletion: `0`.
- PASS: usage rows were retained: before `1`, after `1`.
- PASS: quota boundary returned HTTP `429` with `AI_DAILY_QUOTA_EXHAUSTED` for
  the 51st request after setting used count to `49`.
- PASS: Development provider timeout trigger returned HTTP `504` with
  `AI_PROVIDER_TIMEOUT`; usage stayed `0 -> 0`.
- PASS: overuse, underage, and self-harm safety fixtures returned zero recipe
  IDs. The self-harm fixture returned `SELF_HARM_CRISIS`.

## 22-Step Local Acceptance

1. PASS: Docker PostgreSQL and API started.
2. PASS: Alembic migration ran to head.
3. PASS: development SMS Provider requested a code.
4. PASS: development code `123456` logged in.
5. PASS: age confirmation and bootstrap completed.
6. PASS: normal emotional chat sent through API; mobile screen behavior covered
   by Jest.
7. PASS: emotional reply acknowledged the user and did not force alcohol.
8. PASS: explicit crisp low-sugar drink request returned at least one recipe
   ID.
9. PARTIAL: normal history restoration covered by mobile state/UI tests; manual
   simulator restart was not executed in this environment.
10. PASS: generated memory was visible through API.
11. PASS: memory deletion removed the visible memory.
12. PASS: temporary chat sent two rounds through API; mobile temporary mode
   covered by Jest.
13. PARTIAL: temporary state reset covered by mobile tests; manual simulator
   exit/reopen was not executed.
14. PASS: database query confirmed temporary body absence.
15. PASS: 50th quota request succeeded and 51st request was rejected.
16. PASS: provider timeout returned `AI_PROVIDER_TIMEOUT` and did not increase
   usage.
17. PASS: overuse, underage, and crisis fixtures returned no recipe IDs.
18. PASS: deleting a normal conversation removed its messages and only-source
   memory while retaining usage rows.
19. PASS: frontend complete checks passed.
20. PASS: backend complete checks, migration tests, Compose config, and Docker
   build passed.
21. PASS: Expo dev server started and iOS export generated `dist`.
22. PASS: branch pushed, PR created, and latest GitHub backend/frontend checks
    passed.

Manual iOS Simulator UI operation was not executed because this delegated
terminal session does not provide an interactive simulator surface. API smoke,
mobile unit tests, Expo dev server startup, and iOS export covered the same
functional paths available locally.

## Final Checks

- PASS: all Stage 3 backend and mobile task commits are present on this branch.
- PASS: `rg -n "createMockAiReply" src` returned no production hits.
- PASS: OpenAPI regeneration is byte-identical after refreshing
  `backend/openapi.json`.
- PASS: AI runtime files checked for AsyncStorage/SecureStore references had no
  hits.
- PASS: OpenAPI/Zod AI contract coverage passed through
  `tests/api/test_openapi.py`, `src/services/ai/__tests__/aiSchemas.test.ts`,
  and `src/services/ai/__tests__/aiRepository.test.ts`.
- PASS: secret scan found no committed cloud/API secrets; generic scanner
  matches were dependency URLs and prose references.
- PASS with notes: phone scan found only existing fixture/demo placeholders such
  as `13800138000`, `13800000000`, and smoke-only local generated numbers in
  command output, not committed real user phone numbers.

## GitHub CI Update

- PASS: backend, latest push run `30528306060` / job `90824331330`.
- PASS: backend, PR run `30528310401` / job `90824345847`.
- PASS: frontend, PR run `30528310293` / job `90824345267`.
