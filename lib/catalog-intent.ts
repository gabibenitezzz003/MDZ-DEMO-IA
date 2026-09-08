import type { AssistantIntent } from "@/lib/demo-assistant";
import {
  classifyConversationMode,
  type ConversationMode,
} from "@/lib/local-intent-first";
import { findBestSections, officialUrlFor, wantsOpenLink } from "@/lib/page-knowledge";
import { buildSectionGuide } from "@/lib/section-guide";
import { wantsAnyExplain } from "@/lib/page-question";
import {
  wantsRutDemoWizard,
  wantsRutWhatsAppHandoff,
} from "@/lib/whatsapp-rut";

const NAVIGATE_VERBS =
  /(llevame|lleveme|llevar|mostrar|mostrame|muestrame|muestreme|mandame|mandar|pasame|ir a|quiero ver|anda a|abrime|abri |abre |redirigi|tirame a|sacame a|parte de|me podrias|me podes|me pudieras|podrias llevar|podes llevar)/;

/** Resuelve pedidos sobre cualquier sección del catálogo sin llamar al LLM. */
export function resolveCatalogIntent(
  text: string,
  raw: string,
  opts: {
    lastSectionId?: string;
    contextSectionId?: string;
    namedSectionId?: string;
    namesSection?: boolean;
    namedScore?: number;
  }
): AssistantIntent | null {
  if (
    wantsRutWhatsAppHandoff(raw) ||
    wantsRutWhatsAppHandoff(text) ||
    wantsRutDemoWizard(raw) ||
    wantsRutDemoWizard(text)
  ) {
    return null;
  }

  const mode = classifyConversationMode(raw);
  const openLink = wantsOpenLink(raw);

  // Explicaciones y preguntas abiertas → cerebro (Gemini/n8n), no plantillas locales.
  if (wantsAnyExplain(raw)) {
    return null;
  }

  const hits = findBestSections(text, 3);
  const best = hits[0];
  if (!best) return null;

  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  const strongName =
    opts.namesSection &&
    opts.namedSectionId &&
    (opts.namedScore ?? 0) >= 8 &&
    best.id === opts.namedSectionId;

  const questionLike =
    mode === "ask" ||
    mode === "explain" ||
    /\b(que|cual|como|para que|donde|por que|sirve|significa)\b/.test(norm);

  // Solo navegaciones directas y muy claras se resuelven por catálogo.
  // Preguntas y explicaciones pasan al modelo salvo pedido explícito de ir/mostrar.
  const scoreOk =
    !questionLike &&
    (strongName ||
      best.score >= 8 ||
      (mode === "navigate" && best.score >= 5 && NAVIGATE_VERBS.test(norm)));

  if (!scoreOk) return null;

  const guide = buildSectionGuide(best.id);
  const spoken =
    guide?.spoken ??
    best.spoken ??
    `Muy bien, te llevo a ${best.title}.`;
  if (openLink) {
    const url = best.externalUrl || officialUrlFor(best.id);
    return {
      action: "open_external",
      target: String(url),
      understood: true,
      useGuide: false,
      payload: {
        sectionId: best.id,
        url: String(url),
        openLink: true,
        redirect: true,
        click: true,
      },
      reply: `${spoken} Te abrí el recurso oficial en otra pestaña; yo sigo acá.`,
    };
  }
  return {
    action: "navigate",
    target: best.id,
    understood: true,
    useGuide: false,
    payload: {
      openLink,
      click: true,
      url: best.externalUrl || officialUrlFor(best.id),
      related: hits.slice(1).map((h) => h.title),
    },
    reply: `${spoken} Si querés el enlace oficial, decime «abrime el sitio oficial».`,
  };
}

export function shouldSkipBrain(mode: ConversationMode, score: number): boolean {
  return (
    (mode === "navigate" && score >= 6) ||
    (mode === "explain" && score >= 5) ||
    (mode === "ask" && score >= 5)
  );
}
