# Flujo de trabajo en GitHub

Repo: https://github.com/gabibenitezzz003/MDZ-DEMO-IA

## Reglas

- `main` siempre desplegable.
- Cada mejora va en una **branch** + **PR**.
- No subir `.env.local` ni secretos (están en `.gitignore`).
- Copiá `.env.example` a `.env.local` en tu máquina.

## Día a día

```bash
cd demo-agricultura
git checkout main
git pull origin main

git checkout -b feat/nombre-corto
# ... cambios ...
git add -A
git commit -m "feat: descripción corta del cambio"
git push -u origin HEAD

gh pr create --title "feat: descripción" --body "$(cat <<'EOF'
## Summary
- qué cambió y por qué

## Test plan
- [ ] Probar en http://127.0.0.1:3000
- [ ] Revisar barge-in / chat / RUT según el cambio
EOF
)"
```

## Convenciones de branch

| Prefijo | Uso |
|---------|-----|
| `feat/` | Funcionalidad nueva |
| `fix/` | Bugfix |
| `chore/` | Tooling, docs, deps |
| `refactor/` | Refactor sin cambio de comportamiento |

## Secrets locales

```bash
cp .env.example .env.local
# completar GEMINI_API_KEY, ELEVENLABS_*, N8N_*, etc.
```
