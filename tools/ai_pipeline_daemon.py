#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "tools" / ".pipeline_state.json"

WATCH_FILES = [
    "ai_library/tasks/current_task.yaml",
    "ai_library/docs/memory_log.jsonl",
    "src/data/sections_manifest.json",
    "src/data/artifacts_manifest.json",
    "package.json",
]


@dataclass
class CmdResult:
    ok: bool
    code: int
    output: str


def resolve(path: str) -> Path:
    return ROOT / path


def file_fingerprint(path: Path) -> Optional[Tuple[int, int]]:
    if not path.exists() or not path.is_file():
        return None
    stat = path.stat()
    return (stat.st_mtime_ns, stat.st_size)


def snapshot(paths: List[str]) -> Dict[str, Optional[Tuple[int, int]]]:
    snap: Dict[str, Optional[Tuple[int, int]]] = {}
    for rel in paths:
        snap[rel] = file_fingerprint(resolve(rel))
    return snap


def diff_snapshots(old: Dict[str, Optional[Tuple[int, int]]], new: Dict[str, Optional[Tuple[int, int]]]) -> List[str]:
    changed: List[str] = []
    keys = set(old.keys()) | set(new.keys())
    for key in sorted(keys):
        if old.get(key) != new.get(key):
            changed.append(key)
    return changed


def run_cmd(command: str) -> CmdResult:
    proc = subprocess.run(
        command,
        cwd=ROOT,
        shell=True,
        capture_output=True,
        text=True,
    )
    output = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    return CmdResult(ok=proc.returncode == 0, code=proc.returncode, output=output.strip())


def write_state(payload: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def classify_changes(changed: List[str]) -> dict:
    if not changed:
        return {"should_gate": False, "should_brief": False}

    should_gate = any(
        p.endswith("current_task.yaml")
        or p.endswith("memory_log.jsonl")
        or p.endswith("package.json")
        or p.endswith("sections_manifest.json")
        or p.endswith("artifacts_manifest.json")
        for p in changed
    )

    should_brief = any(
        p.endswith("sections_manifest.json")
        or p.endswith("artifacts_manifest.json")
        or p.endswith("current_task.yaml")
        for p in changed
    )

    return {"should_gate": should_gate, "should_brief": should_brief}


def run_pipeline(focus: Optional[str]) -> dict:
    steps = []

    lint = run_cmd("npm run manifest:lint:artifacts")
    steps.append({"name": "manifest:lint:artifacts", "ok": lint.ok, "code": lint.code, "output": lint.output})
    if not lint.ok:
        return {"ok": False, "steps": steps}

    gate = run_cmd(
        "python tools/ai_gate_check.py --task-packet res://ai_library/tasks/current_task.yaml --memory-log res://ai_library/docs/memory_log.jsonl"
    )
    steps.append({"name": "ai_gate_check", "ok": gate.ok, "code": gate.code, "output": gate.output})
    if not gate.ok:
        return {"ok": False, "steps": steps}

    brief_full = run_cmd("npm run manifest:brief:full:artifacts")
    steps.append({"name": "manifest:brief:full:artifacts", "ok": brief_full.ok, "code": brief_full.code, "output": brief_full.output})
    if not brief_full.ok:
        return {"ok": False, "steps": steps}

    if focus:
        brief_focus = run_cmd(
            f"npm run manifest:brief:custom -- --output docs/brief_{focus.replace('.', '_')}.md --focus {focus} --depth 2 --format markdown --with-artifacts src/data/artifacts_manifest.json"
        )
        steps.append({
            "name": f"manifest:brief:custom (focus={focus})",
            "ok": brief_focus.ok,
            "code": brief_focus.code,
            "output": brief_focus.output,
        })
        if not brief_focus.ok:
            return {"ok": False, "steps": steps}

    return {"ok": True, "steps": steps}


def main() -> None:
    parser = argparse.ArgumentParser(description="Background smart runner for AI pipeline checks and briefs.")
    parser.add_argument("--poll-seconds", type=float, default=2.0, help="Polling interval in seconds.")
    parser.add_argument("--debounce-seconds", type=float, default=3.0, help="Debounce interval before a run.")
    parser.add_argument("--focus", type=str, default=None, help="Optional focus section id for a focused brief (e.g. 3.0).")
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit.")
    args = parser.parse_args()

    print("[PIPELINE] Smart daemon starting...")
    print(f"[PIPELINE] Root: {ROOT}")

    prev = snapshot(WATCH_FILES)
    pending_since: Optional[float] = None
    pending_changes: List[str] = []

    def execute(changed: List[str]) -> None:
        decision = classify_changes(changed)
        run_record = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "changed": changed,
            "decision": decision,
            "ok": True,
            "steps": [],
        }

        if not (decision["should_gate"] or decision["should_brief"]):
            print("[PIPELINE] Changes detected, but none require gate/brief actions.")
            write_state(run_record)
            return

        print(f"[PIPELINE] Running intelligent pipeline for changes: {', '.join(changed)}")
        result = run_pipeline(args.focus)
        run_record["ok"] = result["ok"]
        run_record["steps"] = result["steps"]
        write_state(run_record)

        if result["ok"]:
            print("[PIPELINE] ✅ Pipeline run succeeded.")
        else:
            print("[PIPELINE] ❌ Pipeline run failed. See tools/.pipeline_state.json")

    if args.once:
        execute(WATCH_FILES)
        return

    print("[PIPELINE] Watching for changes...")
    try:
        while True:
            time.sleep(args.poll_seconds)
            current = snapshot(WATCH_FILES)
            changed = diff_snapshots(prev, current)
            if changed:
                prev = current
                pending_changes = sorted(set(pending_changes + changed))
                pending_since = time.time()
                print(f"[PIPELINE] Change detected: {', '.join(changed)}")
                continue

            if pending_since is not None and (time.time() - pending_since) >= args.debounce_seconds:
                execute(pending_changes)
                pending_since = None
                pending_changes = []

    except KeyboardInterrupt:
        print("\n[PIPELINE] Stopped by user.")
        sys.exit(0)


if __name__ == "__main__":
    main()
