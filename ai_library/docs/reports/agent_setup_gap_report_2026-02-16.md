# Agent Setup Gap Report - 2026-02-16

## Evidence source
- `res://ai_library/docs/evidence_packs/optimal_agent_setup.md`

## Current strengths
- Risk and blast-radius checks are already represented in gate and failure taxonomy.
- Contract IDs and pattern IDs exist and are retrievable.
- Hybrid retrieval stack (JSONL + SQLite FTS + evidence pack generation) is operational.

## Gaps closed in this update
1. Repaired `task_packet.template.yaml` corruption and restored valid structured checks.
2. Added explicit five-agent operating contract and supervisor control-plane policy.
3. Added role-specific prompt templates for implementer and adversarial reviewer.
4. Added ADR documenting architecture decision and revisit triggers.

## Remaining next upgrades
- Enforce contract-level lock state in automation (currently policy-level).
- Add changed-file allowlist + max line delta enforcement directly in gate script.
- Add replay-suite runner for historical failure tasks after prompt/template changes.

## Success metrics to monitor
- first_pass_acceptance_rate
- repair_attempts_per_task
- regression_rate
- time_to_green_minutes
- confidence_calibration_gap
