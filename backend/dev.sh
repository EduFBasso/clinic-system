#!/usr/bin/env bash
# dev.sh — Sobe o servidor Django e o loop de lembretes de push em paralelo.
#
# Uso:
#   cd backend
#   bash dev.sh
#
# O loop de lembretes roda send_reminders a cada 60 s (mesmo comportamento
# do cron configurado no Render em produção).
# Em produção NÃO use este script — configure o cron job no Render.

set -euo pipefail

# Garante que estamos na pasta backend
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Loop de lembretes em background ────────────────────────────────────────
reminder_loop() {
    echo "[reminders] Loop iniciado — rodando send_reminders a cada 60 s"
    while true; do
        python manage.py send_reminders 2>&1 | sed 's/^/[reminders] /'
        sleep 60
    done
}

reminder_loop &
REMINDER_PID=$!

# Garante que o loop morre quando este script for encerrado (Ctrl+C)
trap "echo ''; echo '[dev.sh] Encerrando...'; kill $REMINDER_PID 2>/dev/null; exit 0" INT TERM

# ── Servidor Django (foreground) ────────────────────────────────────────────
echo "[server] Iniciando Django em 0.0.0.0:8000"
python manage.py runserver 0.0.0.0:8000

# Se o servidor sair, encerra o loop também
kill "$REMINDER_PID" 2>/dev/null
