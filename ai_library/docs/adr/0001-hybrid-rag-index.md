# ADR 0001: Hybrid Retrieval Index for AI Task Memory

## Status
Accepted

## Context
Memory logs are append-only JSONL and become difficult to retrieve effectively at scale.
Pure semantic retrieval is insufficient for hard filters like failure tags, contract IDs, and task dependencies.

## Decision
Adopt Option 2 (Hybrid indexed retrieval):
- Keep JSONL as source-of-truth
- Build a local SQLite index for structured filters + FTS
- Generate per-task evidence packs with hybrid retrieval

## Alternatives Considered
1. JSONL-only retrieval: fast start, weak scale/precision
2. Full orchestration service: strongest scale, too much early overhead

## Consequences
### Positive
- Better evidence quality for task execution
- Faster retrieval for tags/contracts/task lineage
- Minimal infra cost

### Trade-offs
- Requires index refresh process
- Adds one local DB artifact

## Revisit Conditions
- Move to service-based orchestration when parallel lanes and data volume exceed local-index reliability.
