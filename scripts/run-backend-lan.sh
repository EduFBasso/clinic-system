#!/usr/bin/env bash
set -euo pipefail

# Run Django backend on LAN (0.0.0.0) and auto-configure ALLOWED_HOSTS/CORS
# for all private IPv4 addresses found on this machine.

PORT="${1:-8000}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
elif [[ -x "$ROOT_DIR/venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/venv/bin/python"
else
  echo "Python virtualenv not found. Expected .venv/bin/python or venv/bin/python" >&2
  exit 1
fi

LAN_IPS=()
while IFS= read -r ip; do
  [[ -n "$ip" ]] && LAN_IPS+=("$ip")
done < <(
  ifconfig | awk '
    /^\tinet / {
      ip=$2
      if (ip ~ /^10\./ || ip ~ /^192\.168\./ || ip ~ /^172\.(1[6-9]|2[0-9]|3[0-1])\./) {
        print ip
      }
    }
  ' | sort -u
)

if [[ "${#LAN_IPS[@]}" -eq 0 ]]; then
  echo "No private LAN IPv4 found. Connect to a network and try again." >&2
  exit 1
fi

ALLOWED_HOSTS="localhost,127.0.0.1"
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"

for ip in "${LAN_IPS[@]}"; do
  ALLOWED_HOSTS+="${ALLOWED_HOSTS:+,}$ip"
  CORS_ORIGINS+="${CORS_ORIGINS:+,}http://$ip:5173"
done

export DJANGO_ALLOWED_HOSTS="$ALLOWED_HOSTS"
export CORS_ALLOWED_ORIGINS="$CORS_ORIGINS"

echo "LAN IPs: ${LAN_IPS[*]}"
echo "DJANGO_ALLOWED_HOSTS=$DJANGO_ALLOWED_HOSTS"
echo "CORS_ALLOWED_ORIGINS=$CORS_ALLOWED_ORIGINS"
echo "Starting Django on 0.0.0.0:$PORT"

cd "$BACKEND_DIR"
exec "$PYTHON_BIN" manage.py runserver "0.0.0.0:$PORT"
