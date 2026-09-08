/** Preparar contexto para el Agente LangChain — regenerar con sync script */
const body = $json.body ?? $json;
const sessionId = String(body.sessionId || "").trim();
const text = String(body.text || "").trim();
const originalText = String(body.originalText || text).trim();

if (!sessionId || !text) {
  return [{ json: { ok: false, error: "sessionId y text requeridos" } }];
}

const staticData = $getWorkflowStaticData("global");
if (!staticData.sessions) staticData.sessions = {};

const prev = staticData.sessions[sessionId] || {
  turns: [],
  facts: {},
  pendingFields: {},
  lastSectionId: "",
  rutMode: "idle",
};

const incomingHistory = Array.isArray(body.history) ? body.history : [];
const history = (incomingHistory.length ? incomingHistory : prev.turns || []).slice(
  -16
);
const facts = { ...(prev.facts || {}), ...(body.facts || {}) };
const pendingFields = {
  ...(prev.pendingFields || {}),
  ...(body.pendingFields || {}),
};
const lastSectionId = String(body.lastSectionId || prev.lastSectionId || "");
const rutMode = String(body.rutMode || prev.rutMode || "idle");
const pageContext = body.pageContext || {};

const rawModel = String(body.model || "gemini-2.0-flash").trim();
const model = rawModel.startsWith("models/")
  ? rawModel
  : `models/${rawModel.replace(/^gemini-/, "gemini-")}`;

const ctxBits = [
  `pathname=${pageContext.pathname || "/"}`,
  `hash=${pageContext.hash || "(ninguno)"}`,
  `seccionVisible=${pageContext.sectionId || "(desconocida)"}`,
];
if (pageContext.sectionTitle) ctxBits.push(`titulo=${pageContext.sectionTitle}`);
if (pageContext.sectionBlurb) ctxBits.push(`resumen=${pageContext.sectionBlurb}`);
if (pageContext.rutStep) ctxBits.push(`rutPaso=${pageContext.rutStep}`);

const historyBlock = history.length
  ? history.map((t) => `${t.role}: ${t.text}`).join("\n")
  : "(sin historial previo)";

const agentUserMessage = [
  `SECCIÓN ACTUAL O ÚLTIMA: ${lastSectionId || "ninguna"}.`,
  `CONTEXTO DE PÁGINA: ${ctxBits.join(" | ")}.`,
  `HECHOS DE SESIÓN: ${JSON.stringify(facts)}.`,
  `RUT mode=${rutMode} | campos pendientes=${JSON.stringify(pendingFields)}.`,
  `TEXTO ORIGINAL STT: "${originalText}".`,
  `TEXTO CORREGIDO: "${text}".`,
  "",
  "HISTORIAL RECIENTE:",
  historyBlock,
  "",
  "Respondé al pedido del usuario. Si necesitás un id de sección, usá buscar_seccion.",
].join("\n");

return [
  {
    json: {
      ok: true,
      sessionId,
      text,
      originalText,
      history,
      facts,
      pendingFields,
      lastSectionId,
      rutMode,
      pageContext,
      model,
      agentUserMessage,
    },
  },
];
