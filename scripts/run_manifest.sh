#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

if [[ $# -lt 1 ]]; then
  echo "Usage: run_manifest.sh <npm_script> [-- <extra args...>]"
  exit 2
fi

NPM_SCRIPT="$1"
shift || true

if command -v npm >/dev/null 2>&1; then
  npm run "$NPM_SCRIPT" -- "$@"
elif command -v corepack >/dev/null 2>&1; then
  corepack npm run "$NPM_SCRIPT" -- "$@"
else
  echo "ERROR: npm not found in PATH and corepack unavailable."
  exit 127
fi
