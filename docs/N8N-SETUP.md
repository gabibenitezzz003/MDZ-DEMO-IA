# n8n + LangChain Agent — cerebro DEMO Agricultura

## Arquitectura

```
Browser (VoiceAssistant)
  → POST /api/agent/chat  (Next.js)
      → si USE_N8N_AS_BRAIN=true → N8N_WEBHOOK_URL (primero)
      → si falla → Gemini local (lib/gemini-brain.ts)
  → demo:agent-event mueve la página
  → TTS (browser o ElevenLabs)
```

El workflow **DEMO Agricultura Mendoza — Agente LangChain (Gemini)** usa nodos **LangChain** de n8n:

| Nodo | Tipo LangChain |
|------|----------------|
| **Agente DEMO Agricultura** | `@n8n/n8n-nodes-langchain.agent` |
| **Gemini Chat Model** | `@n8n/n8n-nodes-langchain.lmChatGoogleGemini` |
| **Memoria sesión** | `@n8n/n8n-nodes-langchain.memoryBufferWindow` |
| **Parser JSON intent** | `@n8n/n8n-nodes-langchain.outputParserStructured` |
| **Tool buscar sección** | `@n8n/n8n-nodes-langchain.toolCode` |

Flujo: Webhook → Preparar contexto → **Agente LangChain** → Formatear respuesta → Responder webhook.

## 1. Levantar la demo

```bash
cd demo-agricultura
bash scripts/dev-local.sh
```

`.env.local` mínimo:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
USE_N8N_AS_BRAIN=true
N8N_WEBHOOK_URL=https://n8n.followlsn.com/webhook/demo-agricultura
```

## 2. Importar el workflow

1. Abrí n8n (ej. http://127.0.0.1:5678)
2. **Workflows → Import from file** → `n8n/demo-agricultura-asistente.json`
3. En **Gemini Chat Model** y **Gemini Parser Fix**: asigná la credencial **Google Gemini (PaLM) API** con tu `GEMINI_API_KEY`
4. Activá el workflow
5. URL de producción:

```
https://n8n.followlsn.com/webhook/demo-agricultura
```

### Regenerar el JSON

```bash
node n8n/sync-demo-agricultura-workflow.mjs
```

Editá:
- `n8n/prompts/demo-agricultura-agent-system.txt` — system prompt del agente
- `n8n/demo-agricultura-prepare.js` — contexto de entrada
- `n8n/demo-agricultura-format.js` — contrato de salida + fallback

## 3. Probar con curl

```bash
curl -s -X POST https://n8n.followlsn.com/webhook/demo-agricultura \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-1",
    "text": "llevame a ciruela",
    "originalText": "llevame a ciruela",
    "history": [],
    "pageContext": {"pathname":"/","sectionId":"inicio"},
    "model": "gemini-2.0-flash"
  }' | jq .
```

Respuesta esperada: `ok: true`, `action: "navigate"`, `target: "ciruela"`, `via: "n8n-langchain"`.

## 4. Contrato del webhook

**Request** (campos principales):

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
  "facts": {},
  "model": "gemini-2.0-flash",
  "geminiApiKey": "(Next lo envía; en n8n usás credencial Gemini)",
  "source": "demo-web"
}
```

**Response**:

```json
{
  "ok": true,
  "action": "navigate",
  "target": "ciruela",
  "reply": "...",
  "via": "n8n-langchain",
  "payload": { "click": true }
}
```

## 5. Apagar n8n como cerebro

```
USE_N8N_AS_BRAIN=false
```

La demo sigue con Gemini local en Next.js.
