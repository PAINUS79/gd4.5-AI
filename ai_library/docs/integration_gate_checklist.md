# Integration Gate Checklist (Godot 4.5 AI Pipeline)

## Purpose
Defines mandatory checks before any AI-generated patch can merge into mainline.

---

## A) Task packet integrity (must pass all)

- [ ] Task packet exists and has unique `task_id`
- [ ] `feature_id` and `milestone_id` present
- [ ] Objective/non-objective scope is clear
- [ ] Allowed edit files declared
- [ ] Change budget declared (`max_files_changed`, `max_lines_changed`)
- [ ] Risk fields declared (`risk_tier`, `blast_radius`)
- [ ] Acceptance checks defined
- [ ] Regression checks defined
- [ ] `dod_checks` defined
- [ ] Rollback plan defined

If any item fails: **BLOCK MERGE**

---

## B) Retrieval and contract compliance

- [ ] Agent lists retrieved internal references used
- [ ] `style_guide.md` considered
- [ ] `api_contracts.md` considered
- [ ] `scene_contracts.md` considered
- [ ] If external snippet used, version/license note included

If any item fails: **BLOCK MERGE**

---

## C) Patch discipline

- [ ] Only allowed files modified
- [ ] Diff scope matches task objective
- [ ] No opportunistic refactors
- [ ] No forbidden files touched

If any item fails: **BLOCK MERGE**

---

## D) Godot-specific correctness checks

- [ ] Input uses InputMap actions (no hardcoded gameplay keycodes)
- [ ] Physics motion logic in `_physics_process`
- [ ] `move_and_slide()` usage is valid for CharacterBody flow
- [ ] Required node contracts still valid after scene edits
- [ ] Signals/contracts preserved or explicitly migrated

If any item fails: **BLOCK MERGE**

---

## E) Test and verification gate

- [ ] All task acceptance checks executed
- [ ] All acceptance checks pass
- [ ] At least one adjacent-system regression check executed
- [ ] Startup sanity check passes (no new runtime errors)
- [ ] Required `verification_notes` present (`plan_note`, `risk_note`, `verification_note`)

If any item fails: **BLOCK MERGE**

---

## F) Reflection and memory write

- [ ] Post-task reflection completed
- [ ] Memory entry appended to `memory_log.jsonl`
- [ ] Failure tags assigned if any failure occurred
- [ ] Prevention update recorded for non-trivial failures

If any item fails: **BLOCK MERGE**

---

## G) Integrator decision

- [ ] Merge approved
- [ ] Merge blocked pending fixes
- [ ] Rolled back per rollback plan

Integrator must include one-line rationale.

---

## H) Change budget enforcement

- [ ] Files changed <= `task.max_files_changed`
- [ ] Lines changed <= `task.max_lines_changed`
- [ ] If `risk_tier` is high or `blast_radius` is systemic, manual review sign-off attached

If any item fails: **BLOCK MERGE**
