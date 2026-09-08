import type { AssistantIntent } from "@/lib/demo-assistant";
import type { ChatTurn } from "@/lib/gemini-brain";
import type { PendingOffer } from "@/lib/chat-memory";
import { wantsExplainFollowUp } from "@/lib/page-question";
import { wantsRutExplainOnly } from "@/lib/whatsapp-rut";

function normalize(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lastAssistantTurn(turns: ChatTurn[]): string {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role === "assistant") return turns[i].text;
  }
  return "";
}

/** “Sí explícame”, “contame más”, “sí por favor” tras una explicación previa. */
export function wantsConversationContinuation(raw: string): boolean {
  const t = normalize(raw);
  if (!t) return false;
  if (wantsExplainFollowUp(raw)) return true;
  return (
    /^(si|sip|dale|ok|vale|claro|bueno|perfecto|por favor|si por favor)\b/.test(
      t
    ) &&
    /\b(explic\w*|contame|decime|ampliame|desarrollame|mas info|profundiz|seguir|continua|continuemos)\b/.test(
      t
    )
  );
}

function rutTopicActive(lastSectionId?: string, assistantText?: string) {
  if (lastSectionId === "rut") return true;
  const t = normalize(assistantText || "");
  return /\b(rut|registro unico|registro único|tierras)\b/.test(t);
}

/** Continúa el hilo sobre la última sección sin volver a preguntar “¿de qué?”. */
export function resolveContinuationIntent(
  raw: string,
  opts: {
    lastSectionId?: string;
    turns: ChatTurn[];
    pendingOffer?: PendingOffer;
  }
): AssistantIntent | null {
  if (opts.pendingOffer === "whatsapp_rut" && !wantsExplainFollowUp(raw)) return null;
  if (!wantsConversationContinuation(raw)) return null;

  const assistant = lastAssistantTurn(opts.turns);
  let sectionId = opts.lastSectionId;
  if (!sectionId && rutTopicActive(undefined, assistant)) {
    sectionId = "rut";
  }
  if (!sectionId) return null;

  if (rutTopicActive(sectionId, assistant) || wantsRutExplainOnly(raw)) {
    return {
      action: "navigate",
      target: "rut",
      understood: true,
      useGuide: false,
      payload: { openLink: false, click: true },
      reply:
        "El RUT es el Registro Único de Tierras de Mendoza: declarás fincas y cultivos para acceder a beneficios y trámites. " +
        "Para registrarte te conviene WhatsApp con un agente que valida datos y documentación paso a paso. " +
        "¿Querés que te abra WhatsApp ahora o preferís que te muestre la sección del RUT en la demo?",
    };
  }

  // Seguimientos sobre otras secciones → cerebro (respuesta rica, sin plantilla repetida).
  return null;
}
