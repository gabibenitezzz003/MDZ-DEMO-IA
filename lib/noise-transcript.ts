import { normalizeHeard } from "@/lib/voice-stt-guards";

const NOISE_ONLY =
  /^(eh+|mm+|hm+|ah+|oh+|uh+|um+|a+|e+|o+)$/i;

/**
 * Filtra solo basura típica de ruido. NO bloquea "rut", "ajo", "hola", etc.
 */
export function isLikelyNoiseTranscript(raw: string): boolean {
  const t = normalizeHeard(raw);
  if (!t) return true;
  if (t.length < 2) return true;
  if (NOISE_ONLY.test(t)) return true;
  return false;
}
