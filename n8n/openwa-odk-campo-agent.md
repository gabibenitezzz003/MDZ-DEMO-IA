# Agente Campo ODK v2 — Arquitectura agentica

Webhook **nuevo**: `POST /webhook/odk-campo-agent`

## Generar workflow importable

```bash
node n8n/sync-odk-campo-agent-workflow.mjs
# → n8n/openwa-odk-campo-agent.json
```

## Módulos (fuente de verdad)

| Archivo | Rol |
|---------|-----|
| `n8n/agent/schemas.js` | Formularios demo, claves Redis, helpers |
| `n8n/agent/context-engine.js` | Sesión + memoria + debounce + contextBlock |
| `n8n/agent/guardrail.js` | Valida JSON del agente y acciones |
| `n8n/agent/action-executor.js` | Ejecuta herramientas |
| `n8n/agent/response-engine.js` | Modo voz, typing, anti-loop |
| `n8n/prompts/campo-agent-system.txt` | System prompt completo |

Tests: `npx vitest run lib/campo-agent.test.ts`

## Redis

| Key | Contenido | TTL |
|-----|-----------|-----|
| `wa:dedupe:{messageId}` | idempotencia | 24h |
| `wa:session:{chatId}` | turnos conversación | 7d |
| `wa:memory:{chatId}` | summary + facts | 30d |
| `wa:profile:{chatId}` | preferencias | 30d |
| `wa:notes:{chatId}` | notas personales | 30d |
| `wa:state:{chatId}` | relevamiento ODK simulado | 7d |

## APIs web

- `POST /api/agent/odk-inbox` — ficha confirmada (igual que antes)
- `POST /api/agent/campo-handoff` — derivación a humano

## Variables n8n

- `GEMINI_API_KEY`, `GEMINI_MODEL` (ej. gemini-2.0-flash)
- `NEXT_PUBLIC_SITE_URL`, `DEMO_AGENT_SECRET`
- Credenciales: Redis, OpenWA Header Auth, ElevenLabs (STT/TTS manual)

## Flujo vs v1 determinista

| v1 | v2 agentico |
|----|-------------|
| odk-safe-responder.js decide todo | Gemini planifica + acciones |
| Gemini humaniza | Guardrail valida dominio |
| odk:state | wa:state + wa:memory + wa:notes |
| /webhook/odk-campo | /webhook/odk-campo-agent |

## Restricciones (igual)

- Fichas simuladas demo-olivo / demo-visita / demo-finca
- NO Central / agriencuestas
- confirm_relevamiento solo si el usuario dijo confirmo/dale/manda/etc.

## Próximo paso en n8n

1. Importar `openwa-odk-campo-agent.json`
2. Configurar credenciales y env vars
3. Apuntar OpenWA al nuevo webhook
4. (Opcional) Agregar rama ElevenLabs STT antes del Context Engine
5. (Opcional) Agregar TTS después del Response Engine

Documento armado desde cero: `openwa-odk-campo-agent-workflow-completo.txt` (si existe) o este README.
