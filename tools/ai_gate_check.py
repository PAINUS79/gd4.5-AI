#!/usr/bin/env python3
"""
AI Gate Check
Fails if:
1) Task packet missing assumptions
2) Task packet missing acceptance checks
3) memory_log.jsonl missing entry for task_id
4) Memory entry missing critical fields

Usage:
  python tools/ai_gate_check.py \
    --task-packet res://ai_library/tasks/current_task.yaml \
    --memory-log res://ai_library/docs/memory_log.jsonl

Exit code:
  0 = pass
  1 = fail
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

try:
    import yaml  # type: ignore
except Exception as exc:  # pragma: no cover
    print("ERROR: PyYAML is required. Install with: pip install pyyaml")
    raise


REQUIRED_MEMORY_FIELDS = [
    "memory_id",
    "timestamp_utc",
    "task_id",
    "feature",
    "expected_behavior",
    "actual_behavior",
    "assumptions",
    "files_touched",
    "acceptance_checks",
    "outcome",
    "confidence",
    "confidence_calibrated",
    "failure_tags",
    "pattern_ids_used",
    "contract_ids_touched",
    "fix_summary",
    "repair_strategy",
    "prevention_updates",
    "time_to_green_minutes",
    "reusability_score",
    "engine_version",
    "agent_role",
]

ALLOWED_FAILURE_TAGS = {
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


def fail(msg: str) -> None:
    print(f"[AI-GATE][FAIL] {msg}")


def ok(msg: str) -> None:
    print(f"[AI-GATE][PASS] {msg}")


def resolve_project_path(raw_path: str) -> Path:
    input_path = raw_path.strip()
    if input_path.startswith("res://"):
        project_root = Path(__file__).resolve().parents[1]
        relative = input_path[len("res://"):]
        return project_root / relative
    return Path(input_path)


def load_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Task packet not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError("Task packet must be a YAML object")
    return data


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Memory log not found: {path}")
    entries: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSONL at line {i}: {e}") from e
            if not isinstance(obj, dict):
                raise ValueError(f"JSONL line {i} is not an object")
            entries.append(obj)
    return entries


def get_task_id(task_packet: Dict[str, Any]) -> str:
    task = task_packet.get("task")
    if not isinstance(task, dict):
        raise ValueError("Task packet missing 'task' object")
    task_id = task.get("task_id")
    if not isinstance(task_id, str) or not task_id.strip():
        raise ValueError("Task packet missing non-empty task.task_id")
    return task_id.strip()


def _validate_named_checks(checks: Any, section: str, errors: List[str]) -> int:
    if not isinstance(checks, list) or len(checks) == 0:
        errors.append(f"Task packet must include non-empty '{section}' list.")
        return 0

    valid_count = 0
    for idx, check in enumerate(checks):
        if not isinstance(check, dict):
            errors.append(f"{section}[{idx}] must be an object.")
            continue
        for field in ("id", "name", "expected"):
            value = check.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{section}[{idx}] missing non-empty '{field}'.")
        valid_count += 1
    return valid_count


def validate_task_packet(task_packet: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    task = task_packet.get("task")
    if not isinstance(task, dict):
        errors.append("Task packet must include 'task' object.")
    else:
        for field in ("risk_tier", "blast_radius", "max_files_changed", "max_lines_changed"):
            if field not in task:
                errors.append(f"Task packet task missing '{field}'.")
        if isinstance(task.get("max_files_changed"), int) and task["max_files_changed"] <= 0:
            errors.append("task.max_files_changed must be > 0.")
        if isinstance(task.get("max_lines_changed"), int) and task["max_lines_changed"] <= 0:
            errors.append("task.max_lines_changed must be > 0.")

    verification_notes = task_packet.get("verification_notes")
    if not isinstance(verification_notes, dict):
        errors.append("Task packet must include 'verification_notes' object.")
    else:
        for note_field in ("plan_note", "risk_note", "verification_note"):
            value = verification_notes.get(note_field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"verification_notes missing non-empty '{note_field}'.")

    assumptions = task_packet.get("assumptions")
    if not isinstance(assumptions, list) or len(assumptions) == 0:
        errors.append("Task packet must include non-empty 'assumptions' list.")

    acceptance_checks = task_packet.get("acceptance_checks")
    if not isinstance(acceptance_checks, dict):
        errors.append("Task packet must include structured 'acceptance_checks' object.")
    else:
        _validate_named_checks(acceptance_checks.get("automated_required"), "acceptance_checks.automated_required", errors)

    regression_checks = task_packet.get("regression_checks")
    if not isinstance(regression_checks, dict):
        errors.append("Task packet must include structured 'regression_checks' object.")
    else:
        _validate_named_checks(regression_checks.get("automated_required"), "regression_checks.automated_required", errors)

    dod_checks = task_packet.get("dod_checks")
    if not isinstance(dod_checks, list) or len(dod_checks) == 0:
        errors.append("Task packet must include non-empty 'dod_checks' list.")

    return errors


def validate_memory_entry(entry: Dict[str, Any], task_id: str) -> List[str]:
    errors: List[str] = []

    for field in REQUIRED_MEMORY_FIELDS:
        if field not in entry:
            errors.append(f"Memory entry missing field: '{field}'")

    if entry.get("task_id") != task_id:
        errors.append(
            f"Memory entry task_id '{entry.get('task_id')}' does not match task packet task_id '{task_id}'"
        )

    assumptions = entry.get("assumptions")
    if not isinstance(assumptions, list) or len(assumptions) == 0:
        errors.append("Memory entry must include non-empty 'assumptions' list.")

    acceptance_checks = entry.get("acceptance_checks")
    if not isinstance(acceptance_checks, list) or len(acceptance_checks) == 0:
        errors.append("Memory entry must include non-empty 'acceptance_checks' list.")

    failure_tags = entry.get("failure_tags")
    if not isinstance(failure_tags, list):
        errors.append("Memory entry must include 'failure_tags' list.")
    else:
        invalid = [tag for tag in failure_tags if tag not in ALLOWED_FAILURE_TAGS]
        if invalid:
            errors.append(f"Memory entry has invalid failure_tags: {', '.join(invalid)}")

    files_touched = entry.get("files_touched")
    if not isinstance(files_touched, list) or len(files_touched) == 0:
        errors.append("Memory entry must include non-empty 'files_touched' list.")

    return errors


def find_latest_memory_entry(entries: List[Dict[str, Any]], task_id: str) -> Dict[str, Any] | None:
    matches = [e for e in entries if e.get("task_id") == task_id]
    return matches[-1] if matches else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate AI task packet and memory log linkage.")
    parser.add_argument("--task-packet", required=True, help="Path to task packet YAML")
    parser.add_argument("--memory-log", required=True, help="Path to memory_log.jsonl")
    args = parser.parse_args()

    task_packet_path = resolve_project_path(args.task_packet)
    memory_log_path = resolve_project_path(args.memory_log)

    failed = False

    try:
        task_packet = load_yaml(task_packet_path)
        task_id = get_task_id(task_packet)
        ok(f"Loaded task packet: {task_packet_path}")
        ok(f"Task ID: {task_id}")
    except Exception as e:
        fail(str(e))
        return 1

    task_errors = validate_task_packet(task_packet)
    if task_errors:
        failed = True
        for err in task_errors:
            fail(err)
    else:
        ok("Task packet contains assumptions and acceptance checks.")

    try:
        entries = load_jsonl(memory_log_path)
        ok(f"Loaded memory log entries: {len(entries)}")
    except Exception as e:
        fail(str(e))
        return 1

    entry = find_latest_memory_entry(entries, task_id)
    if entry is None:
        fail(f"No memory_log.jsonl entry found for task_id '{task_id}'")
        return 1

    mem_errors = validate_memory_entry(entry, task_id)
    if mem_errors:
        failed = True
        for err in mem_errors:
            fail(err)
    else:
        ok("Memory log entry exists and passes required field checks.")

    if failed:
        fail("AI gate failed.")
        return 1

    ok("AI gate passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
