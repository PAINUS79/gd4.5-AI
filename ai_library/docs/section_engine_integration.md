# Section Engine Integration Guide

## Purpose
Wire the dual-pane section tracker with strict manifest validation, artifact schema, and testable state transitions.

## Added files
- `schemas/sections_manifest.schema.json`
- `schemas/artifacts_manifest.schema.json`
- `src/state/section_state_machine.ts`
- `src/state/section_state_machine.test.ts`
- `src/state/section_state_machine.guard.ts`
- `src/state/guard_smoke_test.ts`
- `ai_library/docs/section_roadmap.manifest.json`

## Runtime boot sequence
1. Load `ai_library/docs/section_roadmap.manifest.json`.
2. Validate with `validateSectionsManifest()`.
3. If errors exist, block app startup and show remediation list.
4. Initialize store via `initializeStore(manifest.sections)`.
5. Bind UI events returned from `reduceSectionEvent()`.

## UI behavior mapping
- `SHOW_CONFETTI` -> fire confetti overlay for `durationMs`
- `STRIKETHROUGH_SECTION` -> apply complete style to section row
- `SHOW_TOAST` -> show status toast
- `AUTO_SELECT_SECTION` -> focus next section in right pane
- `SHOW_BLOCKED_CARD` -> render remediation card and keep section blocked

## Validation commands
- Guard smoke check (requires TS runtime):
  - `npx tsx src/state/guard_smoke_test.ts`
- State machine tests:
  - `npm run test:state`

## Notes
- `section_state_machine.test.ts` requires `vitest` installed.
- Completion is enforced by checklist pass + required final artifacts + verify pass.
- Parent sections auto-complete when all children are complete.
- Regression transitions move complete sections to `regression_blocked`.
