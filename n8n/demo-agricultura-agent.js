/**
 * Cuerpo del nodo Code "Agente Gemini" — regenerar con:
 *   node n8n/sync-demo-agricultura-workflow.mjs
 *
 * Placeholder __SITE_MAP_KNOWLEDGE__ se reemplaza al sincronizar.
 */
const SITE_MAP = `__SITE_MAP_KNOWLEDGE__`;

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
  -20
);
const facts = { ...(prev.facts || {}), ...(body.facts || {}) };
const pendingFields = {
  ...(prev.pendingFields || {}),
  ...(body.pendingFields || {}),
};
const lastSectionId = String(body.lastSectionId || prev.lastSectionId || "");
const rutMode = String(body.rutMode || prev.rutMode || "idle");
const pageContext = body.pageContext || {};
const model =
  String(body.model || "gemini-3.6-flash").trim() || "gemini-3.6-flash";
const apiKey =
  String(body.geminiApiKey || $env.GEMINI_API_KEY || "").trim();

const SOURCE_URL =
  "https://sitios.mendoza.gob.ar/produccion/direccion-de-agricultura/";

const systemPrompt = `Sos el asistente de voz de la DEMO del portal de la Dirección de Agricultura de Mendoza.
Hablás en español rioplatense claro y profesional (voseo natural, tono de funcionario público cercano).
Respondé preguntas abiertas con el conocimiento del sistema — no digas "no te entendí" si podés inferir del contexto.

## Qué podés hacer
- Navegar la demo a cualquier sección (action=navigate + target=id).
- Explicar cultivos, trámites, herramientas, precios, clima (action=describe).
- Abrir el sitio oficial en otra pestaña (action=open_external, openLink=true).
- RUT por WhatsApp (action=open_whatsapp) o wizard demo (action=open_rut).
- Seguir el hilo: "sí"/"dale" responde a tu última oferta del historial.

## Reglas
- 1-3 oraciones útiles. Variá acuses (Muy bien, Perfecto, Listo).
- No inventes leyes ni datos que no estén en el mapa.
- Esta es una DEMO; el oficial abre en otra pestaña.
- ODK/QR: action=navigate, target=odk-collect (no es link web).
- STT: root/ruth/rod=RUT; abajo=ajo; ciruelo=ciruela.

## Mapa del sitio y conocimiento
${SITE_MAP}

Sitio oficial: ${SOURCE_URL}
SIA RUT: https://sia.mendoza.gov.ar/account/login

Respondé SOLO JSON válido:
{"action":"describe","target":"","openLink":false,"openExternal":false,"url":"","reply":"texto hablado","extractedFields":{},"fillMode":null,"endSession":false,"heardAs":"","remember":{}}`;

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function parseIntent(raw) {
  if (!raw) return null;
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[0]);
    const reply = String(data.reply || "").trim();
    if (!reply) return null;
    return {
      action: String(data.action || "describe"),
      target: data.target ? String(data.target) : undefined,
      openLink: data.openLink === true,
      openExternal: data.openExternal === true,
      url: data.url ? String(data.url) : "",
      reply,
      extractedFields:
        data.extractedFields && typeof data.extractedFields === "object"
          ? data.extractedFields
          : {},
      fillMode: ["auto", "manual", "ask"].includes(data.fillMode)
        ? data.fillMode
        : null,
      endSession: data.endSession === true,
      heardAs: data.heardAs ? String(data.heardAs) : "",
      remember:
        data.remember && typeof data.remember === "object" ? data.remember : {},
    };
  } catch {
    return null;
  }
}

function knowledgeFallback(rawText) {
  const n = normalize(rawText);
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

const http = this.helpers.httpRequest.bind(this.helpers);

async function callGemini(repair) {
  if (!apiKey) return null;

  const ctxBits = [
    `pathname=${pageContext.pathname || "/"}`,
    `hash=${pageContext.hash || "(ninguno)"}`,
    `seccionVisible=${pageContext.sectionId || "(desconocida)"}`,
  ];
  if (pageContext.sectionTitle) ctxBits.push(`titulo=${pageContext.sectionTitle}`);
  if (pageContext.sectionBlurb) ctxBits.push(`resumen=${pageContext.sectionBlurb}`);
  if (pageContext.rutStep) ctxBits.push(`rutPaso=${pageContext.rutStep}`);

  const userPrompt = [
    `SECCIÓN ACTUAL O ÚLTIMA: ${lastSectionId || "ninguna"}.`,
    `CONTEXTO DE PÁGINA: ${ctxBits.join(" | ")}.`,
    `HECHOS DE SESIÓN: ${JSON.stringify(facts)}.`,
    `RUT mode=${rutMode} | campos pendientes=${JSON.stringify(pendingFields)}.`,
    `TEXTO ORIGINAL: "${originalText}".`,
    `TEXTO CORREGIDO: "${text}".`,
    repair
      ? "Tu respuesta anterior no era JSON válido. Devolvé SOLO el JSON del contrato."
      : "Respondé la pregunta o pedido usando historial + mapa. Preguntas abiertas: explicá con ejemplos concretos.",
  ].join("\n");

  const contents = [];
  for (const turn of history.slice(-16)) {
    contents.push({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: String(turn.text || "") }],
    });
  }
  contents.push({ role: "user", parts: [{ text: userPrompt }] });

  const res = await http({
    method: "POST",
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: repair ? 0.15 : 0.45,
        topP: 0.9,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
      },
    },
    json: true,
    timeout: 28000,
  });

  return res?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

let intent = null;
let via = "fallback";

try {
  let raw = await callGemini(false);
  intent = parseIntent(raw);
  if (!intent) {
    raw = await callGemini(true);
    intent = parseIntent(raw);
  }
  if (intent) via = `n8n-${model}`;
} catch {
  intent = null;
}

if (!intent) {
  if (!apiKey) {
    return [
      {
        json: {
          ok: false,
          error:
            "Falta GEMINI_API_KEY en n8n (Variables) o geminiApiKey en el body de Next.js",
        },
      },
    ];
  }
  intent = knowledgeFallback(text);
  via = "fallback-local";
}

for (const [k, v] of Object.entries(intent.remember || {})) {
  const clean = String(v || "").trim();
  if (clean) facts[k] = clean;
}
if (intent.extractedFields && typeof intent.extractedFields === "object") {
  Object.assign(pendingFields, intent.extractedFields);
}

const turns = [
  ...history,
  { role: "user", text },
  { role: "assistant", text: intent.reply },
].slice(-24);

staticData.sessions[sessionId] = {
  turns,
  facts,
  pendingFields,
  lastSectionId:
    intent.target &&
    ["navigate", "describe", "highlight"].includes(intent.action)
      ? intent.target
      : lastSectionId,
  rutMode: intent.action === "open_rut" ? "collecting" : rutMode,
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
      sessionId,
      action: intent.action,
      target: intent.target,
      openLink: intent.openLink === true,
      openExternal: intent.openExternal === true,
      url: intent.url || "",
      reply: intent.reply,
      spoken: intent.reply,
      extractedFields: intent.extractedFields || {},
      fillMode: intent.fillMode,
      endSession: intent.endSession === true,
      heardAs: intent.heardAs || "",
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
