#!/usr/bin/env bash
# Verifica qué hay desplegado en el server. SÓLO LEE: no instala, no reinicia,
# no escribe nada.
#
#   scp scripts/verificar-prod.sh dev-user@192.168.1.150:/tmp/
#   ssh dev-user@192.168.1.150 'bash /tmp/verificar-prod.sh'
#
# Si el repo no está en la ruta por defecto:
#   ssh … 'APP_DIR=/ruta/al/repo bash /tmp/verificar-prod.sh'

APP_DIR="${APP_DIR:-}"
ESPERADO="${ESPERADO:-b783155}"   # HEAD de origin/main al momento de escribir esto

echo "═══ host ═══"
hostname; uname -sr; date

echo
echo "═══ dónde está la app ═══"
if [[ -z "$APP_DIR" ]]; then
  # Busca un repo con el package.json del demo, sin recorrer todo el disco.
  APP_DIR=$(find /home /opt /srv /var/www -maxdepth 6 -name package.json \
              -not -path '*/node_modules/*' 2>/dev/null \
            | xargs grep -l '"demo-agricultura"' 2>/dev/null | head -1 | xargs dirname)
fi
if [[ -z "$APP_DIR" || ! -d "$APP_DIR" ]]; then
  echo "No encontré el repo. Pasá la ruta:  APP_DIR=/ruta bash $0"
  exit 1
fi
echo "APP_DIR=$APP_DIR"

echo
echo "═══ commit desplegado ═══"
git -C "$APP_DIR" log --oneline -1 2>/dev/null || echo "(no es un repo git)"
echo "rama:     $(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)"
echo "esperado: $ESPERADO (origin/main)"
ACTUAL=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null)
[[ "$ACTUAL" == "$ESPERADO"* ]] && echo "→ COINCIDE con main" || echo "→ NO coincide: prod está en $ACTUAL"

echo
echo "═══ cambios locales sin commitear ═══"
git -C "$APP_DIR" status --short 2>/dev/null | head -20
[[ -z $(git -C "$APP_DIR" status --short 2>/dev/null) ]] && echo "(limpio)"

echo
echo "═══ build ═══"
if [[ -d "$APP_DIR/.next" ]]; then
  echo ".next existe · modificado: $(date -r "$APP_DIR/.next" '+%Y-%m-%d %H:%M')"
  echo "commit del build: $(cat "$APP_DIR/.next/BUILD_ID" 2>/dev/null || echo '?')"
else
  echo "no hay .next — la app no está buildeada acá"
fi

echo
echo "═══ proceso y puerto ═══"
pgrep -af "next|node.*server" 2>/dev/null | head -5 || echo "(sin proceso next/node)"
(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':(3000|5620)' || echo "(nada escuchando en 3000/5620)"

echo
echo "═══ pm2 / systemd / docker ═══"
command -v pm2 >/dev/null && pm2 list 2>/dev/null | head -12 || echo "(sin pm2)"
systemctl list-units --type=service --state=running 2>/dev/null | grep -iE 'demo|agricultura|next' || echo "(sin service que matchee)"
command -v docker >/dev/null && docker ps --format '  {{.Names}}  {{.Image}}  {{.Status}}' 2>/dev/null | head || echo "(sin docker)"

echo
echo "═══ variables de entorno (sólo NOMBRES, nunca valores) ═══"
for f in "$APP_DIR"/.env "$APP_DIR"/.env.local "$APP_DIR"/.env.production "$APP_DIR"/.env.production.local; do
  [[ -f "$f" ]] && echo "$(basename "$f"): $(grep -oE '^[A-Z_][A-Z0-9_]*' "$f" | tr '\n' ' ')"
done

echo
echo "═══ responde? ═══"
for p in 3000 5620; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://localhost:$p/" 2>/dev/null)
  [[ -n "$code" && "$code" != "000" ]] && echo "  localhost:$p → HTTP $code"
done
