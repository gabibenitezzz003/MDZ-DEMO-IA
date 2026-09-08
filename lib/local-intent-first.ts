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

  const isExplain = /explic|contame|que es|para que/.test(text);
  if (isExplain) return "explain";

  const isNavigate =
    /(llevame|lleveme|mostrame|muestrame|muestreme|anda a|ir a|abrime|abri |abre |redirigi|quiero ver|mandame|manda me|mandar a|pasame a|tirame a|sacame a)\b/.test(
      text
    ) ||
    /\b(podria?s?|podes|pudieras)\b.*\b(llevar|mostrar|mandar|pasar|ir|abrir|ver)\b/.test(
      text
    ) ||
    /\b(me podria?s?|me podes|me pudieras)\b/.test(text);
  if (isNavigate) return "navigate";

  if (
    /(^|\s)(que|cual|como|cuando|donde|por que|para que|quien)\b/.test(text) ||
    raw.includes("?")
  ) {
    return "ask";
  }
  return "command";
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

/**
 * Atajo ANTES de consultar al modelo: casos de alta confianza.
 * Ahora es conservador: solo se usa cuando la intención es obvia y local.
 * Todo lo demás pasa a Gemini para mantener hilo y contexto.
 */
export function shouldPreferLocalRules(
  text: string,
  raw: string,
  intent: AssistantIntent
): boolean {
  if (shouldOverrideModel(text, raw)) return true;
  if (wantsRutWhatsAppHandoff(text) || wantsRutWhatsAppHandoff(raw)) return true;
  if (wantsRutNavigate(text) || wantsRutNavigate(raw)) return true;

  // Preguntas y explicaciones complejas las dejamos para Gemini.
  const mode = classifyConversationMode(raw);
  if (mode === "ask" || mode === "explain") return false;

  // Solo navegaciones muy explícitas y con score alto.
  const hits = findBestSections(text, 1);
  const best = hits[0];
  if (
    best &&
    best.score >= 7 &&
    intent.understood === true &&
    intent.target === best.id &&
    ["navigate", "highlight"].includes(intent.action)
  ) {
    return true;
  }

  // Comando directo de navegación: "llevame a X".
  if (
    best &&
    best.score >= 6 &&
    /(llevame|lleveme|mostrame|muestrame|quiero ver|ir a|mandame|pasame a|tirame a)/.test(
      text
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Cuándo DESCARTAR una respuesta que el modelo ya produjo.
 * Solo para casos inequívocos: saludo, mic check, eco de voz.
 */
export function shouldOverrideModel(text: string, raw: string): boolean {
  if (wantsSimpleGreeting(text)) return true;
  if (wantsListeningCheck(text)) return true;
  if (isRutSttHomophone(text) || isRutSttHomophone(raw)) return true;
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
        "Muy bien, te llevo a la sección del RUT. Ahí ves de qué se trata el Registro Único de Tierras. Si querés registrarte, decime y te abro WhatsApp.",
    };
  }

  const rules = interpretUtterance(text);

  // Si interpretUtterance no entendió, no forzamos una respuesta local.
  if (rules.understood === false) return null;

  const mode = classifyConversationMode(raw);

  // Preguntas y explicaciones que el catálogo resolvería como una navegación
  // simple las dejamos para Gemini, que tiene historial y puede dar una
  // respuesta contextual y completa. Las descripciones concretas (facts, ayuda)
  // siguen resolviéndose localmente.
  if (
    (mode === "ask" || mode === "explain") &&
    rules.target &&
    ["navigate", "highlight"].includes(rules.action)
  ) {
    return null;
  }

  if (shouldPreferLocalRules(text, raw, rules)) return rules;
  if (
    rules.understood === true &&
    ["go_home", "go_back", "go_forward", "scroll"].includes(rules.action)
  ) {
    return rules;
  }
  return null;
}
