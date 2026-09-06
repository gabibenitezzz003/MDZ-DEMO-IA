#!/usr/bin/env bash
# Despliegue del demo en el server. Pensado para correr EN el server:
#
#   bash deploy-prod.sh            # actualiza, buildea y levanta
#   PASO=1 bash deploy-prod.sh     # sólo diagnostica, no toca nada
#
# Se detiene ante cualquier sorpresa en vez de seguir y romper algo. Los
# cambios locales sin commitear se guardan SIEMPRE en un parche antes de tocar
# nada, así que no hay forma de perderlos.
set -uo pipefail

APP_DIR="${APP_DIR:-$HOME/demo-gob/MDZ-DEMO-IA}"
SOLO_DIAGNOSTICO="${PASO:-0}"
SELLO=$(date +%Y%m%d-%H%M%S)
RESPALDO="$HOME/deploy-backups"

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
paso()  { printf '\n\033[1m── %s ──\033[0m\n' "$*"; }
morir() { rojo "✗ $*"; exit 1; }

[ -d "$APP_DIR/.git" ] || morir "No hay repo en $APP_DIR. Pasá APP_DIR=/ruta"
cd "$APP_DIR" || morir "no pude entrar a $APP_DIR"

paso "Dónde estamos"
echo "repo:   $APP_DIR"
echo "rama:   $(git rev-parse --abbrev-ref HEAD)"
echo "commit: $(git log --oneline -1)"

paso "Cambios locales sin commitear"
SUCIO=$(git status --porcelain)
if [ -n "$SUCIO" ]; then
  mkdir -p "$RESPALDO"
  PARCHE="$RESPALDO/local-$SELLO.patch"
  SUELTOS="$RESPALDO/sin-trackear-$SELLO.tar.gz"
  git status --short

  # Los rastreados van al parche…
  git diff HEAD > "$PARCHE"
  verde "→ modificados: $PARCHE"
  echo "   (recuperar con: git apply $PARCHE)"

  # …y los sin trackear aparte, porque `git diff` no los ve y el stash -u de
  # más abajo sí se los lleva: sin esto quedarían sólo dentro del stash.
  NUEVOS=$(git ls-files --others --exclude-standard)
  if [ -n "$NUEVOS" ]; then
    printf '%s\n' "$NUEVOS" | tar czf "$SUELTOS" -T - 2>/dev/null \
      && verde "→ sin trackear: $SUELTOS" \
      || rojo "  no pude respaldar los archivos sin trackear"
  fi
else
  echo "(limpio)"
fi

paso "Qué falta traer"
git fetch origin --quiet || morir "no pude hacer fetch"
FALTAN=$(git rev-list --count HEAD..origin/main)
echo "commits detrás de origin/main: $FALTAN"
[ "$FALTAN" -gt 0 ] && git log --oneline HEAD..origin/main | head -10

paso "Puerto publicado"
# Se lee del compose y no se asume 3000: en este server el 3000 lo tiene
# cima-ai-dev-app-1, y por eso el demo está publicado en 3100.
PUERTO=$(grep -oE '127\.0\.0\.1:[0-9]+:3000' docker-compose.yml | head -1 | cut -d: -f2)
PUERTO="${PUERTO:-3000}"
echo "el compose publica en 127.0.0.1:$PUERTO"
QUIEN=$(docker ps --filter "publish=$PUERTO" --format '{{.Names}}' 2>/dev/null | head -1)
if [ -n "$QUIEN" ]; then
  case "$QUIEN" in
    *demo*) verde "→ lo tiene $QUIEN, que es el propio demo: el up lo reemplaza";;
    *) rojo "→ el puerto $PUERTO lo tiene OTRO contenedor: $QUIEN"
       rojo "   el 'docker compose up' va a fallar. Cambiá el puerto antes de seguir.";;
  esac
elif (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -qE ":$PUERTO\b"; then
  rojo "→ hay algo en $PUERTO que no es un contenedor. Revisalo: el up va a fallar."
else
  echo "(libre)"
fi

paso "Configuración"
[ -f .env.production ] || rojo "✗ falta .env.production — el compose lo necesita (env_file)"
# El compose inyecta N8N_WEBHOOK_URL y SPEACHES_URL, así que no hace falta que
# estén en .env.production. Lo que sí importa es que apunten a algo vivo.
if [ -f .env.production ]; then
  grep -q '^USE_N8N_AS_BRAIN=true' .env.production \
    && echo "USE_N8N_AS_BRAIN=true → el compose apunta a ${N8N_DOCKER_WEBHOOK_URL:-http://host.docker.internal:5678/webhook/demo-agricultura}" \
    || echo "USE_N8N_AS_BRAIN no está en true → cerebro local, n8n no se usa"
fi

if [ "$SOLO_DIAGNOSTICO" = "1" ]; then
  paso "Modo diagnóstico"
  echo "No toqué nada. Sacá PASO=1 para desplegar."
  exit 0
fi

paso "Actualizando el código"
if [ -n "$SUCIO" ]; then
  git stash push -u -m "pre-deploy-$SELLO" >/dev/null || morir "no pude guardar los cambios locales"
  verde "→ cambios locales guardados en stash pre-deploy-$SELLO"
fi

if ! git merge --ff-only origin/main; then
  rojo "✗ no se puede avanzar en fast-forward: la rama del server divergió."
  rojo "  Nada quedó a medias. Revisá con: git log --oneline HEAD..origin/main"
  [ -n "$SUCIO" ] && git stash pop >/dev/null 2>&1
  exit 1
fi
verde "→ ahora en $(git log --oneline -1)"

if [ -n "$SUCIO" ]; then
  paso "Reaplicando los cambios locales"
  if git stash pop; then
    verde "→ reaplicados sin conflicto"
  else
    rojo "✗ CONFLICTO al reaplicar los cambios locales."
    rojo "  El código ya está actualizado, pero NO buildeo con conflictos a medio resolver."
    rojo "  Resolvé los archivos marcados y volvé a correr el script."
    rojo "  El respaldo intacto está en $RESPALDO/local-$SELLO.patch"
    exit 1
  fi
fi

paso "Build y arranque"
command -v docker >/dev/null || morir "no hay docker"
DC="docker compose"; docker compose version >/dev/null 2>&1 || DC="docker-compose"
$DC build --pull || morir "falló el build"
$DC up -d || morir "falló el up"

paso "Verificación"
sleep 5
$DC ps
for intento in 1 2 3 4 5 6; do
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:3000/ 2>/dev/null)
  [ "$CODIGO" != "000" ] && [ -n "$CODIGO" ] && break
  sleep 3
done
if [ "${CODIGO:-000}" != "000" ] && [ -n "${CODIGO:-}" ]; then
  verde "✓ responde en 127.0.0.1:3000 → HTTP $CODIGO"
else
  rojo "✗ no responde. Mirá los logs:  $DC logs --tail 50"
  exit 1
fi

paso "Listo"
echo "commit desplegado: $(git log --oneline -1)"
echo "respaldos en:      $RESPALDO"
