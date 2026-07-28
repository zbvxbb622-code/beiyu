# Frontend Stability Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix frontend lint blockers and harden the Expo app's local state, AI prompt initialization, and async publish tests.

**Architecture:** Keep changes local to existing app screens, state provider, and tests. Use focused regression tests for behavior changes and lint/typecheck/test commands for compiler-rule and integration verification.

**Tech Stack:** Expo Router, React Native 0.86, React 19.2, TypeScript, Jest Expo, React Native Testing Library, Expo lint with React Compiler rules.

## Global Constraints

- Do not redesign UI or restructure navigation.
- Do not add new dependencies.
- Preserve existing user changes in the dirty worktree.
- Use focused tests before production behavior changes.
- Run `npm run lint`, `npm run typecheck`, and `npm test -- --runInBand` before completion.

---

### Task 1: Interaction State Freshness

**Files:**
- Modify: `src/state/MixologyState.tsx`
- Test: `src/services/__tests__/interactionService.test.ts` or a new focused state/provider test if needed

**Interfaces:**
- Consumes: existing `LocalInteractionState`, `saveInteractionState`, and `useMixology` APIs.
- Produces: `updateInteractions(updater)` computes from the latest interaction state, not a stale render closure.

- [ ] **Step 1: Write the failing test**

Add a test that triggers two interaction updates from the same rendered provider snapshot and expects both changes to persist in memory. The production change this catches: `updateInteractions` computes from stale `interactionState` and overwrites the first update.

- [ ] **Step 2: Run test to verify it fails**

Run the focused test file with `npm test -- --runInBand <test-file>`.

- [ ] **Step 3: Write minimal implementation**

Add a latest-state ref in `MixologyProvider`, synchronize it after hydration, and have `updateInteractions` compute and persist from that ref before setting React state.

- [ ] **Step 4: Run test to verify it passes**

Run the same focused test command.

### Task 2: AI Prompt Route Initialization

**Files:**
- Modify: `src/app/ai.tsx`
- Test: `src/components/mixology/__tests__/AiScreen.test.tsx`

**Interfaces:**
- Consumes: route param `prompt?: string`, `createMockAiReply(input)`.
- Produces: chat mode starts with a user message for the prompt and a matching assistant recommendation when `prompt` is provided.

- [ ] **Step 1: Write the failing test**

Add a test mocking `useLocalSearchParams` to return `{ prompt: '给我一杯金汤力' }`. Assert the chat opens directly, shows `给我一杯金汤力`, shows a matching title such as `金汤力的变化`, and does not show the fixed seeded user prompt.

- [ ] **Step 2: Run test to verify it fails**

Run `npm test -- --runInBand src/components/mixology/__tests__/AiScreen.test.tsx`.

- [ ] **Step 3: Write minimal implementation**

Initialize messages from `initialPrompt` by creating a user message and calling `createMockAiReply`. Keep existing no-prompt welcome behavior unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run the same focused test command.

### Task 3: Publish Flow Async Test Warnings

**Files:**
- Modify: `src/components/mixology/__tests__/PublishPostPublish.test.tsx`
- Modify: `src/components/mixology/__tests__/PublishPostDraft.test.tsx`

**Interfaces:**
- Consumes: existing `PublishPostScreen` behavior and React Native Testing Library async helpers.
- Produces: tests that pass without React `act(...)` warnings.

- [ ] **Step 1: Reproduce warnings**

Run `npm test -- --runInBand src/components/mixology/__tests__/PublishPostPublish.test.tsx src/components/mixology/__tests__/PublishPostDraft.test.tsx` and preserve warning output.

- [ ] **Step 2: Adjust async interactions**

Wrap publish/draft button presses that trigger async state updates in `await act(async () => { ... })`, or use `waitFor` around the user-visible result that follows the async update.

- [ ] **Step 3: Verify warning cleanup**

Run the same focused test command and confirm the console no longer emits `act(...)` or overlapping `act()` warnings.

### Task 4: Lint Blockers and Final Verification

**Files:**
- Modify: `src/app/blind-box.tsx`
- Modify: `src/components/mixology/BlindBoxCard.tsx`
- Modify: files with trivial lint warnings if required by `npm run lint`

**Interfaces:**
- Consumes: existing blind box animation behavior.
- Produces: React Compiler compatible animation refs and a clean lint run.

- [ ] **Step 1: Reproduce lint blockers**

Run `npm run lint` and confirm errors point to blind box refs and publish ID generation.

- [ ] **Step 2: Fix animation refs**

Replace render-time `.current` access patterns with stable ref objects and memoized derived values. Use local variables only after initialization is compiler-safe.

- [ ] **Step 3: Fix publish ID purity**

Move impure ID generation into event-time code paths or use a counter-only/ref-backed scheme that does not call `Date.now()` in a render-created function flagged by lint.

- [ ] **Step 4: Clean remaining warnings that block quality**

Remove unused imports/variables and import-order issues reported by lint when they are in touched or directly relevant files.

- [ ] **Step 5: Run final verification**

Run `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, and if time permits `npx expo export --platform web --output-dir /tmp/mx-ms-web-export`.
