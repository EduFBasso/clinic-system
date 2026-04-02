#!/usr/bin/env bash
set -euo pipefail

# Run Vite frontend on LAN so phones/devices in the same Wi-Fi can open it.

PORT="${1:-5173}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"
exec npm run -w frontend dev -- --host 0.0.0.0 --port "$PORT"
