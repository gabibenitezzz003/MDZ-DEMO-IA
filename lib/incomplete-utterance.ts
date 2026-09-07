function normalize(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** La frase suena cortada a mitad de pedido (pausa natural del hablante). */
export function looksIncompleteUtterance(raw: string): boolean {
  const t = normalize(raw);
  if (t.length < 5) return true;

  const patterns = [
    /\b(que|qué)\s+es\s*$/,
    /\b(que|qué)\s+hace\s*$/,
    /\b(que|qué)\s+sirve\s*$/,
    /\b(que|qué)\s+son\s*$/,
    /\bme\s+podrias\s*$/,
    /\bme\s+podes\s*$/,
    /\bme\s+podria\s*$/,
    /\b(explicar|explicame|contame|decime|mostrame|muestrame)\s+(que|qué|me|sobre|la|el|los|las|un|una)?\s*$/,
    /\b(llevame|lleveme|mostrame|muestrame|mandame|quiero|necesito)\s+(a|al|la|el|me|ver|saber|ir)?\s*$/,
    /\b(quiero|necesito|decime|contame)\s+(ver|saber|ir)?\s*$/,
    /\b(seccion|sección|parte|zona|area|área)\s+(de|del|la|el)?\s*$/,
    /\b(informacion|información|datos)\s+(de|del|sobre)?\s*$/,
    /\beh\s*$/,
    /\by\s*$/,
    /\b(o|u)\s*$/,
    /\b(de|del|la|el|los|las|en|con|para|por|un|una|al|a|me|te|sobre|como|cómo)\s*$/,
  ];
  if (patterns.some((p) => p.test(t))) return true;

  // Frase corta sin verbo de pedido claro: suele ser el primer trozo de algo más largo.
  const words = t.split(" ").filter(Boolean);
  if (
    words.length <= 2 &&
    !/^(hola|buenas|si|no|dale|listo|rut|qr|mapas|clima|ayuda|menu|inicio|atras|volver)$/i.test(
      t
    )
  ) {
    return true;
  }

  return false;
}

export function mergeUtterances(previous: string, next: string): string {
  const a = previous.trim();
  const b = next.trim();
  if (!a) return b;
  if (!b) return a;
  if (b.length <= 3 && /^(si|no|y|o|eh|um)$/i.test(b)) return `${a} ${b}`;
  if (/^(si|no|y|o)\b/i.test(b) && a.length > 12) return `${a}, ${b}`;
  return `${a} ${b}`.replace(/\s+/g, " ").trim();
}

export function incompleteContinuePrompt(): string {
  return "Te escucho, seguí con lo que me ibas a preguntar. ¿Qué querés que te explique?";
}
