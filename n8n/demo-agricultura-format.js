/** Formatear salida del Agente LangChain al contrato del webhook */
const ctx = $("Preparar contexto").first().json;
if (ctx.ok === false) {
  return [{ json: ctx }];
}

const staticData = $getWorkflowStaticData("global");
if (!staticData.sessions) staticData.sessions = {};

const rawOut = $json.output ?? $json.text ?? $json;
let intent =
  rawOut && typeof rawOut === "object" && !Array.isArray(rawOut)
    ? rawOut
    : null;

if (!intent && typeof rawOut === "string") {
  const m = rawOut.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      intent = JSON.parse(m[0]);
    } catch {
      intent = null;
    }
  }
}

function knowledgeFallback(rawText) {
  const n = String(rawText || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  let action = "describe";
  let target = undefined;
  let reply =
    "En esta demo del portal de Agricultura podés explorar cultivos, mapas, clima, precios, trámites y el RUT. Contame qué necesitás.";

  if (/ciruela|ciruelo/.test(n)) {
    target = "ciruela";
    reply =
      "Ciruela reúne informes y pronósticos del cultivo en Mendoza. ¿Querés que te lleve ahí?";
  } else if (/\bajo\b|a bajo/.test(n) && !/scroll|baja/.test(n)) {
    target = "ajo";
    reply = "Ajo tiene informes productivos en el portal. Te puedo marcar la sección.";
  } else if (/mapa/.test(n)) {
    target = "mapas-agricolas";
    reply = "Los mapas agrícolas muestran la producción por departamento.";
  } else if (/\brut\b|ruth|root/.test(n)) {
    action = "navigate";
    target = "rut";
    reply =
      "El RUT es el Registro Único de Tierras. Te marco la sección y te explico el trámite.";
  } else if (/que puedo|que se puede|para que sirve|como funciona/.test(n)) {
    reply =
      "Podés pedirme que te lleve a cualquier bloque del portal, que te explique un cultivo o trámite, que abra el sitio oficial, o arrancar la demo guiada. ¿Por dónde empezamos?";
  }

  return {
    action,
    target,
    openLink: false,
    openExternal: false,
    url: "",
    reply,
    extractedFields: {},
    fillMode: null,
    endSession: false,
    heardAs: "",
    remember: {},
  };
}

let via = "n8n-langchain";

if (!intent || !String(intent.reply || "").trim()) {
  intent = knowledgeFallback(ctx.text);
  via = "fallback-local";
}

const reply = String(intent.reply || "").trim();
const action = String(intent.action || "describe");
const target = intent.target ? String(intent.target) : undefined;

const facts = { ...ctx.facts };
for (const [k, v] of Object.entries(intent.remember || {})) {
  const clean = String(v || "").trim();
  if (clean) facts[k] = clean;
}

const pendingFields = { ...ctx.pendingFields };
if (intent.extractedFields && typeof intent.extractedFields === "object") {
  Object.assign(pendingFields, intent.extractedFields);
}

const turns = [
  ...ctx.history,
  { role: "user", text: ctx.text },
  { role: "assistant", text: reply },
].slice(-24);

staticData.sessions[ctx.sessionId] = {
  turns,
  facts,
  pendingFields,
  lastSectionId:
    target && ["navigate", "describe", "highlight"].includes(action)
      ? target
      : ctx.lastSectionId,
  rutMode: action === "open_rut" ? "collecting" : ctx.rutMode,
  updatedAt: Date.now(),
};

const keys = Object.keys(staticData.sessions);
if (keys.length > 200) {
  keys.sort(
    (a, b) =>
      (staticData.sessions[a].updatedAt || 0) -
      (staticData.sessions[b].updatedAt || 0)
  );
  for (const k of keys.slice(0, keys.length - 200)) delete staticData.sessions[k];
}

return [
  {
    json: {
      ok: true,
      sessionId: ctx.sessionId,
      action,
      target,
      openLink: intent.openLink === true,
      openExternal: intent.openExternal === true,
      url: intent.url ? String(intent.url) : "",
      reply,
      spoken: reply,
      extractedFields: intent.extractedFields || {},
      fillMode: intent.fillMode ?? null,
      endSession: intent.endSession === true,
      heardAs: intent.heardAs ? String(intent.heardAs) : "",
      remember: intent.remember || {},
      via,
      payload: {
        openLink: intent.openLink === true,
        openExternal: intent.openExternal === true,
        url: intent.url || undefined,
        click: true,
        fields: intent.extractedFields || undefined,
        heardAs: intent.heardAs || undefined,
        remember: intent.remember || undefined,
      },
    },
  },
];
