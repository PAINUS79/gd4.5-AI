# State Engine Notes

This folder contains the dual-pane section progression engine.

## Files
- `section_state_machine.ts` - reducer + transitions + progress math
- `section_state_machine.test.ts` - Vitest behavior suite
- `section_state_machine.guard.ts` - manifest integrity guard
- `guard_smoke_test.ts` - quick runtime manifest validation script

## Key guarantees
- Dependency-aware section start
- Blocked state on failed checks or missing artifacts
- Completion requires checklist + artifacts + verify pass
- Parent auto-completion when all children complete
- Regression reopening (`regression_blocked`) for completed sections
