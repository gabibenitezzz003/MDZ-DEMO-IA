#!/usr/bin/env bash
# Levanta el dev server limpiando procesos viejos de Next que dejan el puerto colgado.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"
LOG="${LOG:-/tmp/demo-agricultura-dev.log}"

echo "→ Matando procesos viejos en :${PORT}…"
pkill -9 -f "next dev -H ${HOST} -p ${PORT}" 2>/dev/null || true
pkill -9 -f "next-server \\(v" 2>/dev/null || true
sleep 1

if ss -ltnp 2>/dev/null | rg -q ":${PORT}\\b"; then
  echo "✗ El puerto ${PORT} sigue ocupado. Probá: ss -ltnp | rg ${PORT}"
  exit 1
fi

echo "→ Iniciando Next.js en http://${HOST}:${PORT} (log: ${LOG})"
cd "$ROOT"
setsid npm run dev -- -H "$HOST" -p "$PORT" >>"$LOG" 2>&1 &

for i in $(seq 1 15); do
  sleep 1
  if curl -sf "http://${HOST}:${PORT}/" >/dev/null 2>&1; then
    echo "✓ Listo: http://${HOST}:${PORT}"
    exit 0
  fi
done

echo "✗ No respondió a tiempo. Ver log: tail -f ${LOG}"
exit 1
