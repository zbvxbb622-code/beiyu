# Frontend Stability Optimization Design

## Scope

Optimize the Expo/React Native frontend by addressing four verified stability issues:

- Remove current lint blockers from React Compiler and hook rules.
- Make local interaction updates use the latest state so rapid user actions do not overwrite each other.
- Make the AI screen honor an incoming `prompt` route parameter with matching initial messages and recommendations.
- Clean up asynchronous publish tests so passing tests do not emit React `act(...)` warnings.

Visual redesign, navigation restructuring, dependency upgrades, and broad refactors are out of scope.

## Approach

Use small, test-backed changes in the existing files and patterns. Add or adjust focused tests before production changes where behavior changes are involved. For lint-only React Compiler compliance, verify through `npm run lint` because the rule itself is the regression guard.

## Design

Animated values in the blind box flow will be initialized through stable refs without reading ref values during render in a way that violates React Compiler rules. Derived animation interpolations will be memoized where needed.

`MixologyProvider` will maintain a latest-state ref for interaction state. The shared interaction updater will compute from that latest value, update the ref immediately, then update React state and persistence. This keeps sequential async actions from using stale closures.

`AiScreen` will derive initial chat state from `prompt`. If a prompt exists, the screen starts in chat mode with a user message containing that prompt and an assistant response from `createMockAiReply`, including recipe cards. Without a prompt, current welcome behavior remains unchanged.

Publish flow tests will await user interactions that trigger asynchronous state updates. This should remove warnings while preserving the real behavior assertions.

## Verification

Run focused tests for affected areas first, then run:

- `npm run lint`
- `npm run typecheck`
- `npm test -- --runInBand`

If practical, run web export as a final integration check because this project targets Expo Web static output.
