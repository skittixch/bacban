#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
script_path="$script_dir/write-agent-ledger-event.mjs"

if command -v cygpath >/dev/null 2>&1; then
  script_path="$(cygpath -w "$script_path")"
fi

exec node "$script_path" "$@"
