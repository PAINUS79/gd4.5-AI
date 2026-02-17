# Failure Patterns and Preventive Rules

## Purpose
Captures repeated AI/human integration failures and codifies prevention tactics.

---

## FP-01: Hardcoded input keys

### Symptom
Gameplay works on one keyboard layout, fails on remaps/controllers.

### Root cause
Direct key checks instead of InputMap actions.

### Prevention
- Mandatory use of `Input.is_action_*` and `Input.get_axis()`.
- Task rejected if raw keycodes appear in gameplay scripts.

### Memory tag
`input_contract_violation`

---

## FP-02: Physics in `_process`

### Symptom
Jittery movement, frame-rate dependent behavior.

### Root cause
Character movement logic in `_process`.

### Prevention
- Movement/forces only in `_physics_process`.
- Lint check scans for `move_and_slide()` outside physics tick.

### Memory tag
`physics_loop_misuse`

---

## FP-03: Delta misuse with `move_and_slide`

### Symptom
Unexpectedly slow or unstable movement.

### Root cause
Velocity multiplied by delta before `move_and_slide()`.

### Prevention
- Rule: velocity is units/sec; do not pre-scale velocity for `move_and_slide`.
- Add review check for suspicious `velocity * delta` patterns.

### Memory tag
`move_and_slide_delta_error`

---

## FP-04: Brittle node paths

### Symptom
Scene refactor breaks scripts unexpectedly.

### Root cause
Hardcoded deep `get_node("A/B/C")` usage with no contract.

### Prevention
- Use exported `NodePath` for external dependencies.
- Document required nodes in `scene_contracts.md`.
- Validate dependencies in `_ready()`.

### Memory tag
`scene_contract_break`

---

## FP-05: Over-coupled parent traversal

### Symptom
Feature changes cascade into unrelated scene breakage.

### Root cause
Repeated `get_parent()` chains for cross-system communication.

### Prevention
- Prefer signals or EventBus.
- Contracted references only where appropriate.

### Memory tag
`tight_coupling_parent_chain`

---

## FP-06: Giant patch with mixed concerns

### Symptom
Hard-to-debug regressions and merge conflicts.

### Root cause
AI modifies many files and unrelated systems in one task.

### Prevention
- Enforce minimal patch size.
- One feature task, one bounded file scope.
- Reject opportunistic refactors.

### Memory tag
`patch_scope_violation`

---

## FP-07: Missing acceptance checks

### Symptom
Code merges but behavior is wrong in play.

### Root cause
No task-level verification criteria.

### Prevention
- Every task must define explicit acceptance checks.
- Merge gate fails without checks.

### Memory tag
`no_acceptance_gate`

---

## FP-08: Version drift from old examples

### Symptom
API mismatches and runtime errors in Godot 4.5 project.

### Root cause
Copied patterns from older tutorials/repos without adaptation.

### Prevention
- Require version note on external snippet use.
- Cross-check against canonical 4.5 docs and internal contracts.

### Memory tag
`version_drift`

---

## FP-09: Silent failure paths

### Symptom
Feature appears to work but fails under specific conditions.

### Root cause
Missing assertions/logs around required dependencies.

### Prevention
- Add actionable `push_error`/assert where contract dependencies are required.
- No silent null-dependent behavior in critical paths.

### Memory tag
`silent_dependency_failure`

---

## FP-10: Regression after “fix”

### Symptom
New fix breaks old stable behavior.

### Root cause
No regression replay after patch.

### Prevention
- Add at least one adjacent-system regression check per behavior change.
- Keep a lightweight replay checklist for critical loops.

### Memory tag
`regression_unchecked`

---

## FP-11: Performance regression

### Symptom
Frame time spikes, dropped FPS, or hitching after a gameplay/code/content change.

### Root cause
Hot-path changes without baseline check or perf gate.

### Prevention
- Run periodic frame-time baseline tasks.
- Require perf checks for `risk_tier: high` and `blast_radius: systemic` tasks.

### Memory tag
`performance_regression`

---

## FP-12: Serialization break

### Symptom
Save/load fails, state corruption, or missing fields on load.

### Root cause
Data contract drift without migration path.

### Prevention
- Version save payloads and validate schema on load.
- Require migration notes for save-relevant contract changes.

### Memory tag
`serialization_break`

---

## FP-13: Nondeterministic behavior

### Symptom
Behavior changes across runs with same inputs.

### Root cause
Uncontrolled randomness, order dependence, or mixed update loops.

### Prevention
- Seed randomness for tests.
- Keep deterministic logic in fixed tick paths.

### Memory tag
`nondeterministic_behavior`

---

## FP-14: API contract drift

### Symptom
Consumer scripts break after signal/method/field signature changes.

### Root cause
Breaking contract edits without synchronized migration.

### Prevention
- Contract-level lock for signature edits.
- Require consumers list update + migration patch in same task.

### Memory tag
`api_contract_drift`

---

## FP-15: Dependency version conflict

### Symptom
CI/local mismatch, failing tools, or incompatible package behavior.

### Root cause
Unpinned dependency or mismatched environment versions.

### Prevention
- Pin tool/runtime versions in CI and local setup docs.
- Gate changes that alter dependency surface.

### Memory tag
`dependency_version_conflict`

---

## FP-16: Test flakiness

### Symptom
Same test alternates pass/fail without code changes.

### Root cause
Timing race, shared mutable state, or environmental instability.

### Prevention
- Quarantine flaky tests and track separately.
- Eliminate hidden state coupling and timing assumptions.

### Memory tag
`test_flakiness`

---

## FP-17: Content pipeline mismatch

### Symptom
Missing assets, wrong imports, naming mismatches, or scene/content binding failures.

### Root cause
Asset naming/import/collision conventions not enforced as contracts.

### Prevention
- Add asset contract docs + import validator checks.
- Treat content conventions as first-class API.

### Memory tag
`content_pipeline_mismatch`

---

## Post-task reflection template (mandatory)

After each task, record:

1. **Task ID / Feature**
2. **Expected behavior**
3. **Actual behavior**
4. **Failure pattern tag(s)** (if any)
5. **Fix applied**
6. **New prevention rule or test**
7. **Confidence (0.0 - 1.0)**

This reflection entry is stored in project memory and used during retrieval.
