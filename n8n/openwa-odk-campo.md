# OpenWA · WhatsApp de campo (simulado)

Webhook **nuevo**, no reutilizar `/webhook/pruebas` (eso es el RUT).

```
POST /webhook/odk-campo
  → Normalizar (mismo filtro que RUT)
  → Redis GET odk:state:{chatId}
  → STT si audio
  → nodo Function: pegar n8n/odk-safe-responder.js
  → Redis SET odk:state:{chatId}
  → si needInbox: POST {NEXT_PUBLIC_SITE_URL}/api/agent/odk-inbox
       header x-demo-secret
       body { submission }
  → OpenWA send text (+ audio opcional)
```

## Importar

```bash
node n8n/sync-odk-campo-workflow.mjs   # embebe odk-safe-responder.js
# Importar n8n/openwa-odk-campo.json en n8n.followfreight.online
```

## Importante

- Las fichas son **simuladas** (`demo-olivo`, `demo-visita`, `demo-finca`).
- El paquete es JSON de demo, **no** un XForm real de Central.
- **No** hacer POST a agriencuestas.mendoza.gov.ar.
- Gemini, si se usa, solo humaniza el tono; la lógica es determinística.
