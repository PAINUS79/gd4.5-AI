#!/usr/bin/env python3
"""
Generate a daily metrics report from memory_log.jsonl.

Usage:
  python tools/generate_daily_report.py \
    --memory-log res://ai_library/docs/memory_log.jsonl \
    --date 2026-02-16 \
    --out res://ai_library/docs/reports/daily_metrics_2026-02-16.md
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def resolve_project_path(raw_path: str) -> Path:
    value = raw_path.strip()
    if value.startswith("res://"):
        project_root = Path(__file__).resolve().parents[1]
        return project_root / value[len("res://"):]
    return Path(value)


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Memory log not found: {path}")

    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            text = line.strip()
            if not text:
                continue
            obj = json.loads(text)
            if not isinstance(obj, dict):
                raise ValueError(f"Line {line_no} is not an object")
            rows.append(obj)
    return rows


def parse_date(ts: str) -> str:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return ""


def summarize(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    outcomes = Counter(str(e.get("outcome", "unknown")) for e in entries)
    tag_counter: Counter[str] = Counter()
    subsystem_counter: Counter[str] = Counter()

    confidence_vals: List[float] = []
    calibrated_vals: List[float] = []
    time_to_green_vals: List[float] = []

    for entry in entries:
        for tag in entry.get("failure_tags", []):
            tag_counter[str(tag)] += 1

        for file_path in entry.get("files_touched", []):
            path = str(file_path)
            marker = "systems/"
            if marker in path:
                subsystem = path.split(marker, maxsplit=1)[1].split("/", maxsplit=1)[0]
                subsystem_counter[subsystem] += 1

        if isinstance(entry.get("confidence"), (int, float)):
            confidence_vals.append(float(entry["confidence"]))
        if isinstance(entry.get("confidence_calibrated"), (int, float)):
            calibrated_vals.append(float(entry["confidence_calibrated"]))
        if isinstance(entry.get("time_to_green_minutes"), (int, float)):
            time_to_green_vals.append(float(entry["time_to_green_minutes"]))

    def avg(values: List[float]) -> float:
        return sum(values) / len(values) if values else 0.0

    return {
        "total": len(entries),
        "outcomes": outcomes,
        "top_tags": tag_counter.most_common(5),
        "top_subsystems": subsystem_counter.most_common(5),
        "avg_confidence": avg(confidence_vals),
        "avg_calibrated": avg(calibrated_vals),
        "avg_time_to_green": avg(time_to_green_vals),
    }


def build_markdown(date_str: str, summary: Dict[str, Any], entries: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    lines.append(f"# Daily AI Metrics Report - {date_str}")
    lines.append("")
    lines.append("## Snapshot")
    lines.append(f"- Total task reflections: {summary['total']}")
    lines.append(f"- Avg confidence: {summary['avg_confidence']:.2f}")
    lines.append(f"- Avg calibrated confidence: {summary['avg_calibrated']:.2f}")
    lines.append(f"- Avg time-to-green (min): {summary['avg_time_to_green']:.1f}")
    lines.append("")

    lines.append("## Outcome Distribution")
    for name, count in summary["outcomes"].items():
        lines.append(f"- {name}: {count}")
    lines.append("")

    lines.append("## Top Failure Tags")
    if summary["top_tags"]:
        for tag, count in summary["top_tags"]:
            lines.append(f"- {tag}: {count}")
    else:
        lines.append("- None")
    lines.append("")

    lines.append("## Most-Touched Subsystems")
    if summary["top_subsystems"]:
        for subsystem, count in summary["top_subsystems"]:
            lines.append(f"- {subsystem}: {count}")
    else:
        lines.append("- None")
    lines.append("")

    lines.append("## Task Rows")
    for entry in entries:
        lines.append(
            f"- {entry.get('task_id', 'N/A')} | {entry.get('feature', 'N/A')} | outcome={entry.get('outcome', 'N/A')} | confidence={entry.get('confidence', 'N/A')}"
        )

    lines.append("")
    lines.append("## Notes")
    lines.append("- Use this report to drive top-3 failure-tag weekly prevention actions.")
    lines.append("- Compare confidence vs calibrated confidence to detect overconfidence drift.")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate daily AI quality metrics report from memory log.")
    parser.add_argument("--memory-log", required=True, help="Path to memory_log.jsonl")
    parser.add_argument("--date", help="Date in YYYY-MM-DD (UTC). Defaults to today UTC")
    parser.add_argument("--out", help="Output markdown path")
    args = parser.parse_args()

    memory_log_path = resolve_project_path(args.memory_log)
    target_date = args.date or datetime.now(timezone.utc).date().isoformat()

    all_entries = load_jsonl(memory_log_path)
    entries = [entry for entry in all_entries if parse_date(str(entry.get("timestamp_utc", ""))) == target_date]

    summary = summarize(entries)
    markdown = build_markdown(target_date, summary, entries)

    output_path = resolve_project_path(args.out) if args.out else resolve_project_path(
        f"res://ai_library/docs/reports/daily_metrics_{target_date}.md"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")

    print(f"[REPORT][PASS] Date: {target_date}")
    print(f"[REPORT][PASS] Entries: {len(entries)}")
    print(f"[REPORT][PASS] Output: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
