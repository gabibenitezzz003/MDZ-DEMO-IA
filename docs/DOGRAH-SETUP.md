# Configuración Dograh — Asistente Agricultura Mendoza

Guía para armar el agente en [app.dograh.com/workflow](https://app.dograh.com/workflow) y conectarlo a esta DEMO.

## 1. Crear el agente

1. Nombre: **Asistente Agricultura Mendoza**
2. Idioma: español (Argentina / neutro claro)
3. Canal: **Web Calls** + widget embebido (no hace falta telefonía)

## 2. Knowledge Base

Subí estos archivos desde `content/knowledge/`:

| Archivo | Modo sugerido |
|---------|---------------|
| `mapa-del-sitio.md` | Full Document o Chunked |
| `rut-instructivo.md` | Full Document |
| `faqs-capacitaciones.md` | Full Document |

Adjuntá los tres al nodo de conversación principal (y al nodo RUT).

## 3. Voz ElevenLabs (GABI B)

En **Models → BYOK → Voice** (o Model Overrides del agente):

- Provider: **ElevenLabs**
- Voice ID manual: `xDZJO6bbSnscJEAbhpRF` (GABI B)
- Model: `eleven_multilingual_v2`
- Speed: `1.02`
- API key: la de ElevenLabs (no la guardes en el repo)

El transcriber/LLM pueden seguir en Dograh. Lo importante es que el TTS sea ElevenLabs multilingual para que suene natural en español.

Prompts listos para copiar: `docs/DOGRAH-PROMPTS.md`.

## 3b. Global prompt (copiar)

Usá el texto de `docs/DOGRAH-PROMPTS.md` (Global Node). La regla dura es: **nunca inglés**, voseo mendocino, primero la tool y después hablar.

## 4. Nodos sugeridos

### Start Call
Saludo: “Hola, soy el asistente DEMO de la Dirección de Agricultura de Mendoza. Puedo llevarte a informes por cultivo, herramientas digitales o guiarte en el trámite RUT. ¿Qué necesitás?”

### Router / Navegación
Si pide un cultivo, mapa, precios o capacitación → tool `navigate_section` y explicar qué hay ahí.

### Guía RUT
Si pide inscribirse / RUT / declaración jurada:
1. `open_rut_wizard`
2. Explicar: cuenta SIA → confirmar mail → Declaraciones Juradas → Nueva → 5 pasos
3. `set_rut_step` para avanzar 1→5
4. En paso 4, `show_doc_checklist` con la condición frente a la tierra

### Capacitaciones
Navegar a `capacitacion-bpa` o `encargado-finca` y recordar el mail `direcciondeagricultura@mendoza.gov.ar`.

## 5. HTTP API Tools

Base URL: tu deploy, por ejemplo `https://TU-DOMINIO.vercel.app`  
Header en todos: `x-demo-secret: <mismo valor que DEMO_AGENT_SECRET>`  
Content-Type: `application/json`

### `navigate_section`

- Method: POST  
- URL: `{BASE}/api/agent/action`  
- Body:

```json
{
  "sessionId": "{{initial_context.session_id}}",
  "action": "navigate",
  "target": "{{section_id}}"
}
```

Parámetros LLM: `section_id` (string, required).

### `open_rut_wizard`

```json
{
  "sessionId": "{{initial_context.session_id}}",
  "action": "open_rut"
}
```

### `set_rut_step`

```json
{
  "sessionId": "{{initial_context.session_id}}",
  "action": "rut_set_step",
  "target": "{{step}}"
}
```

Parámetros: `step` integer 1–5.

### `show_doc_checklist`

```json
{
  "sessionId": "{{initial_context.session_id}}",
  "action": "show_checklist",
  "payload": {
    "condicion_tierra": "{{condicion_tierra}}",
    "has_vid": false
  }
}
```

Parámetros: `condicion_tierra` (Titular, Locatario/Arrendatario, etc.).

### `scroll_page`

```json
{
  "sessionId": "{{initial_context.session_id}}",
  "action": "scroll",
  "target": "{{direction}}"
}
```

Parámetros: `direction` = `up` | `down` | `top` | `bottom`.

### `go_home`

```json
{
  "sessionId": "{{initial_context.session_id}}",
  "action": "go_home"
}
```

### `go_back`

```json
{
  "sessionId": "{{initial_context.session_id}}",
  "action": "go_back"
}
```

`navigate_section` ahora también devuelve `spoken` y `guide` para que el agente narre lo que está mostrando.

> Si Dograh no interpola `initial_context` dentro del body del tool, pedile al usuario que diga el `session_id` que aparece en el chip inferior izquierdo de la DEMO, o configurá el parámetro `session_id` como input del tool y mencioná en el prompt que debe usar `{{initial_context.session_id}}`.

## 6. Embed en la web

1. Agent settings → **Add to Website** → **Configure Widget**
2. Enable embedding
3. Allowed Domains: `localhost`, tu dominio de deploy
4. Widget Type: **Voice**
5. Mode: **Floating Widget**
6. Button text: `Hablar con el asistente`
7. Color: `#0033A0`
8. Copiá el `src` del script a `NEXT_PUBLIC_DOGRAH_EMBED_URL` en `.env.local` / Vercel

El frontend ya inyecta:

```js
data-dograh-context = {
  session_id,
  current_page,
  demo: true,
  locale: "es-AR"
}
```

## 7. Prueba sin Dograh (curl)

Con la app en `npm run dev` y el `sessionId` del chip:

```bash
curl -X POST http://localhost:3000/api/agent/action \
  -H "Content-Type: application/json" \
  -H "x-demo-secret: demo-secret-change-me" \
  -d '{"sessionId":"PEGAR-SESSION-ID","action":"navigate","target":"ciruela"}'
```

```bash
curl -X POST http://localhost:3000/api/agent/action \
  -H "Content-Type: application/json" \
  -H "x-demo-secret: demo-secret-change-me" \
  -d '{"sessionId":"PEGAR-SESSION-ID","action":"open_rut"}'
```

## 8. Checklist de ensayo

- [ ] Micrófono permitido en HTTPS o localhost
- [ ] Dominio allowlisted en Dograh
- [ ] Tools apuntan a la URL pública correcta
- [ ] Secret coincidente
- [ ] KB adjunta a los nodos
- [ ] Guion de `docs/DEMO-SCRIPT.md` recorrido una vez
