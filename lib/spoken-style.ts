const CLOSING_DUPLICATE =
  /\s*(¿Tenés alguna duda[^.?]*\??|Decime cómo seguimos\.?|¿Cómo seguimos\??)\s*$/i;

export function humanizeSpoken(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;

  t = t
    .replace(/\bDEMO\b/g, "demo")
    .replace(/\bSIA\b/g, "ese I A")
    .replace(/\bBPA\b/g, "B P A")
    .replace(/\bODK\b/g, "o de ka")
    .replace(/\bc[oó]digo\s+QR\b/gi, "código QR")
    .replace(/\bQR\b/g, "código QR")
    .replace(/código\s+código\s+QR/gi, "código QR")
    .replace(/(^|\.\.\.\s*)Perfecto([,.…]|\s+)/gi, "$1Bien$2")
    .replace(/\bPerfecto, anoté\b/gi, "Anotado")
    .replace(/\bPerfecto, anotado\b/gi, "Anotado");

  t = t.replace(/([^.?!…])\.\s+(?=[A-ZÁÉÍÓÚ¡¿])/g, "$1... ");
  t = t.replace(/\.{4,}/g, "...");
  t = t.replace(/\.\.\.\s*\.\.\./g, "...");

  const closings = t.match(/¿[^?]+\?/g);
  if (closings && closings.length > 1) {
    t = t.replace(CLOSING_DUPLICATE, "").trim();
  }

  if (t.length > 280) {
    const cut = t.slice(0, 260);
    const lastStop = Math.max(
      cut.lastIndexOf("..."),
      cut.lastIndexOf("."),
      cut.lastIndexOf("?")
    );
    t = (lastStop > 80 ? cut.slice(0, lastStop + (cut[lastStop] === "." || cut[lastStop] === "?" ? 1 : 3)) : cut).trim();
  }

  return t;
}
