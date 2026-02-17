# Evidence Context Pack

- Query: jump apex inconsistent nondeterministic behavior
- Task ID: M1-T02
- Dependent Task IDs: M1-T01
- Dependent Contract IDs: CONTRACT-API-INPUT-001

## Memory Matches
- [MEM-M1-T02-001] task=M1-T02 outcome=partial confidence=0.71 score=-0.000 | Jump tuning | fix=Moved non-physics calc from _process to _physics_process.

## Failure Tag Matches
- No explicit failure-tag matches in query.

## Contract and Pattern Evidence
- C:\Users\penus\ggd4.5\ai_library\docs\failure_patterns.md :: L214: ## FP-13: Nondeterministic behavior
- C:\Users\penus\ggd4.5\ai_library\docs\failure_patterns.md :: L227: `nondeterministic_behavior`
- C:\Users\penus\ggd4.5\ai_library\docs\patterns.catalog.yaml :: L26: - "nondeterministic_behavior"
- C:\Users\penus\ggd4.5\ai_library\docs\style_guide.md :: L35: # @purpose: Handles 2D player movement with jump and gravity.
- C:\Users\penus\ggd4.5\ai_library\docs\style_guide.md :: L36: # @dependencies: InputMap actions: move_left, move_right, jump
- C:\Users\penus\ggd4.5\ai_library\docs\style_guide.md :: L88: - Do not mix deterministic physics behavior into `_process`.
- C:\Users\penus\ggd4.5\ai_library\docs\style_guide.md :: L127: - Add/update tests when behavior changes.
- C:\Users\penus\ggd4.5\ai_library\docs\api_contracts.md :: L27: - `jump`

## Recommended Focus
- Prioritize fixes supported by both memory hits and contract evidence.
- If risk_tier is high/systemic, require manual review before merge.
- Append reflection with calibrated confidence after verification.
