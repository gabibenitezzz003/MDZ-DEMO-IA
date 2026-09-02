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

/**
 * Eco del TTS: el micrófono atrapa una palabra que el asistente acaba de listar
 * ("RUT", "QR") o casi la misma frase. Un pedido con verbo no se bloquea.
 */
export function looksLikeEcho(heard: string, spoken: string) {
  const a = normalizeHeard(heard);
  const b = normalizeHeard(spoken);
  if (!a || !b) return false;

  if (LISTED_OPTION.test(a) && b.includes(a.split(" ").pop() || a)) {
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
  const t = live.trim();
  if (t.length < 3) return false;
  return !looksLikeEcho(t, spoken);
}
