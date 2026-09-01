# n8n + Gemini 2.5 Flash + GABI B (DEMO)

## Arquitectura

```
Browser (DemoAssistant)
  → POST /api/agent/chat  (Next.js)
      → si USE_N8N_AS_BRAIN=true → N8N_WEBHOOK_URL
           → Agente Gemini (memoria de sesión + fallback)
      → si falla → Gemini local → reglas locales
  → SSE /api/agent/events mueve la página
  → ElevenLabs GABI B habla en el browser
```

El workflow **DEMO Agricultura Mendoza — web + GABI B** interpreta con **gemini-2.5-flash**, guarda memoria por `sessionId` y devuelve el mismo contrato de acciones que el cerebro local (navigate, open_rut, open_external, fill_form, etc.).

## 1. DEMO local

```bash
cd demo-agricultura
npm run dev -- -H 127.0.0.1 -p 3000
```

`.env.local` mínimo:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=xDZJO6bbSnscJEAbhpRF
N8N_WEBHOOK_URL=http://127.0.0.1:5678/webhook/demo-agricultura
USE_N8N_AS_BRAIN=true
```

Next le pasa a n8n el `geminiApiKey` en el body (server-side). No hace falta exponer `$env` dentro de nodos Code de n8n.

## 2. Importar / actualizar workflow

1. Abrí http://127.0.0.1:5678  
2. Importá `n8n/demo-agricultura-asistente.json` (o reimportá sobre el workflow existente)  
3. Activá / Publicá el workflow  
4. URL de producción:

```
http://127.0.0.1:5678/webhook/demo-agricultura
```

Nodos:

1. **Webhook DEMO** — POST `demo-agricultura`  
2. **Agente Gemini** — memoria por sesión + Gemini 2.5 Flash + fallback robusto  
3. **Responder webhook** — JSON al Next  

## 3. Contrato del webhook

Request:

```json
{
  "sessionId": "...",
  "text": "llevame a ciruela",
  "originalText": "llevame a ciruela",
  "history": [{"role":"user","text":"..."},{"role":"assistant","text":"..."}],
  "lastSectionId": "ciruela",
  "pageContext": {},
  "pendingFields": {},
  "rutMode": "idle",
  "facts": {"name":"Gabriel","crop":"ciruela"},
  "model": "gemini-2.5-flash",
  "geminiApiKey": "(lo manda Next)",
  "source": "demo-web"
}
```

Response (resumen):

```json
{
  "ok": true,
  "action": "navigate",
  "target": "ciruela",
  "reply": "...",
  "spoken": "...",
  "extractedFields": {},
  "fillMode": null,
  "remember": {"name":"", "crop":"", "note":""},
  "via": "gemini-2.5-flash"
}
```

Si Gemini falla, el nodo responde igual con un fallback de reglas (ciruela, RUT, ODK, mapas, etc.).

## 4. Memoria

- Next guarda turns + facts en `lib/chat-memory.ts`  
- n8n guarda mirror por `sessionId` en static data del workflow  
- El agente recibe historial + hechos (nombre, cultivo, departamento, temas)  

## 5. Apagar n8n como cerebro

```
USE_N8N_AS_BRAIN=false
```

La demo sigue con Gemini local + GABI B.
