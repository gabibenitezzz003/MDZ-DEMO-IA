#!/usr/bin/env node
/**
 * Regenera n8n/demo-agricultura-asistente.json (LangChain Agent)
 * Uso: node n8n/sync-demo-agricultura-workflow.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const prepareJs = fs.readFileSync(
  path.join(dir, "demo-agricultura-prepare.js"),
  "utf8"
);
const formatJs = fs.readFileSync(
  path.join(dir, "demo-agricultura-format.js"),
  "utf8"
);
const siteMap = fs.readFileSync(
  path.join(dir, "../content/knowledge/mapa-del-sitio.md"),
  "utf8"
);
const deepTopics = fs.readFileSync(
  path.join(dir, "../content/knowledge/temas-profundos.md"),
  "utf8"
);
const catalog = JSON.parse(
  fs.readFileSync(path.join(dir, "../content/site-catalog.json"), "utf8")
);

const systemPrompt = fs
  .readFileSync(
    path.join(dir, "prompts/demo-agricultura-agent-system.txt"),
    "utf8"
  )
  .replace("__SITE_MAP_KNOWLEDGE__", siteMap.trim())
  .replace("__DEEP_TOPICS_KNOWLEDGE__", deepTopics.trim());

const sections = (catalog.sections || []).map((s) => ({
  id: s.id,
  title: s.title,
  group: s.group,
  summary: s.summary || "",
}));

const toolJsCode = `const input = typeof query === 'string' ? JSON.parse(query) : query;
const term = String(input.busqueda || input.query || '').toLowerCase().normalize('NFD').replace(/\\p{M}/gu, '');
const sections = ${JSON.stringify(sections)};
if (!term) return JSON.stringify({ ok: false, error: 'Indicá busqueda' });
const hits = sections.filter((s) => {
  const blob = [s.id, s.title, s.group, s.summary].join(' ').toLowerCase().normalize('NFD').replace(/\\p{M}/gu, '');
  return blob.includes(term) || term.split(/\\s+/).some((w) => w.length > 2 && blob.includes(w));
}).slice(0, 6);
return JSON.stringify({ ok: true, hits });`;

const intentSchemaExample = {
  action: "describe",
  target: "ciruela",
  openLink: false,
  openExternal: false,
  url: "",
  reply: "Texto hablado para el usuario.",
  extractedFields: {},
  fillMode: null,
  endSession: false,
  heardAs: "",
  remember: {},
};

const workflow = {
  name: "DEMO Agricultura Mendoza — Agente LangChain (Gemini)",
  nodes: [
    {
      parameters: {
        content:
          "## DEMO Agricultura — Agente LangChain\n\n**Webhook:** `POST /webhook/demo-agricultura`\n\n**Nodos LangChain:**\n- Agente DEMO (Tools Agent)\n- Gemini Chat Model\n- Memoria por sessionId\n- Parser JSON estructurado\n- Tool `buscar_seccion`\n\n**Credencial requerida:** Google Gemini (PaLM) API en el nodo Gemini.\n\n**Next.js** (`.env.local`):\n```\nUSE_N8N_AS_BRAIN=true\nN8N_WEBHOOK_URL=https://n8n.followlsn.com/webhook/demo-agricultura\nGEMINI_API_KEY=...\nGEMINI_MODEL=gemini-2.0-flash\n```\n\nRegenerar: `node n8n/sync-demo-agricultura-workflow.mjs`",
        height: 380,
        width: 460,
      },
      id: "note-1",
      name: "Notas",
      type: "n8n-nodes-base.stickyNote",
      typeVersion: 1,
      position: [-280, -80],
    },
    {
      parameters: {
        httpMethod: "POST",
        path: "demo-agricultura",
        responseMode: "responseNode",
        options: {},
      },
      id: "wh-1",
      name: "Webhook DEMO",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 0],
      webhookId: "demo-agricultura-web",
    },
    {
      parameters: { jsCode: prepareJs },
      id: "prep-1",
      name: "Preparar contexto",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [280, 0],
    },
    {
      parameters: {
        promptType: "define",
        text: "={{ $json.agentUserMessage }}",
        hasOutputParser: true,
        options: {
          systemMessage: systemPrompt,
          maxIterations: 8,
          returnIntermediateSteps: false,
        },
      },
      id: "agent-1",
      name: "Agente DEMO Agricultura",
      type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: 3.1,
      position: [560, 0],
      onError: "continueRegularOutput",
    },
    {
      parameters: {
        modelName: "={{ $('Preparar contexto').first().json.model }}",
        options: {
          temperature: 0.45,
          maxOutputTokens: 1200,
        },
      },
      id: "gemini-1",
      name: "Gemini Chat Model",
      type: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
      typeVersion: 1.1,
      position: [560, 220],
    },
    {
      parameters: {
        sessionKey: "={{ $('Preparar contexto').first().json.sessionId }}",
        contextWindowLength: 12,
      },
      id: "mem-1",
      name: "Memoria sesión",
      type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
      typeVersion: 1.3,
      position: [760, 220],
    },
    {
      parameters: {
        schemaType: "fromJson",
        jsonSchemaExample: JSON.stringify(intentSchemaExample, null, 2),
        autoFix: true,
      },
      id: "parser-1",
      name: "Parser JSON intent",
      type: "@n8n/n8n-nodes-langchain.outputParserStructured",
      typeVersion: 1.3,
      position: [960, 220],
    },
    {
      parameters: {
        name: "buscar_seccion",
        description:
          "Busca secciones, cultivos o trámites de la demo por nombre o palabra clave. Devuelve id, título y grupo. Usala antes de navigate/describe si no estás seguro del target.",
        language: "javaScript",
        specifyInputSchema: true,
        schemaType: "fromJson",
        jsonSchemaExample: JSON.stringify({ busqueda: "ciruela" }),
        jsCode: toolJsCode,
      },
      id: "tool-1",
      name: "Tool buscar sección",
      type: "@n8n/n8n-nodes-langchain.toolCode",
      typeVersion: 1.3,
      position: [1160, 220],
    },
    {
      parameters: {
        modelName: "={{ $('Preparar contexto').first().json.model }}",
        options: {
          temperature: 0.2,
          maxOutputTokens: 800,
        },
      },
      id: "gemini-2",
      name: "Gemini Parser Fix",
      type: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
      typeVersion: 1.1,
      position: [960, 420],
    },
    {
      parameters: { jsCode: formatJs },
      id: "fmt-1",
      name: "Formatear respuesta",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [840, 0],
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{ $json }}",
        options: {},
      },
      id: "resp-1",
      name: "Responder webhook",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [1120, 0],
    },
  ],
  connections: {
    "Webhook DEMO": {
      main: [[{ node: "Preparar contexto", type: "main", index: 0 }]],
    },
    "Preparar contexto": {
      main: [[{ node: "Agente DEMO Agricultura", type: "main", index: 0 }]],
    },
    "Agente DEMO Agricultura": {
      main: [[{ node: "Formatear respuesta", type: "main", index: 0 }]],
    },
    "Formatear respuesta": {
      main: [[{ node: "Responder webhook", type: "main", index: 0 }]],
    },
    "Gemini Chat Model": {
      ai_languageModel: [
        [{ node: "Agente DEMO Agricultura", type: "ai_languageModel", index: 0 }],
      ],
    },
    "Memoria sesión": {
      ai_memory: [
        [{ node: "Agente DEMO Agricultura", type: "ai_memory", index: 0 }],
      ],
    },
    "Parser JSON intent": {
      ai_outputParser: [
        [{ node: "Agente DEMO Agricultura", type: "ai_outputParser", index: 0 }],
      ],
    },
    "Tool buscar sección": {
      ai_tool: [[{ node: "Agente DEMO Agricultura", type: "ai_tool", index: 0 }]],
    },
    "Gemini Parser Fix": {
      ai_languageModel: [
        [{ node: "Parser JSON intent", type: "ai_languageModel", index: 0 }],
      ],
    },
  },
  settings: { executionOrder: "v1" },
  active: false,
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

const out = path.join(dir, "demo-agricultura-asistente.json");
fs.writeFileSync(out, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`✓ Escrito ${out} (LangChain Agent + ${sections.length} secciones en tool)`);
