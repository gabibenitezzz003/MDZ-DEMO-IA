# DEMO IA — Dirección de Agricultura Mendoza + Dograh

Réplica DEMO de la landing de la [Dirección de Agricultura](https://sitios.mendoza.gob.ar/produccion/direccion-de-agricultura/) con un asistente de voz (Dograh) que navega la página y guía un wizard **RUT** de 5 pasos.

> **No es el sitio oficial.** No envía datos al SIA ni modifica sistemas del gobierno.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Dograh Voice Widget (embed)
- Puente voz → UI: `POST /api/agent/action` + SSE `GET /api/agent/events`

## Arranque local

```bash
cd demo-agricultura
cp .env.example .env.local   # si aún no existe
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

Variables:

| Variable | Uso |
|----------|-----|
| `DEMO_AGENT_SECRET` | Header `x-demo-secret` que deben enviar los tools de Dograh |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la demo |
| `NEXT_PUBLIC_DOGRAH_EMBED_URL` | `src` del script del widget (opcional al inicio) |

## Probar el puente sin Dograh

1. Abrí la home y copiá el **sessionId** del chip inferior izquierdo.
2. En otra terminal:

```bash
curl -X POST http://localhost:3000/api/agent/action \
  -H "Content-Type: application/json" \
  -H "x-demo-secret: demo-secret-change-me" \
  -d '{"sessionId":"PEGAR-ID","action":"navigate","target":"ciruela"}'
```

Acciones: `navigate`, `highlight`, `open_rut`, `rut_set_step`, `rut_focus_field`, `show_checklist`, `open_external`.

## Contenido

- `content/site-catalog.json` — secciones e IDs de navegación
- `content/knowledge/` — docs para subir a Dograh KB
- `scripts/extract-site.mjs` — re-fetch del HTML oficial (`npm run extract-site`)

## Documentación

- [Configurar Dograh](docs/DOGRAH-SETUP.md)
- [Guion de demo](docs/DEMO-SCRIPT.md)
- [Informe para el equipo](docs/INFORME-PROPUESTA.md)

## Deploy (HTTPS)

El micrófono requiere **HTTPS** (o localhost).

Guía completa para servidor de empresa (**Docker + nginx + Let's Encrypt**):

→ [`docs/DEPLOY.md`](docs/DEPLOY.md)

Archivos listos:

- `Dockerfile` + `docker-compose.yml`
- `deploy/nginx-demo-agricultura.conf`
- `.env.example` → copiar como `.env.production` en el server

## Estructura

```
app/                  # páginas y API
components/           # UI + VoiceAssistantBridge + RutWizard
content/              # catálogo + knowledge
docs/                 # setup Dograh, guion, informe
lib/                  # agent-bus, tipos, checklist RUT
scripts/              # extract-site
```

## Fuera de alcance (fase 2)

WhatsApp/N8N, login real SIA, fix de QR, migración de servidores, analítica sobre tableros existentes.
