const CLOSING_DUPLICATE =
  /\s*(¿Tiene alguna duda[^.?]*\??|¿Tenés alguna duda[^.?]*\??|Dígame cómo seguimos\.?|Decime cómo seguimos\.?|¿Cómo seguimos\??)\s*$/i;

/** Pronunciación natural para TTS en español neutro profesional. */
function applyPronunciation(text: string): string {
  return text
    .replace(/\bDEMO\b/g, "demo")
    .replace(/\bSIA\b/g, "S I A")
    .replace(/\bBPA\b/g, "B P A")
    .replace(/\bRENSPA\b/g, "renspa")
    .replace(/\bCUIT\b/g, "cuit")
    .replace(/\bRUT\b/g, "RUT")
    .replace(/\bODK\s*Collect\b/gi, "O D K Collect")
    .replace(/\bODK\b/g, "O D K")
    .replace(/\bXForms?\b/g, "equis forms")
    .replace(/\bCentral\b/g, "Central")
    .replace(/\bagriencuestas\.mendoza\.gov\.ar\b/gi, "agriencuestas punto mendoza punto gov punto a erre")
    .replace(/\bc[oó]digo\s+QR\b/gi, "código Q R")
    .replace(/\bQR\b/g, "Q R")
    .replace(/código\s+código\s+Q R/gi, "código Q R")
    .replace(/\bMagíster\b/gi, "magíster")
    .replace(/\bIngeniero Agrónomo\b/gi, "ingeniero agrónomo")
    .replace(
      /\bdirecciondeagricultura\s+arroba\s+mendoza\s+punto\s+gov\s+punto\s+ar\b/gi,
      "dirección de agricultura arroba mendoza punto gov punto a erre"
    )
    .replace(
      /\bdirecciondeagricultura@mendoza\.gov\.ar\b/gi,
      "dirección de agricultura arroba mendoza punto gov punto a erre"
    )
    .replace(/\barroba\b/gi, "arroba")
    .replace(/\bpunto\s+gov\b/gi, "punto gov")
    .replace(/(^|\.\.\.\s*)Perfecto([,.…]|\s+)/gi, "$1Bien$2")
    .replace(/\bPerfecto, anoté\b/gi, "Anotado")
    .replace(/\bPerfecto, anotado\b/gi, "Anotado");
}

/** Texto para el chat: sin deletrear QR / ODK. */
export function displaySpoken(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\bche\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Solo para TTS: pronunciación. No usar esto en el globo del chat.
 */
export function humanizeSpoken(text: string): string {
  let t = displaySpoken(text);
  if (!t) return t;

  t = applyPronunciation(t);

  const closings = t.match(/¿[^?]+\?/g);
  if (closings && closings.length > 1) {
    t = t.replace(CLOSING_DUPLICATE, "").trim();
  }

  if (t.length > 420) {
    const cut = t.slice(0, 400);
    const lastStop = Math.max(
      cut.lastIndexOf("."),
      cut.lastIndexOf("?"),
      cut.lastIndexOf("!")
    );
    t = (lastStop > 100 ? cut.slice(0, lastStop + 1) : cut).trim();
  }

  return t;
}

/** Narración del Demo 3 min: sin recortes agresivos, ritmo natural. */
export function prepareTourNarration(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;
  t = applyPronunciation(t);
  // Evitar rachas de puntos suspensivos que fragmentan el audio.
  t = t.replace(/\.{3,}/g, ".");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}
