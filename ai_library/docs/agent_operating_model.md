# Agent Operating Model (5-Agent Core)

## Purpose
Defines the default multi-agent setup, supervisor control plane, and execution rules for reliable Godot 4.5 delivery.

## Core agents (minimum set)

1. **Planner**
   - Converts request → task DAG + acceptance gates.
   - Output: task packet (`res://ai_library/tasks/current_task.yaml`).

2. **Implementer**
   - Produces minimal diff in allowlisted files only.
   - Output: patch + assumptions.

3. **Verifier**
   - Runs static/startup/contract/acceptance checks.
   - Output: pass/fail verification report.

4. **Reviewer (adversarial)**
   - Performs failure pre-mortem and break-attempt review.
   - Output: risk report + rollback trigger suggestions.

5. **Reflector/Memory Writer**
   - Appends structured memory with failure tags and prevention updates.
   - Output: memory entry in `memory_log.jsonl`.

## Supervisor control plane

- Supervisor owns lane assignment and DAG ordering.
- DAG edges enforce dependencies.
- Parallel execution allowed only for disjoint file + contract scopes.
- Integrator merges serially after gate pass.

## Required execution loop

Retrieve → Plan → Patch → Verify → Critique → Repair (max 3) → Reflect → Merge

## Prompt layering

1. Stable system contract (role, constraints, schema)
2. Task packet (objective, scope, gates, risk, budget)
3. Retrieval evidence pack (contracts, patterns, failures, API refs)
4. Short execution instruction (minimal patch + schema output)

## Hard gate policy

No merge if any are missing:
- assumptions
- acceptance checks
- memory entry
- verification notes (`plan_note`, `risk_note`, `verification_note`)

## Contract-level locks

Use contract-level locks in addition to file locks:
- `CONTRACT-API-INPUT-001` lock for input action changes
- `CONTRACT-HEALTH-001` lock for health signal/method signature changes
- `CONTRACT-EVENTBUS-001` lock for event payload/signature edits

## Metrics (weekly)

- first_pass_acceptance_rate
- repair_attempts_per_task
- regression_rate
- merge_conflict_rate
- time_to_green_minutes
- confidence_calibration_gap

## Escalation policy

- Max repair attempts per task: **3**
- Escalate to human integrator when:
  - contract changes are required,
  - gate remains red after 3 repairs,
  - risk tier is high with systemic blast radius.
