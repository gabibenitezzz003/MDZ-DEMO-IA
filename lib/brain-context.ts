import fs from "node:fs";
import path from "node:path";
import type { ClientPageContext } from "@/lib/page-context";
import { formatPageContext } from "@/lib/page-context";
import type { ChatTurn } from "@/lib/gemini-brain";
import { buildSectionGuide } from "@/lib/section-guide";
import { isEngineeringPath } from "@/lib/engineering-qa";

export type BrainContextInput = {
  text: string;
  originalText: string;
  history: ChatTurn[];
  lastSectionId?: string;
  pageContext?: ClientPageContext | null;
  pendingFields?: Record<string, string>;
  rutMode?: string;
  facts?: Record<string, string>;
};

let cachedSiteMap: string | null = null;
let cachedDeepTopics: string | null = null;

/** Conocimiento estático de la demo (mapa del sitio, FAQs). No depende del texto del usuario. */
export function loadSiteMapKnowledge(maxChars = 5_000): string {
  if (cachedSiteMap !== null) {
    return cachedSiteMap.slice(0, maxChars);
  }
  try {
    const file = path.join(process.cwd(), "content/knowledge/mapa-del-sitio.md");
    cachedSiteMap = fs.readFileSync(file, "utf8");
  } catch {
    cachedSiteMap = "";
  }
  return cachedSiteMap.slice(0, maxChars);
}

export function loadDeepTopicsKnowledge(maxChars = 6_000): string {
  if (cachedDeepTopics !== null) {
    return cachedDeepTopics.slice(0, maxChars);
  }
  try {
    const file = path.join(
      process.cwd(),
      "content/knowledge/temas-profundos.md"
    );
    cachedDeepTopics = fs.readFileSync(file, "utf8");
  } catch {
    cachedDeepTopics = "";
  }
  return cachedDeepTopics.slice(0, maxChars);
}

function activeSectionId(input: BrainContextInput): string | undefined {
  return (
    input.pageContext?.sectionId ||
    input.lastSectionId ||
    (input.pageContext?.pathname?.startsWith("/rut") ? "rut" : undefined) ||
    (isEngineeringPath(input.pageContext?.pathname) ? "ingenieria" : undefined)
  );
}

/** Contexto enriquecido para Gemini / n8n: página, sección, mapa y hechos de sesión. */
export function buildBrainUserPrompt(input: BrainContextInput): string {
  const sectionId = activeSectionId(input);
  const guide = sectionId ? buildSectionGuide(sectionId) : null;
  const pending = Object.keys(input.pendingFields || {}).length
    ? JSON.stringify(input.pendingFields)
    : "{}";
  const facts = Object.keys(input.facts || {}).length
    ? JSON.stringify(input.facts)
    : "{}";

  return [
    `SECCIÓN ACTUAL O ÚLTIMA: ${input.lastSectionId || "ninguna"}.`,
    `CONTEXTO DE PÁGINA: ${formatPageContext(input.pageContext)}.`,
    guide
      ? `GUÍA DE LA SECCIÓN VISIBLE (${guide.sectionId}): ${guide.spoken}`
      : "GUÍA DE LA SECCIÓN VISIBLE: (inicio de la demo o sección no identificada).",
    `HECHOS GUARDADOS DE ESTA SESIÓN: ${facts}.`,
    `RUT mode=${input.rutMode || "idle"} | campos pendientes=${pending}.`,
    "",
    "CONOCIMIENTO DEL PORTAL Y LA DEMO:",
    loadSiteMapKnowledge(),
    "",
    "CONTEXTO PARA EXPLICAR TEMAS (usalo en preguntas qué hace / profundizar):",
    loadDeepTopicsKnowledge(),
    "",
    `TEXTO ORIGINAL DEL USUARIO (STT): "${input.originalText}".`,
    `TEXTO CORREGIDO: "${input.text}".`,
    "",
    "INSTRUCCIONES:",
    "- Respondé la pregunta o pedido del usuario usando el historial, la sección visible y el conocimiento del sistema.",
    "- Si preguntan QUÉ HACE o PARA QUÉ SIRVE una sección: explicá contenido, utilidad y contexto mendocino. NO repitas solo «acá está X».",
    "- Si el usuario dice que no lo entendiste o pide explicar mejor: cambiá el enfoque y agregá detalle nuevo; nunca repitas la misma plantilla.",
    "- Preguntas abiertas ('¿qué puedo hacer acá?', '¿para qué sirve esto?', dudas generales): explicá con datos concretos del mapa y la sección.",
    "- Si el usuario dice 'sí', 'dale' o 'vale', respondé a TU ÚLTIMA OFERTA en el historial.",
    "- 'No profundicemos' / cambio de tema: cerrá el tema actual y ofrecé otras áreas concretas.",
    "- Profundizá en la sección actual cuando pidan más detalle; no repitas solo la introducción.",
    "- Saludo suelto → describe, sin navegar ni abrir RUT.",
    "- Pedido claro de ir a un bloque → navigate + explicación breve.",
    "- 'abrí el oficial' / recurso oficial → open_external con URL del catálogo.",
    "- RUT registro por WhatsApp (no wizard) → open_whatsapp. Wizard demo → open_rut o navigate rut.",
    "- STT: root/ruth/rod/rued = RUT en trámite; dirico/idrico = hídrico; abajo = ajo; ciruelo = ciruela.",
    "- Podés inferir conocimiento general agrícola de Mendoza si ayuda a responder; no inventes leyes ni cifras oficiales.",
    "- Si falta un dato puntual, decilo con honestidad y ofrecé la sección o trámite relacionado.",
  ].join("\n");
}

/** Último recurso si Gemini/n8n no responden: usa mapa + sección, sin matchear frases del usuario. */
export function buildKnowledgeFallback(input: BrainContextInput): string {
  const sectionId = activeSectionId(input);
  const guide = sectionId ? buildSectionGuide(sectionId) : null;
  const bits: string[] = [];

  if (guide) {
    bits.push(`${guide.spoken}`);
  }

  bits.push(
    "Contame qué querés saber y te explico con detalle: cultivos, trámites, clima, precios o el RUT."
  );

  if (!process.env.GEMINI_API_KEY?.trim()) {
    bits.push(
      "Nota: el cerebro inteligente necesita GEMINI_API_KEY en el servidor para responder cualquier consulta con más detalle."
    );
  }

  return bits.join(" ");
}
