import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const workflowPath = new URL("../n8n/openwa-rut-agente.json", import.meta.url);
const responderPath = new URL("../n8n/rut-safe-responder.js", import.meta.url);
const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));
const responderSource = readFileSync(responderPath, "utf8");

const node = (name) => {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`Nodo ausente: ${name}`);
  return found;
};

node("Normalizar entrada").parameters.jsCode = `const payload = $json.body ?? $json;
const data = payload.data ?? {};
const event = payload.event ?? payload.body?.event;

if (event === 'test' || event !== 'message.received') return [];
if (data.isGroup === true || data.isStatusBroadcast === true || !data.chatId) return [];

const rawType = String(data.type ?? '').toLowerCase();
const isAudio = ['audio', 'voice', 'ptt'].includes(rawType);
const isText = rawType === 'text' || rawType === 'chat' || (!rawType && typeof data.body === 'string');
const isImage = ['image', 'photo'].includes(rawType);
const isDocument = ['document', 'file'].includes(rawType);
if (!isAudio && !isText && !isImage && !isDocument) return [];

const body = typeof data.body === 'string' ? data.body.trim() : '';
if (isText && !body) return [];

// Prueba controlada en "Mensaje a vos mismo": acepta solo texto escrito por la persona.
// Audio/medios salientes y respuestas del bot siempre se descartan para evitar bucles.
if (data.fromMe === true) {
  const botEcho = /^\\u200B/.test(body) || /^Para registrarte \\(demo RUT\\):/i.test(body);
  if (!isText || botEcho) return [];
}

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
    inputType: isAudio ? 'audio' : isImage ? 'image' : isDocument ? 'document' : 'text',
    messageText: body,
    mediaBase64: data.media?.data ?? '',
    mediaMimeType: data.media?.mimetype ?? data.mimetype ?? '',
    mediaFileName: data.media?.filename ?? data.filename ?? '',
    mediaUrl: data.media?.url ?? '',
    mediaOmitted: Boolean(data.media?.omitted),
    mediaSizeBytes: data.media?.sizeBytes ?? null,
    timestamp: data.timestamp ?? null,
    sessionId: payload.sessionId ?? null,
    fromMe: Boolean(data.fromMe)
  }
}];`;

const restoreAssignments =
  node("Restaurar mensaje").parameters.assignments.assignments;
for (const [name, type] of [
  ["mediaFileName", "string"],
  ["mediaUrl", "string"],
  ["mediaSizeBytes", "number"],
]) {
  if (!restoreAssignments.some((item) => item.name === name)) {
    restoreAssignments.push({
      id: randomUUID(),
      name,
      value: `={{ $('Normalizar entrada').first().json.${name} }}`,
      type,
    });
  }
}

node("Respuesta RUT segura").parameters.jsCode = responderSource;

const redisCredential = node("Redis - Deduplicar webhook").credentials;
const getState = {
  parameters: {
    operation: "get",
    propertyName: "state_raw",
    key: "={{ 'rut:state:' + $json.chatId }}",
    keyType: "string",
    options: { dotNotation: false },
  },
  id: randomUUID(),
  name: "Redis - Recuperar estado RUT",
  type: "n8n-nodes-base.redis",
  typeVersion: 1,
  position: [8460, 3152],
  credentials: redisCredential,
};
const saveState = {
  parameters: {
    operation: "set",
    key: "={{ 'rut:state:' + $('Respuesta RUT segura').first().json.chatId }}",
    value: "={{ $('Respuesta RUT segura').first().json.stateJson }}",
    keyType: "string",
    expire: true,
    ttl: 604800,
  },
  id: randomUUID(),
  name: "Redis - Guardar estado RUT",
  type: "n8n-nodes-base.redis",
  typeVersion: 1,
  position: [9296, 3344],
  credentials: redisCredential,
};
const selectReply = {
  parameters: {
    jsCode: `const safe = $('Respuesta RUT segura').first().json;
const mark = '\\u200B';
const strip = (text) => String(text || '')
  .replace(/^\\u200B+/, '')
  .replace(/^Para registrarte \\(demo RUT\\):\\s*/i, '')
  .trim();
const ai = strip($json.output || '');
const deterministic = strip(safe.deterministicReply);
const usable = Boolean(
  ai.length >= 20 &&
  !/^(no|ok|dale|si|sí)\\.?$/i.test(ai) &&
  !/\`\`\`/.test(ai) &&
  !(deterministic.length > 80 && ai.length < deterministic.length * 0.4)
);
const spoken = usable ? ai : deterministic;
return [{ json: { ...safe, reply: mark + spoken, voiceReply: spoken } }];`,
  },
  id: randomUUID(),
  name: "Seleccionar respuesta híbrida",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [9600, 3344],
};

workflow.nodes = workflow.nodes.filter(
  (item) =>
    ![
      "Redis - Recuperar estado RUT",
      "Redis - Guardar estado RUT",
      "Seleccionar respuesta híbrida",
    ].includes(item.name)
);
workflow.nodes.push(getState, saveState, selectReply);

const agent = node("Agente IA conversacional");
agent.parameters.text =
  "={{ 'Mensaje del usuario: ' + $('Respuesta RUT segura').first().json.input + '\\nRespuesta determinista obligatoria: ' + $('Respuesta RUT segura').first().json.deterministicReply }}";
agent.parameters.options.systemMessage = `Sos la capa conversacional del agente RUT de Mendoza.
La lógica, los datos y la validación ya fueron resueltos por un motor determinista.
Tu única tarea es volver la respuesta más natural y clara.

REGLAS OBLIGATORIAS
- Devolvé solamente la respuesta final, sin Markdown.
- No uses el prefijo "Para registrarte (demo RUT):".
- No cambies datos, estados, números, campos faltantes ni validaciones.
- No agregues promesas oficiales ni afirmes que un documento fue validado.
- Voseo argentino, tono cercano, máximo 3 oraciones.
- Si la respuesta determinista ya es clara, devolvela sin cambios.`;
agent.onError = "continueRegularOutput";

node("ElevenLabs - Generar respuesta de voz").parameters.text = "={{ $json.reply }}";
node("OpenWA - Enviar respuesta segura").parameters.body =
  "={{ JSON.stringify({ chatId: $json.chatId, text: $json.reply }) }}";

workflow.connections["Restaurar mensaje"] = {
  main: [[{ node: getState.name, type: "main", index: 0 }]],
};
workflow.connections[getState.name] = {
  main: [[{ node: "¿Es audio?", type: "main", index: 0 }]],
};
workflow.connections["Respuesta RUT segura"] = {
  main: [[{ node: saveState.name, type: "main", index: 0 }]],
};
workflow.connections[saveState.name] = {
  main: [[{ node: "Agente IA conversacional", type: "main", index: 0 }]],
};
workflow.connections["Agente IA conversacional"] = {
  main: [[{ node: selectReply.name, type: "main", index: 0 }]],
};
workflow.connections[selectReply.name] = {
  main: [
    [
      { node: "OpenWA - Enviar respuesta segura", type: "main", index: 0 },
      { node: "ElevenLabs - Generar respuesta de voz", type: "main", index: 0 },
    ],
  ],
};

delete workflow.connections["Postgres - Memoria conversacional"];
workflow.nodes = workflow.nodes.filter(
  (item) => item.name !== "Postgres - Memoria conversacional"
);

writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Workflow actualizado: ${workflow.nodes.length} nodos`);
