import { normalizeHeard } from "@/lib/voice-stt-guards";

/**
 * Todos los patrones se evalúan sobre texto ya normalizado: minúsculas, sin
 * acentos y sin puntuación (la puntuación se vuelve espacio).
 */
const FILLER = /^(eh+|mm+|hm+|ah+|oh+|uh+|um+|em+|a+|e+|o+|u+)$/;

/**
 * Whisper alucina sobre ruido ambiente y casi siempre con las mismas frases:
 * cierres de video de YouTube, créditos de subtitulado y marcas de música.
 * Sin este filtro un ventilador o una charla de fondo entra al chat como si
 * fuera el usuario y descarrila la sesión.
 */
const HALLUCINATION = [
  // Créditos de subtitulado: lo más frecuente cuando no hay señal.
  /^subtitul/,
  /\bamara\s?org\b/,
  /\bsubtitles?\b.*\b(by|community|amara)\b/,
  // Cierres de video.
  /\bgracias por (ver|mirar|acompa|su atenc|haber|estar)/,
  /\bno olvides? (de )?suscribirte\b/,
  /\bsuscribete\b/,
  /\bnos vemos en (el|la) (proxim|siguiente)/,
  /\bhasta (la proxima|el proximo video)\b/,
  /\blike y suscr/,
  /\bcomparte (el|este) video\b/,
  /\bthanks? for watching\b/,
  /\bsee you (in the )?next (video|time)\b/,
  // Marcas de audio no verbal.
  /^(musica|music|aplausos|applause|risas|laughter|silencio|ruido)$/,
  // Enlaces y créditos sueltos.
  /^(www|https?)\b/,
  /\bcopyright\b/,
  /\beditado por\b/,
];

/**
 * Cortesías sueltas: si son TODO lo que se escuchó casi siempre es alucinación.
 * Dentro de una frase con contenido no se filtran.
 */
const BARE_COURTESY =
  /^((muchas|mil|muchisimas) )?(gracias|thank you|thanks|bye|adios|chau|hasta luego|buenas|buenos dias|buenas tardes)$/;

/**
 * Palabras cortas que SÍ son comandos válidos de la demo. Sin esta lista el
 * filtro de longitud mínima se comería "rut", "si", "ajo" o "qr".
 */
const SHORT_COMMANDS = new Set([
  "si",
  "no",
  "ok",
  "oka",
  "dale",
  "hola",
  "rut",
  "qr",
  "odk",
  "sia",
  "ajo",
  "vid",
  "uva",
  "mapa",
  "mapas",
  "clima",
  "ayuda",
  "pausa",
  "para",
  "pare",
  "basta",
  "segui",
  "sigue",
  "listo",
  "atras",
  "volver",
  "inicio",
  "menu",
  "mas",
  "otra",
  "repeti",
  "repite",
]);

/**
 * Filtra ruido ambiente transcripto: relleno vocal, alucinaciones conocidas de
 * Whisper y tokens sueltos sin cuerpo. NO bloquea comandos reales cortos.
 */
export function isLikelyNoiseTranscript(raw: string): boolean {
  const t = normalizeHeard(raw);
  if (!t) return true;

  const words = t.split(" ").filter(Boolean);
  if (!words.length) return true;
  if (words.every((w) => FILLER.test(w))) return true;
  if (BARE_COURTESY.test(t)) return true;
  if (HALLUCINATION.some((re) => re.test(t))) return true;

  // "gracias gracias gracias": el decoder repite cuando no hay señal.
  if (words.length >= 2 && new Set(words).size === 1) return true;

  // Token suelto: pasa si es un comando conocido o una palabra con cuerpo.
  if (words.length === 1) {
    return !SHORT_COMMANDS.has(words[0]) && words[0].length < 4;
  }

  return false;
}
