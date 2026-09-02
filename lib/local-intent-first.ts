import type { AssistantIntent } from "@/lib/demo-assistant";
import { interpretUtterance } from "@/lib/demo-assistant";
import type { ChatTurn } from "@/lib/gemini-brain";
import { greetingReply } from "@/lib/greeting-reply";
import { wantsListeningCheck, wantsSimpleGreeting } from "@/lib/intent-guards";
import { findBestSections } from "@/lib/page-knowledge";
import {
  buildWhatsAppRutUrl,
  isRutSttHomophone,
  wantsRutNavigate,
  wantsRutWhatsAppHandoff,
  whatsAppRutSpoken,
} from "@/lib/whatsapp-rut";

function recentUserText(history: ChatTurn[], n = 4) {
  return history
    .filter((t) => t.role === "user")
    .slice(-n)
    .map((t) => t.text)
    .join(" ");
}

export type ConversationMode =
  | "ask"
  | "navigate"
  | "register"
  | "explain"
  | "command";

function normalizeIntentText(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyConversationMode(raw: string): ConversationMode {
  const text = normalizeIntentText(raw);
  if (wantsRutWhatsAppHandoff(raw)) return "register";
  if (
    /(llevame|lleveme|mostrame|muestrame|muestreme|anda a|ir a|abrime|abri |abre |redirigi|quiero ver)/.test(
      text
    )
  ) {
    return "navigate";
  }
  if (
    /(^|\s)(que|cual|como|cuando|donde|por que|para que|quien)\b/.test(text) ||
    raw.includes("?")
  ) {
    return /explic|contame|que es|para que/.test(text) ? "explain" : "ask";
  }
  return "command";
}

function withoutNavigationClaim(reply: string) {
  return reply
    .replace(
      /\s*Te abr[ií] (?:el recurso|el sitio|la p[aá]gina) oficial en otra pestaña;? yo sigo ac[aá]\.?/gi,
      ""
    )
    .replace(/\s*Te (?:llevo|llev[eé]) (?:ahora|ah[ií])\.?/gi, "")
    .trim();
}

/** Seguimiento corto tras hablar de RUT: "Rod" → RUT. */
export function resolveRutFollowUp(
  text: string,
  history: ChatTurn[]
): AssistantIntent | null {
  if (!isRutSttHomophone(text)) return null;
  const recent = recentUserText(history).toLowerCase();
  const wa = buildWhatsAppRutUrl();
  if (/registr|whatsapp|inscrib|tramite/.test(recent)) {
    return {
      action: "open_whatsapp",
      target: wa || undefined,
      understood: true,
      payload: {
        alsoNavigate: true,
        sectionId: "rut",
        whatsappUrl: wa || undefined,
      },
      reply: whatsAppRutSpoken(Boolean(wa)),
    };
  }
  return {
    action: "navigate",
    target: "rut",
    understood: true,
    payload: { openLink: false, click: true },
    reply:
      "Te marco la sección del RUT. Si querés registrarte, decime y te abro WhatsApp.",
  };
}

export function shouldPreferLocalRules(
  text: string,
  raw: string,
  intent: AssistantIntent
): boolean {
  if (wantsSimpleGreeting(text)) return true;
  if (wantsListeningCheck(text)) return true;
  if (wantsRutWhatsAppHandoff(text) || wantsRutWhatsAppHandoff(raw)) return true;
  if (wantsRutNavigate(text) || wantsRutNavigate(raw)) return true;
  if (isRutSttHomophone(text) || isRutSttHomophone(raw)) return true;

  const hits = findBestSections(text, 1);
  const best = hits[0];
  if (
    best &&
    best.score >= 4 &&
    intent.understood !== false &&
    intent.target === best.id &&
    ["navigate", "highlight", "describe"].includes(intent.action)
  ) {
    return true;
  }
  if (
    best &&
    best.score >= 4 &&
    /(llevame|lleveme|mostrame|muestrame|quiero ver|ir a|parte de|seccion|zona de)/.test(
      text
    )
  ) {
    return true;
  }

  if (
    /hola|buenas|como estas|como andas/.test(text) &&
    !wantsSimpleGreeting(text) &&
    intent.action === "describe" &&
    /te ayudo|asistente de agricultura|que necesit/.test(intent.reply)
  ) {
    return true;
  }

  return false;
}

/** Reglas locales de alta confianza (sin Gemini). */
export function resolveLocalIntent(
  text: string,
  raw: string,
  history: ChatTurn[]
): AssistantIntent | null {
  if (wantsSimpleGreeting(text) || wantsSimpleGreeting(raw)) {
    return {
      action: "describe",
      understood: true,
      useGuide: false,
      reply: greetingReply(raw || text),
    };
  }

  const follow = resolveRutFollowUp(text, history);
  if (follow) return follow;

  if (wantsRutWhatsAppHandoff(text) || wantsRutWhatsAppHandoff(raw)) {
    const wa = buildWhatsAppRutUrl();
    return {
      action: "open_whatsapp",
      target: wa || undefined,
      understood: true,
      payload: {
        alsoNavigate: true,
        sectionId: "rut",
        whatsappUrl: wa || undefined,
      },
      reply: whatsAppRutSpoken(Boolean(wa)),
    };
  }

  if (wantsRutNavigate(text) || wantsRutNavigate(raw)) {
    const wa = buildWhatsAppRutUrl();
    const registro = /registr|inscrib|whatsapp|wsp|tramite/.test(text);
    if (registro) {
      return {
        action: "open_whatsapp",
        target: wa || undefined,
        understood: true,
        payload: {
          alsoNavigate: true,
          sectionId: "rut",
          whatsappUrl: wa || undefined,
        },
        reply: whatsAppRutSpoken(Boolean(wa)),
      };
    }
    return {
      action: "navigate",
      target: "rut",
      understood: true,
      payload: { openLink: false, click: true },
      reply:
        "Dale, te llevo a la sección del RUT. Ahí ves de qué se trata el Registro Único de Tierras. Si querés registrarte, te abro WhatsApp con el agente.",
    };
  }

  const rules = interpretUtterance(text);
  const mode = classifyConversationMode(raw);
  if (
    (mode === "ask" || mode === "explain") &&
    rules.target &&
    ["navigate", "highlight"].includes(rules.action)
  ) {
    return {
      ...rules,
      action: "describe",
      reply: withoutNavigationClaim(rules.reply),
      payload: { ...(rules.payload ?? {}), openLink: false, click: true },
    };
  }
  if (shouldPreferLocalRules(text, raw, rules)) return rules;
  if (rules.understood !== false && rules.action === "describe") return rules;
  if (
    rules.understood !== false &&
    ["go_home", "go_back", "go_forward", "scroll"].includes(rules.action)
  ) {
    return rules;
  }
  return null;
}
