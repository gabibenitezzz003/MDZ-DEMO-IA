# Deploy — demo Agricultura en servidor de empresa (Docker + nginx + HTTPS)

Guía práctica para publicar mañana con una **URL real**.  
El micrófono del navegador **exige HTTPS** (salvo localhost).

## Arquitectura

```
Internet (HTTPS)
    → nginx (443) + Let's Encrypt
        → Docker container Next.js (127.0.0.1:3000)
            → Gemini + ElevenLabs (salientes)
```

**Importante:** corré **una sola réplica**. La memoria de chat y el SSE viven en proceso Node; si escalás a 2+ pods sin Redis, se rompe la sesión.

## 0. Antes de subir

1. Elegí un dominio, ej. `demo-agricultura.tuempresa.com` (DNS A → IP del VPS).
2. En el VPS: Docker + Docker Compose + nginx + certbot.
3. **Rotá** las API keys si alguna vez se pegaron en chats o tickets (Gemini, ElevenLabs).
4. Generá un `DEMO_AGENT_SECRET` fuerte (no uses el de desarrollo).

## 1. Archivo de secretos en el server

En el servidor, en la carpeta del proyecto:

```bash
nano .env.production
```

Contenido mínimo:

```bash
# URL pública final (con https)
NEXT_PUBLIC_SITE_URL=https://demo-agricultura.tuempresa.com
NEXT_PUBLIC_USE_DOGRAH=false

# Cerebro + voz
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=xDZJO6bbSnscJEAbhpRF
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# Puente opcional Dograh / tools HTTP
DEMO_AGENT_SECRET=CAMBIAR_POR_UNO_FUERTE
USE_N8N_AS_BRAIN=false
```

Permisos:

```bash
chmod 600 .env.production
```

No subas `.env.production` ni `.env.local` a git.

## 2. Subir el código

Desde tu máquina:

```bash
# Opción A — git
git push origin main
# en el server:
git clone <repo> && cd demo-agricultura

# Opción B — rsync (sin git)
rsync -avz --exclude node_modules --exclude .next --exclude .env.local \
  ./demo-agricultura/ user@IP_SERVIDOR:/opt/demo-agricultura/
```

## 3. Build y arranque (Docker)

En el server:

```bash
cd /opt/demo-agricultura

# Ajustá la URL pública en .env.production y en docker-compose si hace falta
export NEXT_PUBLIC_SITE_URL=https://demo-agricultura.tuempresa.com

docker compose build --build-arg NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
docker compose up -d
docker compose ps
curl -I http://127.0.0.1:3000
```

## 4. nginx + HTTPS

```bash
sudo cp deploy/nginx-demo-agricultura.conf /etc/nginx/sites-available/demo-agricultura
# Editá el server_name
sudo nano /etc/nginx/sites-available/demo-agricultura
sudo ln -sf /etc/nginx/sites-available/demo-agricultura /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Certificado (con el DNS ya apuntando)
sudo certbot --nginx -d demo-agricultura.tuempresa.com
```

Probar:

- `https://demo-agricultura.tuempresa.com` carga la landing
- Micrófono pide permiso (solo en HTTPS)
- Demo 3 min + chat responden

## 5. Firewall / red

Abrí solo **80** y **443** al mundo.  
El puerto **3000** debe quedar en `127.0.0.1` (como en `docker-compose.yml`).

Salida HTTPS del server hacia:

- `generativelanguage.googleapis.com` (Gemini)
- `api.elevenlabs.io` (TTS)

## 6. Checklist del día de la demo

- [ ] DNS resuelve a la IP correcta
- [ ] HTTPS válido (candado verde / sin warning)
- [ ] `.env.production` con keys de producción
- [ ] `docker compose ps` → healthy / running
- [ ] Probar voz en Chrome/Edge (no todos los browsers tienen STT igual)
- [ ] Permitir popups para la URL (oficiales en pestaña)
- [ ] Banner DEMO visible (no se confunde con el sitio del gobierno)
- [ ] Plan B: si falla TTS/API, la app igual navega con cerebro local

## 7. Actualizar después de un cambio

```bash
cd /opt/demo-agricultura
git pull   # o rsync
docker compose build
docker compose up -d
```

## 8. Problemas frecuentes

| Síntoma | Qué mirar |
|---------|-----------|
| Micrófono no anda | ¿HTTPS? ¿permiso del browser? |
| SSE / eventos cortados | `proxy_buffering off` en nginx |
| “No responde” Gemini/voz | keys en `.env.production`, salida a internet |
| Sesión rara con 2 containers | bajá a 1 réplica |
| Página en blanco tras deploy | `docker compose logs -f demo` |

## 9. Seguridad mínima

- No commitear secretos
- `DEMO_AGENT_SECRET` distinto al de local
- Rotar keys si se filtraron
- Mantener el banner **DEMO**
- Si la URL es interna, preferí VPN / IP allowlist además de HTTPS
