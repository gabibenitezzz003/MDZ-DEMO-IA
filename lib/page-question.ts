import { findBestSections } from "@/lib/page-knowledge";

function normalizePageQuestion(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wantsPageLocation(raw: string) {
  const text = normalizePageQuestion(raw);
  return /(donde estoy|en que (pagina|seccion)|que estoy viendo|donde me dejaste|en que seccion me dejaste)/.test(
    text
  );
}

export function wantsExplainCurrentPage(raw: string) {
  const text = normalizePageQuestion(raw);
  return /(explicame (esto|esta|aca|aqui|la pagina|esta pagina)|que es (esto|esta seccion|esta pagina)|contame (de )?esto|que hay aca|que hay aqui)/.test(
    text
  );
}

/** Referencia para tests: preguntas abiertas sobre la demo (las resuelve Gemini, no reglas locales). */
export function wantsPageCapabilities(raw: string) {
  const text = normalizePageQuestion(raw);
  return (
    /\b(que puedo hacer|que se puede hacer|que hay para hacer|que opciones hay|que funciones tiene)\b/.test(
      text
    ) ||
    /\b(para que sirve|que ofrece|que hace)\b.{0,28}\b(esta pagina|la pagina|esta demo|el sitio|aca|aqui|portal)\b/.test(
      text
    ) ||
    /\b(explic\w*|decime|contame)\b.{0,36}\b(que puedo|que se puede)\b/.test(
      text
    ) ||
    /\b(como funciona|como uso)\b.{0,24}\b(esta pagina|la demo|el asistente|esta web)\b/.test(
      text
    ) ||
    /\b(en que me podes ayudar|en que me puedes ayudar|como me ayudas)\b/.test(
      text
    )
  );
}

export function wantsPreviousSection(raw: string) {
  const text = normalizePageQuestion(raw);
  return /\b(anterior|previo|tema anterior|seccion anterior|la anterior|el anterior|volve(r)?\s+a\s+(eso|lo\s+anterior|la\s+anterior))\b/.test(
    text
  );
}

/** Seguimiento corto: "explicamelo", "contame más" tras hablar de una sección. */
export function wantsExplainFollowUp(raw: string) {
  const text = normalizePageQuestion(raw);
  return (
    /^(explicame(lo|la|le|los|las)|contame( lo| mas|me)?|ampliame|desarrollame|mas info)\b/.test(
      text
    ) ||
    /\b(que hace eso|para que es eso|y eso que es|explicame mas|contame mas)\b/.test(
      text
    ) ||
    /\b(si|dale|ok|vale|claro|por favor|si por favor)\b.*\b(explic\w*|contame|decime)\b/.test(
      text
    ) ||
    /\b(que me expliques|me lo expliques|seguir explicando)\b/.test(text)
  );
}

/** Pide explicación de una sección nombrada: "explicame qué hace frutos secos". */
export function wantsExplainNamedSection(raw: string) {
  const text = normalizePageQuestion(raw);
  return (
    /explic(ame|a|eme).{0,40}(que hace|para que|que es|como funciona)/.test(
      text
    ) ||
    /(que hace|para que sirve|que es).{0,40}(seccion|parte|bloque|zona)/.test(
      text
    )
  );
}

export function wantsAnyExplain(raw: string) {
  return (
    wantsExplainCurrentPage(raw) ||
    wantsExplainFollowUp(raw) ||
    wantsExplainNamedSection(raw)
  );
}

export function resolveExplainSectionId(
  raw: string,
  opts: {
    contextSectionId?: string;
    lastSectionId?: string;
    namedSectionId?: string;
    namesSection?: boolean;
  }
): string | undefined {
  if (opts.namesSection && opts.namedSectionId && opts.namedSectionId !== "rut") {
    if (
      wantsExplainNamedSection(raw) ||
      wantsExplainFollowUp(raw) ||
      wantsExplainCurrentPage(raw) ||
      findBestSections(raw, 1)[0]?.id === opts.namedSectionId
    ) {
      return opts.namedSectionId;
    }
  }

  if (wantsExplainNamedSection(raw)) {
    const hit = findBestSections(raw, 1)[0];
    if (hit && hit.score >= 4 && hit.id !== "rut") return hit.id;
  }

  if (
    wantsExplainFollowUp(raw) ||
    wantsExplainCurrentPage(raw) ||
    wantsPageLocation(raw)
  ) {
    return opts.contextSectionId || opts.lastSectionId;
  }

  return undefined;
}

export function hadRecentExplainAsk(
  turns: Array<{ role: "user" | "assistant"; text: string }>
): boolean {
  let explainTurns = 0;
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn.role === "assistant") continue;
    if (wantsAnyExplain(turn.text) || wantsPageLocation(turn.text)) {
      explainTurns += 1;
      if (explainTurns >= 2) return true;
      continue;
    }
    break;
  }
  return false;
}
