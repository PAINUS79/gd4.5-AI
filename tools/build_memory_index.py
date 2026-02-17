#!/usr/bin/env python3
"""
Builds a lightweight SQLite index from ai_library/docs/memory_log.jsonl.

Usage:
  python tools/build_memory_index.py \
    --memory-log res://ai_library/docs/memory_log.jsonl \
    --db-path res://ai_library/docs/ai_memory_index.db
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List


def resolve_project_path(raw_path: str) -> Path:
    value = raw_path.strip()
    if value.startswith("res://"):
        project_root = Path(__file__).resolve().parents[1]
        return project_root / value[len("res://"):]
    return Path(value)


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    if not path.exists():
        raise FileNotFoundError(f"Memory log not found: {path}")

    with path.open("r", encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            text = line.strip()
            if not text:
                continue
            try:
                obj = json.loads(text)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON at line {line_no}: {exc}") from exc
            if not isinstance(obj, dict):
                raise ValueError(f"Line {line_no} is not a JSON object")
            entries.append(obj)
    return entries


def _join_text(value: Any) -> str:
    if isinstance(value, list):
        return " | ".join(str(item) for item in value)
    return str(value) if value is not None else ""


def _iter_tags(entry: Dict[str, Any]) -> Iterable[str]:
    tags = entry.get("failure_tags", [])
    if not isinstance(tags, list):
        return []
    return [str(tag) for tag in tags]


def _iter_strings(entry: Dict[str, Any], field: str) -> Iterable[str]:
    values = entry.get(field, [])
    if not isinstance(values, list):
        return []
    return [str(item) for item in values]


def ensure_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS memories (
            memory_id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            feature TEXT,
            agent_role TEXT,
            engine_version TEXT,
            outcome TEXT,
            confidence REAL,
            confidence_calibrated REAL,
            root_cause TEXT,
            fix_summary TEXT,
            repair_strategy TEXT,
            notes TEXT,
            files_touched_json TEXT,
            assumptions_json TEXT,
            prevention_updates_json TEXT,
            raw_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS memory_failure_tags (
            memory_id TEXT NOT NULL,
            failure_tag TEXT NOT NULL,
            PRIMARY KEY (memory_id, failure_tag),
            FOREIGN KEY (memory_id) REFERENCES memories(memory_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS memory_contract_ids (
            memory_id TEXT NOT NULL,
            contract_id TEXT NOT NULL,
            PRIMARY KEY (memory_id, contract_id),
            FOREIGN KEY (memory_id) REFERENCES memories(memory_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS memory_pattern_ids (
            memory_id TEXT NOT NULL,
            pattern_id TEXT NOT NULL,
            PRIMARY KEY (memory_id, pattern_id),
            FOREIGN KEY (memory_id) REFERENCES memories(memory_id) ON DELETE CASCADE
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
            memory_id UNINDEXED,
            task_id,
            feature,
            expected_behavior,
            actual_behavior,
            fix_summary,
            notes,
            assumptions,
            prevention_updates
        );

        CREATE INDEX IF NOT EXISTS idx_memories_task_id ON memories(task_id);
        CREATE INDEX IF NOT EXISTS idx_memories_outcome ON memories(outcome);
        CREATE INDEX IF NOT EXISTS idx_failure_tag ON memory_failure_tags(failure_tag);
        CREATE INDEX IF NOT EXISTS idx_contract_id ON memory_contract_ids(contract_id);
        CREATE INDEX IF NOT EXISTS idx_pattern_id ON memory_pattern_ids(pattern_id);
        """
    )


def rebuild_index(entries: List[Dict[str, Any]], connection: sqlite3.Connection) -> None:
    connection.execute("DELETE FROM memory_failure_tags")
    connection.execute("DELETE FROM memory_contract_ids")
    connection.execute("DELETE FROM memory_pattern_ids")
    connection.execute("DELETE FROM memory_fts")
    connection.execute("DELETE FROM memories")

    for idx, entry in enumerate(entries, start=1):
        memory_id = str(entry.get("memory_id") or f"MEM-AUTO-{idx:06d}")
        task_id = str(entry.get("task_id") or "")

        connection.execute(
            """
            INSERT INTO memories (
                memory_id, task_id, feature, agent_role, engine_version,
                outcome, confidence, confidence_calibrated, root_cause,
                fix_summary, repair_strategy, notes,
                files_touched_json, assumptions_json, prevention_updates_json, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                memory_id,
                task_id,
                str(entry.get("feature", "")),
                str(entry.get("agent_role", "")),
                str(entry.get("engine_version", "")),
                str(entry.get("outcome", "")),
                float(entry.get("confidence", 0.0) or 0.0),
                float(entry.get("confidence_calibrated", 0.0) or 0.0),
                str(entry.get("root_cause", "")),
                str(entry.get("fix_summary", "")),
                str(entry.get("repair_strategy", "")),
                str(entry.get("notes", "")),
                json.dumps(entry.get("files_touched", []), ensure_ascii=False),
                json.dumps(entry.get("assumptions", []), ensure_ascii=False),
                json.dumps(entry.get("prevention_updates", []), ensure_ascii=False),
                json.dumps(entry, ensure_ascii=False),
            ),
        )

        connection.execute(
            """
            INSERT INTO memory_fts (
                memory_id, task_id, feature, expected_behavior, actual_behavior,
                fix_summary, notes, assumptions, prevention_updates
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                memory_id,
                task_id,
                str(entry.get("feature", "")),
                str(entry.get("expected_behavior", "")),
                str(entry.get("actual_behavior", "")),
                str(entry.get("fix_summary", "")),
                str(entry.get("notes", "")),
                _join_text(entry.get("assumptions", [])),
                _join_text(entry.get("prevention_updates", [])),
            ),
        )

        for tag in _iter_tags(entry):
            connection.execute(
                "INSERT OR IGNORE INTO memory_failure_tags (memory_id, failure_tag) VALUES (?, ?)",
                (memory_id, tag),
            )

        for contract_id in _iter_strings(entry, "contract_ids_touched"):
            connection.execute(
                "INSERT OR IGNORE INTO memory_contract_ids (memory_id, contract_id) VALUES (?, ?)",
                (memory_id, contract_id),
            )

        for pattern_id in _iter_strings(entry, "pattern_ids_used"):
            connection.execute(
                "INSERT OR IGNORE INTO memory_pattern_ids (memory_id, pattern_id) VALUES (?, ?)",
                (memory_id, pattern_id),
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Build memory retrieval index from JSONL source of truth.")
    parser.add_argument("--memory-log", required=True, help="Path to memory_log.jsonl")
    parser.add_argument("--db-path", required=True, help="Path to SQLite output")
    args = parser.parse_args()

    memory_log_path = resolve_project_path(args.memory_log)
    db_path = resolve_project_path(args.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    entries = load_jsonl(memory_log_path)

    with sqlite3.connect(db_path) as conn:
        ensure_schema(conn)
        rebuild_index(entries, conn)
        conn.commit()

        count = conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
        tags = conn.execute("SELECT COUNT(*) FROM memory_failure_tags").fetchone()[0]

    print(f"[INDEX][PASS] Indexed memories: {count}")
    print(f"[INDEX][PASS] Indexed failure tags: {tags}")
    print(f"[INDEX][PASS] Database: {db_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
