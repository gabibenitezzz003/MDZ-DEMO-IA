#!/usr/bin/env node
/**
 * Regenera n8n/openwa-odk-campo.json embebiendo n8n/odk-safe-responder.js
 * Uso: node n8n/sync-odk-campo-workflow.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const responderSource = fs.readFileSync(
  path.join(dir, "odk-safe-responder.js"),
  "utf8"
);

const normalizeJs = `const payload = $json.body ?? $json;
const data = payload.data ?? {};
const event = payload.event ?? payload.body?.event;

if (event === 'test' || event !== 'message.received') return [];
if (data.isGroup === true || data.isStatusBroadcast === true || !data.chatId) return [];

const rawType = String(data.type ?? '').toLowerCase();
const isAudio = ['audio', 'voice', 'ptt'].includes(rawType);
const isText = rawType === 'text' || rawType === 'chat' || (!rawType && typeof data.body === 'string');
const isImage = ['image', 'photo'].includes(rawType);
const isDocument = ['document', 'file'].includes(rawType);
const isLocation = rawType === 'location' || Boolean(data.location || data.lat != null);
if (!isAudio && !isText && !isImage && !isDocument && !isLocation) return [];

const body = typeof data.body === 'string' ? data.body.trim() : '';
if (isText && !body) return [];

if (data.fromMe === true) {
  const botEcho = /^\\u200B/.test(body);
  if (!isText || botEcho) return [];
}

const loc = data.location || {};
const lat = loc.lat ?? loc.latitude ?? data.lat ?? data.latitude;
const lon = loc.lng ?? loc.lon ?? loc.longitude ?? data.lon ?? data.longitude;

const messageId =
  data.id ??
  payload.idempotencyKey ??
  payload.deliveryId ??
  \`\${data.chatId}:\${data.timestamp ?? Date.now()}:\${body}\`;

return [{
  json: {
    messageId: String(messageId),
    chatId: data.chatId,
    from: data.from ?? data.chatId,
    inputType: isAudio ? 'audio' : isImage ? 'image' : isDocument ? 'document' : isLocation ? 'location' : 'text',
    messageText: isLocation ? (body || 'ubicación') : body,
    lat,
    lon,
    mediaBase64: data.media?.data ?? '',
    mediaMimeType: data.media?.mimetype ?? data.mimetype ?? '',
    mediaFileName: data.media?.filename ?? data.filename ?? '',
    mediaUrl: data.media?.url ?? '',
    mediaOmitted: Boolean(data.media?.omitted),
    mediaSizeBytes: data.media?.sizeBytes ?? null,
    timestamp: data.timestamp ?? null,
    sessionId: payload.sessionId ?? null,
    fromMe: Boolean(data.fromMe),
  },
}];`;

const prepareTextJs = `return [{
  json: {
    ...$json,
    input: $json.messageText,
    sourceType: $json.inputType,
    state_raw: $('Redis - Recuperar estado ODK').first().json.state_raw ?? '',
  },
}];`;

const prepareAudioJs = `return [{
  json: {
    ...$('Restaurar mensaje').first().json,
    input: $json.text ?? $json.transcript ?? $json.messageText ?? '',
    sourceType: 'audio',
    state_raw: $('Redis - Recuperar estado ODK').first().json.state_raw ?? '',
  },
}];`;

const workflow = {
  name: "OpenWA - WhatsApp de campo ODK (simulado)",
  nodes: [
    {
      parameters: { httpMethod: "POST", path: "odk-campo", options: {} },
      id: "campo-webhook-001",
      name: "Webhook OpenWA Campo",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [680, 300],
      webhookId: "odk-campo-demo-webhook",
    },
    {
      parameters: { jsCode: normalizeJs },
      id: "campo-normalize-001",
      name: "Normalizar entrada",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [900, 300],
    },
    {
      parameters: {
        operation: "incr",
        key: "={{ 'wa:dedupe:' + $json.messageId }}",
        expire: true,
        ttl: 86400,
      },
      id: "campo-redis-dedupe-001",
      name: "Redis - Deduplicar webhook",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [1120, 300],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 2,
          },
          conditions: [
            {
              id: "campo-first-delivery",
              leftValue: "={{ Number(Object.values($json)[0] ?? 0) }}",
              rightValue: 1,
              operator: { type: "number", operation: "equals" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      id: "campo-if-first-001",
      name: "¿Primera entrega?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [1340, 300],
    },
    {
      parameters: {
        assignments: {
          assignments: [
            {
              id: "m1",
              name: "messageId",
              value: "={{ $('Normalizar entrada').first().json.messageId }}",
              type: "string",
            },
            {
              id: "m2",
              name: "chatId",
              value: "={{ $('Normalizar entrada').first().json.chatId }}",
              type: "string",
            },
            {
              id: "m3",
              name: "inputType",
              value: "={{ $('Normalizar entrada').first().json.inputType }}",
              type: "string",
            },
            {
              id: "m4",
              name: "messageText",
              value: "={{ $('Normalizar entrada').first().json.messageText }}",
              type: "string",
            },
            {
              id: "m5",
              name: "lat",
              value: "={{ $('Normalizar entrada').first().json.lat }}",
              type: "number",
            },
            {
              id: "m6",
              name: "lon",
              value: "={{ $('Normalizar entrada').first().json.lon }}",
              type: "number",
            },
            {
              id: "m7",
              name: "mediaBase64",
              value: "={{ $('Normalizar entrada').first().json.mediaBase64 }}",
              type: "string",
            },
            {
              id: "m8",
              name: "mediaOmitted",
              value: "={{ $('Normalizar entrada').first().json.mediaOmitted }}",
              type: "boolean",
            },
          ],
        },
        options: {},
      },
      id: "campo-restore-001",
      name: "Restaurar mensaje",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [1560, 280],
    },
    {
      parameters: {
        operation: "get",
        propertyName: "state_raw",
        key: "={{ 'odk:state:' + $json.chatId }}",
        keyType: "string",
        options: { dotNotation: false },
      },
      id: "campo-redis-get-001",
      name: "Redis - Recuperar estado ODK",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [1780, 280],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 2,
          },
          conditions: [
            {
              id: "campo-is-audio",
              leftValue: "={{ $json.inputType }}",
              rightValue: "audio",
              operator: { type: "string", operation: "equals" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      id: "campo-if-audio-001",
      name: "¿Es audio?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [2000, 280],
    },
    {
      parameters: { jsCode: prepareTextJs },
      id: "campo-prepare-text-001",
      name: "Preparar entrada desde texto",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2220, 380],
    },
    {
      parameters: { jsCode: prepareAudioJs },
      id: "campo-prepare-audio-001",
      name: "Preparar entrada desde audio",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2220, 180],
    },
    {
      parameters: { jsCode: responderSource },
      id: "campo-responder-001",
      name: "Respuesta ODK campo",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2440, 280],
    },
    {
      parameters: {
        operation: "set",
        key: "={{ 'odk:state:' + $('Respuesta ODK campo').first().json.chatId }}",
        value: "={{ $('Respuesta ODK campo').first().json.stateJson }}",
        keyType: "string",
        expire: true,
        ttl: 604800,
      },
      id: "campo-redis-set-001",
      name: "Redis - Guardar estado ODK",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [2660, 280],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 2,
          },
          conditions: [
            {
              id: "campo-need-inbox",
              leftValue: "={{ $('Respuesta ODK campo').first().json.needInbox }}",
              rightValue: true,
              operator: { type: "boolean", operation: "true" },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      id: "campo-if-inbox-001",
      name: "¿Enviar a bandeja demo?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [2880, 280],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ ($env.NEXT_PUBLIC_SITE_URL || 'https://demo-agricultura.vercel.app').replace(/\\/$/, '') + '/api/agent/odk-inbox' }}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "x-demo-secret",
              value: "={{ $env.DEMO_AGENT_SECRET }}",
            },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: "={{ JSON.stringify({ submission: $('Respuesta ODK campo').first().json.submission }) }}",
        options: { timeout: 15000 },
      },
      id: "campo-inbox-post-001",
      name: "POST bandeja demo",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3100, 180],
    },
    {
      parameters: {
        method: "POST",
        url: "http://openwa-api:2785/api/sessions/e75b92ce-697c-4864-9c6a-5c48be1b9599/messages/send-text",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: "={{ JSON.stringify({ chatId: $('Respuesta ODK campo').first().json.chatId, text: $('Respuesta ODK campo').first().json.reply }) }}",
        options: { timeout: 15000 },
      },
      id: "campo-openwa-send-001",
      name: "OpenWA - Enviar respuesta",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [3100, 380],
      credentials: {
        httpHeaderAuth: { id: "HMl1Be2nj7mdMRAw", name: "Header Auth account" },
      },
    },
    {
      parameters: {
        content:
          "## OpenWA · WhatsApp de campo (simulado)\n\nWebhook **nuevo**: `POST /webhook/odk-campo`\n\nNo reutilizar `/webhook/pruebas` (RUT en vivo).\n\nRedis: `odk:state:{chatId}`\n\nFichas demo: `demo-olivo`, `demo-visita`, `demo-finca`\n\nRegenerar responder: `node n8n/sync-odk-campo-workflow.mjs`\n\nVariables n8n: `NEXT_PUBLIC_SITE_URL`, `DEMO_AGENT_SECRET`",
        height: 420,
        width: 520,
      },
      id: "campo-sticky-001",
      name: "LEEME",
      type: "n8n-nodes-base.stickyNote",
      typeVersion: 1,
      position: [640, 80],
    },
  ],
  pinData: {},
  connections: {
    "Webhook OpenWA Campo": {
      main: [[{ node: "Normalizar entrada", type: "main", index: 0 }]],
    },
    "Normalizar entrada": {
      main: [[{ node: "Redis - Deduplicar webhook", type: "main", index: 0 }]],
    },
    "Redis - Deduplicar webhook": {
      main: [[{ node: "¿Primera entrega?", type: "main", index: 0 }]],
    },
    "¿Primera entrega?": {
      main: [[{ node: "Restaurar mensaje", type: "main", index: 0 }]],
    },
    "Restaurar mensaje": {
      main: [[{ node: "Redis - Recuperar estado ODK", type: "main", index: 0 }]],
    },
    "Redis - Recuperar estado ODK": {
      main: [[{ node: "¿Es audio?", type: "main", index: 0 }]],
    },
    "¿Es audio?": {
      main: [
        [{ node: "Preparar entrada desde audio", type: "main", index: 0 }],
        [{ node: "Preparar entrada desde texto", type: "main", index: 0 }],
      ],
    },
    "Preparar entrada desde audio": {
      main: [[{ node: "Respuesta ODK campo", type: "main", index: 0 }]],
    },
    "Preparar entrada desde texto": {
      main: [[{ node: "Respuesta ODK campo", type: "main", index: 0 }]],
    },
    "Respuesta ODK campo": {
      main: [[{ node: "Redis - Guardar estado ODK", type: "main", index: 0 }]],
    },
    "Redis - Guardar estado ODK": {
      main: [[{ node: "¿Enviar a bandeja demo?", type: "main", index: 0 }]],
    },
    "¿Enviar a bandeja demo?": {
      main: [
        [{ node: "POST bandeja demo", type: "main", index: 0 }],
        [{ node: "OpenWA - Enviar respuesta", type: "main", index: 0 }],
      ],
    },
    "POST bandeja demo": {
      main: [[{ node: "OpenWA - Enviar respuesta", type: "main", index: 0 }]],
    },
  },
  active: false,
  settings: {
    executionOrder: "v1",
    timezone: "America/Argentina/Buenos_Aires",
  },
  meta: {
    templateCredsSetupCompleted: true,
  },
  tags: [],
};

const outPath = path.join(dir, "openwa-odk-campo.json");
fs.writeFileSync(outPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Wrote ${outPath} (${responderSource.length} bytes responder embedded)`);
