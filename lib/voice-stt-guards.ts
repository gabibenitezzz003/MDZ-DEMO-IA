export function estimateSpeechMs(text: string) {
  return Math.max(2500, Math.min(28000, 900 + text.trim().length * 70));
}

export function normalizeHeard(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "al",
  "y",
  "o",
  "que",
  "me",
  "te",
  "se",
  "por",
  "para",
  "con",
  "en",
  "a",
  "es",
  "dale",
  "hola",
]);

function contentWords(text: string) {
  return text.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

const LISTED_OPTION =
  /^(el |la |un |una )?(rut|root|ruth|rod|rued|qr|odk|cultivo|mapas?|clima)$/;

/** Verbos/pedidos del usuario al INICIO de la frase — el eco del TTS no los usa así. */
const USER_INTENT =
  /\b(quiero|llevame|mostrame|mostra|abrim(e|elo|e)?|abrir|parar|stop|donde|siguiente|continua|espera|cambiar|necesito|decime|contame|frenar|silencio|ir a|dale)\b/;

const WHATSAPP_INTENT =
  /\b(abri(r|me|melo)?|quiero|necesito|mandame|pasame|llevame|mostrame)\b.{0,28}\b(whatsapp|wsp)\b|\b(whatsapp|wsp)\b.{0,16}\b(rut|root|registro)\b/;

export function hasUserIntent(heard: string) {
  const t = normalizeHeard(heard);
  return USER_INTENT.test(t) || WHATSAPP_INTENT.test(t);
}

/** El usuario arranca con un verbo de pedido (tolera muletillas al inicio). */
export function startsWithUserCommand(heard: string) {
  const t = normalizeHeard(heard);
  return /^(eh+|mm+|a+|o+|um+ )?(quiero|llevame|mostrame|abrime|abri|abrir|parar?|para|stop|dale|necesito|decime|contame|frenar|silencio|demo|donde|siguiente|continua|espera|esperá|no|che|a ver)\b/.test(
    t
  );
}

/** Comandos cortos de corte — válidos aunque sean breves. */
export function isShortBargeCommand(heard: string) {
  const t = normalizeHeard(heard);
  return /^(parar?|para|stop|silencio|frenar|basta|dale|espera|esperá|no|che)\b/.test(t);
}

/** Quita muletillas de corte al inicio ("parar llevame…" → "llevame…"). */
export function normalizeBargeUtterance(heard: string) {
  const t = normalizeHeard(heard);
  return t.replace(/^(parar|stop|silencio|frenar|basta|dale)\s+/, "").trim();
}

/** Solo pidió que pare, todavía no hizo la pregunta nueva. */
export function isBargeStopOnly(heard: string) {
  const t = normalizeHeard(heard);
  return isShortBargeCommand(t) && !normalizeBargeUtterance(heard);
}

/** STT repite o parafrasea lo que acaba de decir el asistente (eco del parlante). */
export function isParaphraseOfAssistant(heard: string, spoken: string) {
  const aw = contentWords(normalizeHeard(heard));
  const bw = contentWords(normalizeHeard(spoken));
  if (aw.length < 4 || bw.length < 5) return false;
  const setB = new Set(bw);
  let hit = 0;
  for (const w of aw) if (setB.has(w)) hit += 1;
  if (hit >= 4 && hit / aw.length >= 0.5) return true;
  return false;
}

/**
 * ¿Procesar este transcript como voz del usuario?
 * Centraliza anti-eco para no cortar TTS ni disparar "Pensando…" fantasma.
 */
export function shouldAcceptVoiceTranscript(
  heard: string,
  spoken: string,
  opts?: { fromBarge?: boolean; inEchoGuard?: boolean }
) {
  const t = heard.trim();
  if (!t) return false;

  if (looksLikeEcho(t, spoken) || isParaphraseOfAssistant(t, spoken)) {
    return false;
  }

  if (opts?.fromBarge) return true;

  if (opts?.inEchoGuard && !hasUserIntent(t) && !startsWithUserCommand(t)) {
    return false;
  }

  if (!opts?.fromBarge) {
    if (isParaphraseOfAssistant(t, spoken)) return false;
    if (!startsWithUserCommand(t) && !hasUserIntent(t)) {
      const aw = contentWords(normalizeHeard(t));
      const bw = contentWords(normalizeHeard(spoken));
      if (aw.length >= 3 && bw.length >= 5) {
        const setB = new Set(bw);
        let hit = 0;
        for (const w of aw) if (setB.has(w)) hit += 1;
        if (hit / aw.length >= 0.4) return false;
      }
    }
  }

  return true;
}

/**
 * Eco del TTS: el micrófono atrapa una palabra que el asistente acaba de listar
 * ("RUT", "QR") o casi la misma frase. Un pedido con verbo no se bloquea.
 */
export function looksLikeEcho(heard: string, spoken: string) {
  const a = normalizeHeard(heard);
  const b = normalizeHeard(spoken);
  if (!a || !b) return false;

  // Cualquier fragmento de 2+ palabras que ya dijo el asistente.
  const heardWords = a.split(/\s+/).filter((w) => w.length > 1);
  if (heardWords.length >= 2 && b.includes(a)) {
    return true;
  }

  if (LISTED_OPTION.test(a) && b.includes(a.split(" ").pop() || a)) {
    return true;
  }

  // Eco de nombres de sección al final de una explicación ("fruticultura", "economía regional").
  if (a.length >= 8 && a.length <= 48 && b.includes(a)) {
    return true;
  }

  if (a.length < 6) return false;
  if (a === b) return true;

  // Frases cortas del usuario casi nunca son eco completo.
  if (a.length < 18 && !b.includes(a)) return false;

  if (b.includes(a) && a.length >= 12) return true;
  if (a.includes(b) && b.length >= 18) return true;

  const aw = contentWords(a);
  const bw = contentWords(b);
  if (aw.length < 3) return false;
  const setB = new Set(bw);
  let hit = 0;
  for (const w of aw) if (setB.has(w)) hit += 1;
  return hit / aw.length >= 0.85 && hit >= 3;
}

export function isNearDuplicateHeard(aRaw: string, bRaw: string) {
  const a = normalizeHeard(aRaw);
  const b = normalizeHeard(bRaw);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10 && (a.includes(b) || b.includes(a))) {
    return true;
  }
  const aw = contentWords(a);
  const bw = contentWords(b);
  if (!aw.length || !bw.length) return false;
  const setB = new Set(bw);
  let hit = 0;
  for (const w of aw) if (setB.has(w)) hit += 1;
  return hit / Math.max(aw.length, bw.length) >= 0.85;
}

export function shouldCutSpeechOnInterim(live: string, spoken: string) {
  return shouldStopTtsOnInterim(live, spoken);
}

/** Cortar TTS al instante: cualquier voz nueva que no sea eco del parlante. */
export function shouldStopTtsOnInterim(live: string, spoken: string) {
  const t = normalizeHeard(live);
  if (t.length < 3) return false;
  if (looksLikeEcho(t, spoken) || isParaphraseOfAssistant(t, spoken)) return false;
  const spokenNorm = normalizeHeard(spoken);
  if (spokenNorm.includes(t) && t.length <= 40) return false;
  return true;
}

/** Interrupción por voz: lo que diga el usuario y no sea eco/paráfrasis del TTS. */
export function isLikelyUserBargeIn(heard: string, spoken: string) {
  const t = heard.trim();
  if (normalizeHeard(t).length < 3) return false;
  if (looksLikeEcho(t, spoken) || isParaphraseOfAssistant(t, spoken)) {
    return false;
  }
  return true;
}
