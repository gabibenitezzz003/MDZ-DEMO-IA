import { wantsConversationContinuation } from "@/lib/conversation-follow-up";
import { wantsGuidedTour } from "@/lib/demo-tour";
import { wantsEngineeringTour } from "@/lib/engineering-qa";
import { wantsListeningCheck, wantsSimpleGreeting } from "@/lib/intent-guards";
import { wantsOpenResource } from "@/lib/open-resource";
import { findBestSections } from "@/lib/page-knowledge";
import {
  wantsAnyExplain,
  wantsExplainNamedSection,
  wantsPageCapabilities,
} from "@/lib/page-question";
import {
  wantsRutExplainOnly,
  wantsRutNavigate,
  wantsRutWhatsAppHandoff,
} from "@/lib/whatsapp-rut";

function normalize(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMPLETE_WORDS =
  /^(hola|buenas|si|sí|no|dale|listo|rut|qr|mapas|clima|ayuda|menu|inicio|atras|volver|gracias|chau)$/i;

const COMPLETE_TWO_WORDS =
  /^(hola (como|que)|todo (bien|ok)|me (llamo|escuchas|escucha)|quiero (ir|ver|saber|profundizar|mas|más)|sí (quiero|dale|profundizar)|no (gracias|grasia))\b/i;

/** La frase suena cortada a mitad de pedido (pausa natural del hablante). */
export function looksIncompleteUtterance(raw: string): boolean {
  const t = normalize(raw);
  if (t.length < 4) return true;

  if (wantsSimpleGreeting(raw)) return false;
  if (wantsConversationContinuation(raw)) return false;
  if (wantsAnyExplain(raw) || wantsExplainNamedSection(raw) || wantsPageCapabilities(raw)) {
    return false;
  }
  if (t.length >= 14 && /\b(explic|contame|decime|que hace|que es|para que|profundiz)\b/.test(t)) {
    return false;
  }
  if (wantsRutNavigate(raw) || wantsRutWhatsAppHandoff(raw) || wantsRutExplainOnly(raw)) {
    return false;
  }

  // Frases cortas completas no se marcan.
  if (COMPLETE_WORDS.test(t)) return false;
  if (t.split(" ").filter(Boolean).length === 2 && COMPLETE_TWO_WORDS.test(t)) {
    return false;
  }

  const patterns = [
    /\b(que|qué)\s+(es|hace|sirve|son|hacen)\s*$/,
    /\bme\s+(podrias|podrías|podria|podría|podes|podés)\s*$/,
    /\b(explicar|explicame|contame|decime|mostrame|muestrame)\s+(que|qué|me|sobre|la|el|los|las|un|una)?\s*$/,
    /\b(llevame|lleveme|mostrame|muestrame|mandame|quiero|necesito)\s+(a|al|la|el|me|ver|saber|ir)?\s*$/,
    /\b(seccion|sección|parte|zona|area|área)\s+(de|del|la|el)?\s*$/,
    /\b(informacion|información|datos)\s+(de|del|sobre)?\s*$/,
    /\beh\s*$/,
    /\by\s*$/,
    /\b(o|u)\s*$/,
  ];
  if (patterns.some((p) => p.test(t))) return true;

  // Frase corta sin verbo de pedido claro: suele ser el primer trozo de algo más largo.
  const words = t.split(" ").filter(Boolean);
  if (words.length <= 2 && !COMPLETE_WORDS.test(t)) {
    // Si la frase corta ya mapea a una sección, un tour o una acción clara, no la marcamos incompleta.
    if (findBestSections(raw, 1)[0]?.score >= 6) return false;
    if (
      wantsGuidedTour(raw) ||
      wantsEngineeringTour(raw) ||
      wantsOpenResource(raw) ||
      wantsListeningCheck(raw)
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export function mergeUtterances(previous: string, next: string): string {
  const a = previous.trim();
  const b = next.trim();
  if (!a) return b;
  if (!b) return a;
  if (b.length <= 3 && /^(si|sí|no|y|o|eh|um)$/i.test(b)) return `${a} ${b}`;
  if (/^(si|sí|no|y|o)\b/i.test(b) && a.length > 12) return `${a}, ${b}`;
  return `${a} ${b}`.replace(/\s+/g, " ").trim();
}

export function incompleteContinuePrompt(): string {
  return "Te escucho, seguí con lo que me ibas a preguntar. ¿Qué querés que te explique?";
}
