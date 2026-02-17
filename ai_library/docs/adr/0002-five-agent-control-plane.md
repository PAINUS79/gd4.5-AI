# ADR 0002: Five-Agent Core + Supervisor DAG

## Status
Accepted

## Context
Single-agent workflows increase prompt bloat, reduce role clarity, and make gate enforcement inconsistent.

## Decision
Adopt a five-agent core (Planner, Implementer, Verifier, Reviewer, Reflector) under a Supervisor + DAG scheduler.

## Alternatives considered
- Single generalist agent
- Unbounded autonomous swarm

## Consequences
- Better reliability through role specialization.
- Slight orchestration overhead offset by lower rework and cleaner merges.
- Requires strict task packet and gate discipline.

## Revisit conditions
- If first-pass acceptance drops below 60% for two consecutive milestones.
- If repair attempts exceed 2.0 average for three weekly windows.
- If orchestration overhead causes cycle-time regression >20%.
