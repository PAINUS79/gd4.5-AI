#!/usr/bin/env python3
"""
Hybrid retrieval for AI tasks: combines indexed memory retrieval + contract evidence snippets.

Usage:
  python tools/rag_context_pack.py \
    --query "jump apex inconsistent" \
    --task-packet res://ai_library/tasks/current_task.yaml \
    --memory-log res://ai_library/docs/memory_log.jsonl \
    --db-path res://ai_library/docs/ai_memory_index.db \
    --out res://ai_library/docs/evidence_packs/current_task.md
"""

from __future__ import annotations

import argparse
import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Tuple

import yaml  # type: ignore

from build_memory_index import ensure_schema, load_jsonl, rebuild_index, resolve_project_path

DOC_CANDIDATES = [
    "res://ai_library/docs/style_guide.md",
    "res://ai_library/docs/api_contracts.md",
    "res://ai_library/docs/scene_contracts.md",
    "res://ai_library/docs/failure_patterns.md",
    "res://ai_library/docs/integration_gate_checklist.md",
    "res://ai_library/docs/patterns.catalog.yaml",
]

FAILURE_TAGS = {
    "input_contract_violation",
    "physics_loop_misuse",
    "move_and_slide_delta_error",
    "scene_contract_break",
    "tight_coupling_parent_chain",
    "patch_scope_violation",
    "no_acceptance_gate",
    "version_drift",
    "silent_dependency_failure",
    "regression_unchecked",
    "performance_regression",
    "serialization_break",
    "nondeterministic_behavior",
    "api_contract_drift",
    "dependency_version_conflict",
    "test_flakiness",
    "content_pipeline_mismatch",
}


def tokenize(query: str) -> List[str]:
    return [tok for tok in re.split(r"[^a-zA-Z0-9_]+", query.lower()) if len(tok) >= 4]


def ensure_index(db_path: Path, memory_log_path: Path) -> None:
    with sqlite3.connect(db_path) as conn:
        ensure_schema(conn)
        count = conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
        if count == 0:
            rebuild_index(load_jsonl(memory_log_path), conn)
            conn.commit()


def query_memory(conn: sqlite3.Connection, query: str, top_k: int) -> List[Tuple[Any, ...]]:
    clean_tokens = tokenize(query)
    if not clean_tokens:
        return []

    fts_query = " OR ".join(f"{tok}*" for tok in clean_tokens)
    sql = """
        SELECT m.memory_id, m.task_id, m.feature, m.outcome, m.confidence, m.fix_summary,
               bm25(memory_fts) AS score
        FROM memory_fts
        JOIN memories m ON m.memory_id = memory_fts.memory_id
        WHERE memory_fts MATCH ?
        ORDER BY score ASC
        LIMIT ?
    """
    return conn.execute(sql, (fts_query, top_k)).fetchall()


def query_tags(conn: sqlite3.Connection, query: str, top_k: int) -> List[Tuple[Any, ...]]:
    requested = [tag for tag in FAILURE_TAGS if tag in query]
    if not requested:
        return []

    placeholders = ",".join("?" for _ in requested)
    sql = f"""
        SELECT m.memory_id, m.task_id, m.feature, t.failure_tag
        FROM memory_failure_tags t
        JOIN memories m ON m.memory_id = t.memory_id
        WHERE t.failure_tag IN ({placeholders})
        ORDER BY m.memory_id DESC
        LIMIT ?
    """
    return conn.execute(sql, (*requested, top_k)).fetchall()


def load_task_packet(path: Path | None) -> Dict[str, Any]:
    if path is None or not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return data if isinstance(data, dict) else {}


def extract_task_links(task_packet: Dict[str, Any]) -> Tuple[str, List[str], List[str]]:
    task = task_packet.get("task", {}) if isinstance(task_packet.get("task"), dict) else {}
    task_id = str(task.get("task_id", ""))
    dep_tasks = task.get("depends_on_task_ids", [])
    dep_contracts = task.get("depends_on_contract_ids", [])
    dep_tasks = [str(item) for item in dep_tasks] if isinstance(dep_tasks, list) else []
    dep_contracts = [str(item) for item in dep_contracts] if isinstance(dep_contracts, list) else []
    return task_id, dep_tasks, dep_contracts


def pull_contract_evidence(query: str, top_k: int = 8) -> List[Tuple[str, str]]:
    terms = tokenize(query)
    if not terms:
        return []

    scored: List[Tuple[int, str, str]] = []
    for doc in DOC_CANDIDATES:
        path = resolve_project_path(doc)
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        lines = content.splitlines()
        for idx, line in enumerate(lines, start=1):
            text = line.lower()
            score = sum(1 for term in terms if term in text)
            if score > 0:
                snippet = line.strip()
                if not snippet:
                    continue
                scored.append((score, str(path), f"L{idx}: {snippet}"))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [(path, snippet) for _, path, snippet in scored[:top_k]]


def build_output(
    query: str,
    task_id: str,
    memory_hits: List[Tuple[Any, ...]],
    tag_hits: List[Tuple[Any, ...]],
    contract_hits: List[Tuple[str, str]],
    dep_tasks: List[str],
    dep_contracts: List[str],
) -> str:
    lines: List[str] = []
    lines.append("# Evidence Context Pack")
    lines.append("")
    lines.append(f"- Query: {query}")
    lines.append(f"- Task ID: {task_id or 'N/A'}")
    lines.append(f"- Dependent Task IDs: {', '.join(dep_tasks) if dep_tasks else 'None'}")
    lines.append(f"- Dependent Contract IDs: {', '.join(dep_contracts) if dep_contracts else 'None'}")
    lines.append("")

    lines.append("## Memory Matches")
    if not memory_hits:
        lines.append("- No semantic memory matches found.")
    else:
        for memory_id, hit_task_id, feature, outcome, confidence, fix_summary, score in memory_hits:
            lines.append(
                f"- [{memory_id}] task={hit_task_id} outcome={outcome} confidence={confidence:.2f} score={score:.3f} | {feature} | fix={fix_summary}"
            )
    lines.append("")

    lines.append("## Failure Tag Matches")
    if not tag_hits:
        lines.append("- No explicit failure-tag matches in query.")
    else:
        for memory_id, hit_task_id, feature, tag in tag_hits:
            lines.append(f"- [{memory_id}] task={hit_task_id} tag={tag} | {feature}")
    lines.append("")

    lines.append("## Contract and Pattern Evidence")
    if not contract_hits:
        lines.append("- No contract snippets matched query terms.")
    else:
        for path, snippet in contract_hits:
            lines.append(f"- {path} :: {snippet}")

    lines.append("")
    lines.append("## Recommended Focus")
    lines.append("- Prioritize fixes supported by both memory hits and contract evidence.")
    lines.append("- If risk_tier is high/systemic, require manual review before merge.")
    lines.append("- Append reflection with calibrated confidence after verification.")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate hybrid-RAG evidence pack for AI task execution.")
    parser.add_argument("--query", required=True, help="Issue/problem query text")
    parser.add_argument("--task-packet", help="Path to task packet YAML")
    parser.add_argument("--memory-log", required=True, help="Path to memory_log.jsonl")
    parser.add_argument("--db-path", required=True, help="Path to SQLite memory index")
    parser.add_argument("--out", help="Output markdown file path")
    parser.add_argument("--top-k", type=int, default=8, help="Top-K memory snippets")
    args = parser.parse_args()

    memory_log_path = resolve_project_path(args.memory_log)
    db_path = resolve_project_path(args.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    ensure_index(db_path, memory_log_path)

    task_packet_path = resolve_project_path(args.task_packet) if args.task_packet else None
    task_packet = load_task_packet(task_packet_path)
    task_id, dep_tasks, dep_contracts = extract_task_links(task_packet)

    with sqlite3.connect(db_path) as conn:
        memory_hits = query_memory(conn, args.query, args.top_k)
        tag_hits = query_tags(conn, args.query.lower(), args.top_k)

    contract_hits = pull_contract_evidence(args.query, top_k=args.top_k)

    report = build_output(
        query=args.query,
        task_id=task_id,
        memory_hits=memory_hits,
        tag_hits=tag_hits,
        contract_hits=contract_hits,
        dep_tasks=dep_tasks,
        dep_contracts=dep_contracts,
    )

    if args.out:
        out_path = resolve_project_path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report, encoding="utf-8")
        print(f"[RAG][PASS] Evidence pack written: {out_path}")
    else:
        print(report)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
