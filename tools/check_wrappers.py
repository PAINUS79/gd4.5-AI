#!/usr/bin/env python3
import platform
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str]) -> int:
    print(f"[wrappers:check] Running: {' '.join(cmd)}")
    completed = subprocess.run(cmd, cwd=ROOT)
    return completed.returncode


def main() -> int:
    system = platform.system().lower()

    checks: list[list[str]] = []
    if "windows" in system:
        checks = [
            ["cmd", "/c", "scripts\\run_manifest.bat", "manifest:validate"],
            ["powershell", "-ExecutionPolicy", "Bypass", "-File", "scripts/run_manifest.ps1", "manifest:validate"],
        ]
    else:
        checks = [
            ["bash", "scripts/run_manifest.sh", "manifest:validate"],
        ]

    for cmd in checks:
        code = run(cmd)
        if code != 0:
            print(f"[wrappers:check] FAIL: exit code {code}")
            return code

    print("[wrappers:check] PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
