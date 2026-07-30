# Task 3 Report

## Status

Complete.

## Summary

Added a schema-validated raw request helper, a refresh-coalescing authenticated client with stable `ApiError` failures, and the mobile auth repository. Unauthenticated SMS, login, and refresh requests bypass the authenticated client; protected auth, account, and cellar routes use it. Refresh tokens remain in `tokenStore`, while access-token access remains callback-based and in memory.

## Files

- `src/services/api/authenticatedClient.ts`
- `src/services/api/__tests__/authenticatedClient.test.ts`
- `src/services/auth/authRepository.ts`
- `src/services/auth/__tests__/authRepository.test.ts`
- `src/services/auth/authSchemas.ts`
- `.superpowers/sdd/2026-07-29-beiyu-stage3-ai-core/task-3-report.md`

## RED

- `npm test -- --runInBand src/services/api src/services/auth/__tests__/authRepository.test.ts`
  - 2 failed suites, 0 executed tests; both failures were the expected missing production modules.
- `npm test -- --runInBand src/services/api/__tests__/authenticatedClient.test.ts`
  - 1 failed suite; 1 failed and 5 passed tests. The failing regression showed cleanup errors replacing the retried 401 `ApiError`.

## GREEN

- `npm test -- --runInBand src/services/api src/services/auth/__tests__/authRepository.test.ts && npm run typecheck`
  - 2 passed suites, 10 passed tests, 0 failures; typecheck exited 0.
- `npm run lint && npm run typecheck && npm test -- --runInBand`
  - Lint and typecheck exited 0; 61 passed suites, 198 passed tests, 0 failures.

## Commits

- `feat: add authenticated mobile API client`

## Self-Review

- Confirmed refreshes are coalesced per client and each request retries at most once.
- Confirmed raw requests prevent recursive authentication refreshes.
- Confirmed 204 responses return without JSON parsing.
- Confirmed server responses are parsed through Task 2 schemas and no response interfaces were duplicated.
- Confirmed normalized failures omit request-body and access-token data, and cleanup failures cannot replace a stable authentication error.

## Concerns

None.

## Fix Round 1/5

### Changes

- Captured each authenticated request's access token and, when a delayed 401 belongs to an already-replaced token, retried once with the current token instead of starting a second refresh.
- Made `CellarItemPatch.amountLabel` and `CellarItemPatch.note` optional so callers can send a single-field PATCH without clearing the other field.

### RED

- `npm test -- --runInBand src/services/api/__tests__/authenticatedClient.test.ts src/services/auth/__tests__/authRepository.test.ts`
  - 1 failed suite and 1 passed suite; 1 failed and 12 passed tests. The delayed old-token 401 test observed 2 refresh calls instead of 1.
- `npm run typecheck`
  - Failed with 1 error: a `{ note: string }` argument was rejected because `amountLabel` was required by `CellarItemPatch`.

### GREEN

- `npm test -- --runInBand src/services/api/__tests__/authenticatedClient.test.ts src/services/auth/__tests__/authRepository.test.ts && npm run lint && npm run typecheck`
  - 2 passed suites, 13 passed tests, 0 failures; lint and typecheck exited 0.

### Verification

- The delayed-response regression proves concurrent old-token requests invoke exactly one refresh and issue four total fetches.
- The cellar regression proves a note-only PATCH sends only `{ "note": "Keep chilled" }`.
