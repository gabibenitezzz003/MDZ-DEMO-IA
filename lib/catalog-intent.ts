import type { AssistantIntent } from "@/lib/demo-assistant";
import {
  classifyConversationMode,
  type ConversationMode,
} from "@/lib/local-intent-first";
import { findBestSections, officialUrlFor, wantsOpenLink } from "@/lib/page-knowledge";
import { buildExplainReply, buildSectionGuide } from "@/lib/section-guide";
import {
  wantsAnyExplain,
  wantsExplainFollowUp,
  resolveExplainSectionId,
} from "@/lib/page-question";

const NAVIGATE_VERBS =
  /(llevame|lleveme|mostrame|muestrame|muestreme|mandame|mandar|pasame|ir a|quiero ver|anda a|abrime|abri |abre |redirigi|tirame a|sacame a)/;

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
  const mode = classifyConversationMode(raw);
  const openLink = wantsOpenLink(raw);
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  if (wantsAnyExplain(raw)) {
    const sectionId = resolveExplainSectionId(raw, {
      contextSectionId: opts.contextSectionId,
      lastSectionId: opts.lastSectionId,
      namedSectionId: opts.namedSectionId,
      namesSection: opts.namesSection,
    });
    if (sectionId) {
      return {
        action: "describe",
        target: sectionId,
        understood: true,
        useGuide: false,
        payload: { openLink: false, click: true },
        reply: buildExplainReply(sectionId),
      };
    }
  }

  const hits = findBestSections(text, 3);
  const best = hits[0];
  if (!best) return null;

  const strongName =
    opts.namesSection &&
    opts.namedSectionId &&
    (opts.namedScore ?? 0) >= 7 &&
    best.id === opts.namedSectionId;

  const scoreOk =
    strongName ||
    best.score >= (mode === "navigate" ? 6 : 5) ||
    (best.score >= 4 && NAVIGATE_VERBS.test(norm));

  if (!scoreOk) return null;

  if (mode === "ask" || mode === "explain") {
    if (best.id === "odk-collect" && /qr|odk|collect/.test(norm)) {
      const guide = buildSectionGuide(best.id);
      return {
        action: "navigate",
        target: best.id,
        understood: true,
        useGuide: false,
        payload: { openLink: false, click: true },
        reply:
          guide?.spoken ??
          "El QR de ODK es para ingeniería: Collect, formularios y tablero técnico.",
      };
    }
    return {
      action: "describe",
      target: best.id,
      understood: true,
      useGuide: false,
      payload: { openLink: false, click: true },
      reply: buildExplainReply(best.id),
    };
  }

  if (mode === "navigate" || mode === "command" || NAVIGATE_VERBS.test(norm)) {
    const guide = buildSectionGuide(best.id);
    const spoken =
      guide?.spoken ??
      best.spoken ??
      `Dale, te llevo a ${best.title}.`;
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
      reply: openLink
        ? `${spoken} Te abrí el recurso oficial en otra pestaña; yo sigo acá.`
        : `${spoken} Si querés el enlace oficial, decime «abrime el sitio oficial».`,
    };
  }

  if (wantsExplainFollowUp(raw) && opts.lastSectionId) {
    return {
      action: "describe",
      target: opts.lastSectionId,
      understood: true,
      useGuide: false,
      payload: { openLink: false, click: true },
      reply: buildExplainReply(opts.lastSectionId, { repeat: true }),
    };
  }

  return null;
}

export function shouldSkipBrain(mode: ConversationMode, score: number): boolean {
  return (
    (mode === "navigate" && score >= 6) ||
    (mode === "explain" && score >= 5) ||
    (mode === "ask" && score >= 5)
  );
}
