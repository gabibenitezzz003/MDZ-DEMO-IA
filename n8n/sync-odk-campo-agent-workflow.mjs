#!/usr/bin/env node
/**
 * Genera n8n/openwa-odk-campo-agent.json — workflow agentico completo.
 * Uso: node n8n/sync-odk-campo-agent-workflow.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleAgentRuntime } from "./agent/bundle-for-n8n.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const bundles = bundleAgentRuntime();
const systemPrompt = fs.readFileSync(
  path.join(dir, "prompts/campo-agent-system.txt"),
  "utf8"
);

const normalizeJs = fs.readFileSync(
  path.join(dir, "sync-odk-campo-workflow.mjs"),
  "utf8"
);
// Reuse normalize from sync script inline - read openwa json normalize instead
const normalizeFromDoc = `const payload = $json.body ?? $json;
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
const lat = loc.lat ?? loc.latitude ?? data.lat;
const lon = loc.lng ?? loc.lon ?? loc.longitude ?? data.lon;
const messageId = data.id ?? payload.idempotencyKey ?? \`\${data.chatId}:\${Date.now()}:\${body}\`;
return [{ json: {
  messageId: String(messageId), chatId: data.chatId, inputType: isAudio?'audio':isImage?'image':isLocation?'location':'text',
  messageText: isLocation?(body||'ubicación'):body, lat, lon,
  mediaBase64: data.media?.data??'', mediaMimeType: data.media?.mimetype??'', mediaOmitted: Boolean(data.media?.omitted),
}}];`;

function codeNode(name, jsBody) {
  return {
    parameters: { jsCode: `const $json = $input.first().json;\n${jsBody}\nreturn [{ json: typeof result !== 'undefined' ? result : $json }];` },
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [0, 0],
  };
}

const prepareUserPrompt = `
const c = $json.contextBlock || {};
return {
  ...$json,
  agentUserMessage: [
    'CONTEXTO:',
    JSON.stringify(c, null, 2),
    '',
    'Respondé SOLO con JSON según el system prompt.',
  ].join('\\n'),
};
`;

const geminiHttpBody = `={{ JSON.stringify({
  contents: [{ role: 'user', parts: [{ text: $json.agentUserMessage }]}],
  systemInstruction: { parts: [{ text: ${JSON.stringify(systemPrompt)} }]},
  generationConfig: { temperature: 0.4, maxOutputTokens: 700, responseMimeType: 'application/json' }
}) }}`;

const workflow = {
  name: "OpenWA - Agente Campo ODK (agentico · simulado)",
  nodes: [
    {
      parameters: { httpMethod: "POST", path: "odk-campo-agent", options: {} },
      name: "1 Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [200, 400],
      webhookId: "odk-campo-agent-v1",
    },
    {
      parameters: { jsCode: normalizeFromDoc },
      name: "3 Normalize",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [420, 400],
    },
    {
      parameters: {
        operation: "incr",
        key: "={{ 'wa:dedupe:' + $json.messageId }}",
        expire: true,
        ttl: 86400,
      },
      name: "4 Dedupe Redis",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [640, 400],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        operation: "get",
        propertyName: "session_raw",
        key: "={{ 'wa:session:' + $json.chatId }}",
      },
      name: "8a Load session",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [860, 200],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        operation: "get",
        propertyName: "memory_raw",
        key: "={{ 'wa:memory:' + $json.chatId }}",
      },
      name: "8b Load memory",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [860, 320],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        operation: "get",
        propertyName: "profile_raw",
        key: "={{ 'wa:profile:' + $json.chatId }}",
      },
      name: "8c Load profile",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [860, 440],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        operation: "get",
        propertyName: "notes_raw",
        key: "={{ 'wa:notes:' + $json.chatId }}",
      },
      name: "8d Load notes",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [860, 560],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        operation: "get",
        propertyName: "state_raw",
        key: "={{ 'wa:state:' + $json.chatId }}",
      },
      name: "8e Load relevamiento",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [860, 680],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        jsCode: `const base = $('3 Normalize').first().json;\nconst merged = { ...base,\n  session_raw: $('8a Load session').first().json.session_raw,\n  memory_raw: $('8b Load memory').first().json.memory_raw,\n  profile_raw: $('8c Load profile').first().json.profile_raw,\n  notes_raw: $('8d Load notes').first().json.notes_raw,\n  state_raw: $('8e Load relevamiento').first().json.state_raw,\n  input: base.messageText,\n};\n${bundles.contextEngine}\nconst result = buildContextPayload(merged);\nif (result.debounce) return [{ json: { ...merged, ...result, debounceWait: true } }];\nreturn [{ json: { ...merged, ...result } }];`,
      },
      name: "8 Context Engine",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1080, 400],
    },
    {
      parameters: { amount: 1.2, unit: "seconds" },
      name: "5 Debounce Wait",
      type: "n8n-nodes-base.wait",
      typeVersion: 1.1,
      position: [1080, 200],
    },
    {
      parameters: {
        jsCode: prepareUserPrompt,
      },
      name: "11 Prepare Agent Prompt",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1300, 400],
    },
    {
      parameters: {
        method: "POST",
        url: "=https://generativelanguage.googleapis.com/v1beta/models/{{ $env.GEMINI_MODEL || 'gemini-2.0-flash' }}:generateContent?key={{ $env.GEMINI_API_KEY }}",
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: geminiHttpBody,
        options: { timeout: 30000 },
      },
      name: "12 Agent Gemini",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1520, 400],
    },
    {
      parameters: {
        jsCode: `const prev = $('11 Prepare Agent Prompt').first().json;\nconst agentRaw = $json.candidates?.[0]?.content?.parts?.[0]?.text || '';\n${bundles.guardrail}\nconst guardrail = guardrailPipeline(agentRaw, { input: prev.input, relevamiento: prev.relevamiento });\nreturn [{ json: { ...prev, agentRaw, guardrail } }];`,
      },
      name: "14 Guardrail",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1740, 400],
    },
    {
      parameters: {
        jsCode: `const row = $json;\n${bundles.actionExecutor}\nreturn [{ json: result }];`,
      },
      name: "15 Execute Actions",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1960, 400],
    },
    {
      parameters: {
        operation: "set",
        key: "={{ 'wa:session:' + $json.chatId }}",
        value: "={{ $json.sessionJson }}",
        expire: true,
        ttl: 604800,
      },
      name: "16a Persist session",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [2180, 280],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        operation: "set",
        key: "={{ 'wa:state:' + $json.chatId }}",
        value: "={{ $json.stateJson }}",
        expire: true,
        ttl: 604800,
      },
      name: "16b Persist state",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [2180, 400],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        operation: "set",
        key: "={{ 'wa:memory:' + $json.chatId }}",
        value: "={{ $json.memoryJson }}",
        expire: true,
        ttl: 2592000,
      },
      name: "16c Persist memory",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [2180, 520],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        operation: "set",
        key: "={{ 'wa:notes:' + $json.chatId }}",
        value: "={{ $json.notesJson }}",
        expire: true,
        ttl: 2592000,
      },
      name: "16d Persist notes",
      type: "n8n-nodes-base.redis",
      typeVersion: 1,
      position: [2180, 640],
      credentials: { redis: { id: "513PqFuygiUf57hH", name: "Redis account" } },
    },
    {
      parameters: {
        jsCode: `const row = $('15 Execute Actions').first().json;\n${bundles.responseEngine}\nreturn [{ json: { ...row, ...composeResponse({ chatId: row.chatId, reply: row.reply, input: row.input, profile: JSON.parse(row.profileJson||'{}'), responseMode: row.responseMode, typingMs: row.typingMs }) } }];`,
      },
      name: "18 Response Engine",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [2400, 400],
    },
    {
      parameters: {
        conditions: {
          conditions: [
            {
              leftValue: "={{ $json.needInbox }}",
              rightValue: true,
              operator: { type: "boolean", operation: "true" },
            },
          ],
        },
      },
      name: "17 Inbox?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [2180, 800],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ ($env.NEXT_PUBLIC_SITE_URL).replace(/\\/$/, '') + '/api/agent/odk-inbox' }}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "x-demo-secret", value: "={{ $env.DEMO_AGENT_SECRET }}" },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: "={{ JSON.stringify({ submission: $json.submission }) }}",
      },
      name: "17b POST Inbox",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2400, 760],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ ($env.NEXT_PUBLIC_SITE_URL).replace(/\\/$/, '') + '/api/agent/campo-handoff' }}",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "x-demo-secret", value: "={{ $env.DEMO_AGENT_SECRET }}" },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: "={{ JSON.stringify($json.handoff) }}",
      },
      name: "24 Handoff API",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2400, 920],
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
        body: "={{ JSON.stringify({ chatId: $json.chatId, text: $json.reply }) }}",
      },
      name: "20 WhatsApp Text",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2620, 400],
      credentials: {
        httpHeaderAuth: { id: "HMl1Be2nj7mdMRAw", name: "Header Auth account" },
      },
    },
    {
      parameters: {
        content:
          "## Agente Campo ODK v2\n\nWebhook: POST /webhook/odk-campo-agent\n\nRedis: wa:session, wa:memory, wa:profile, wa:notes, wa:state\n\nRegenerar: node n8n/sync-odk-campo-agent-workflow.mjs\n\nPrompt: n8n/prompts/campo-agent-system.txt",
        height: 320,
        width: 480,
      },
      name: "LEEME",
      type: "n8n-nodes-base.stickyNote",
      typeVersion: 1,
      position: [160, 80],
    },
  ],
  connections: {
    "1 Webhook": { main: [[{ node: "3 Normalize", type: "main", index: 0 }]] },
    "3 Normalize": { main: [[{ node: "4 Dedupe Redis", type: "main", index: 0 }]] },
    "4 Dedupe Redis": {
      main: [
        [
          { node: "8a Load session", type: "main", index: 0 },
          { node: "8b Load memory", type: "main", index: 0 },
          { node: "8c Load profile", type: "main", index: 0 },
          { node: "8d Load notes", type: "main", index: 0 },
          { node: "8e Load relevamiento", type: "main", index: 0 },
        ],
      ],
    },
    "8e Load relevamiento": { main: [[{ node: "8 Context Engine", type: "main", index: 0 }]] },
    "8 Context Engine": {
      main: [[{ node: "11 Prepare Agent Prompt", type: "main", index: 0 }]],
    },
    "11 Prepare Agent Prompt": { main: [[{ node: "12 Agent Gemini", type: "main", index: 0 }]] },
    "12 Agent Gemini": { main: [[{ node: "14 Guardrail", type: "main", index: 0 }]] },
    "14 Guardrail": { main: [[{ node: "15 Execute Actions", type: "main", index: 0 }]] },
    "15 Execute Actions": {
      main: [
        [
          { node: "16a Persist session", type: "main", index: 0 },
          { node: "16b Persist state", type: "main", index: 0 },
          { node: "16c Persist memory", type: "main", index: 0 },
          { node: "16d Persist notes", type: "main", index: 0 },
          { node: "17 Inbox?", type: "main", index: 0 },
        ],
      ],
    },
    "16b Persist state": { main: [[{ node: "18 Response Engine", type: "main", index: 0 }]] },
    "17 Inbox?": {
      main: [
        [{ node: "17b POST Inbox", type: "main", index: 0 }],
        [{ node: "18 Response Engine", type: "main", index: 0 }],
      ],
    },
    "17b POST Inbox": { main: [[{ node: "18 Response Engine", type: "main", index: 0 }]] },
    "18 Response Engine": { main: [[{ node: "20 WhatsApp Text", type: "main", index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: "v1", timezone: "America/Argentina/Buenos_Aires" },
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

const out = path.join(dir, "openwa-odk-campo-agent.json");
fs.writeFileSync(out, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Wrote ${out}`);
