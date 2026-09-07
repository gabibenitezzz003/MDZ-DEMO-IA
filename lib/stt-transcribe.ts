import { withTimeout } from "@/lib/async-timeout";
import { transcribeWithElevenLabs } from "@/lib/elevenlabs-stt";
import { transcribeWithGemini } from "@/lib/gemini-stt";
import { alignTranscriptToCatalog } from "@/lib/stt-correct";
import { transcribeWithSpeaches } from "@/lib/speaches-stt";

const LOCAL_MS = 2_500;
const FALLBACK_MS = 2_500;

function sttProvider() {
  return (process.env.STT_PROVIDER?.trim().toLowerCase() || "local") as
    | "local"
    | "gemini"
    | "speaches"
    | "elevenlabs";
}

function finalize(
  text: string,
  via: string,
  lastSectionId?: string
): { text: string; via: string; heardAs?: string } {
  const aligned = alignTranscriptToCatalog(text, { lastSectionId });
  return {
    text: aligned.text,
    via,
    heardAs: aligned.heardAs ?? (aligned.changed ? text : undefined),
  };
}

/**
 * STT rápido: Speaches local primero (<2.5s). Gemini solo si STT_PROVIDER=gemini.
 * El dictado del navegador (SpeechRecognition) va en el cliente y no pasa por acá.
 */
export async function transcribeAudio(
  audio: Buffer,
  mimeType = "audio/webm",
  opts?: { hint?: string; lastSectionId?: string }
): Promise<{ text: string; via: string; heardAs?: string } | null> {
  if (audio.length < 80) return null;

  const provider = sttProvider();

  if (provider !== "gemini" && provider !== "elevenlabs") {
    const local = await withTimeout(
      transcribeWithSpeaches(audio, mimeType),
      LOCAL_MS,
      null
    );
    if (local?.trim()) {
      return finalize(local, "speaches-local", opts?.lastSectionId);
    }
  }

  if (provider === "gemini" && process.env.GEMINI_API_KEY?.trim()) {
    const gemini = await withTimeout(
      transcribeWithGemini(audio, mimeType, opts?.hint),
      FALLBACK_MS,
      null
    );
    if (gemini?.trim()) {
      return finalize(gemini, "gemini", opts?.lastSectionId);
    }
  }

  if (
    provider === "elevenlabs" &&
    process.env.ELEVENLABS_API_KEY?.trim()
  ) {
    const eleven = await withTimeout(
      transcribeWithElevenLabs(audio, mimeType),
      FALLBACK_MS,
      null
    );
    if (eleven?.trim()) {
      return finalize(eleven, "elevenlabs", opts?.lastSectionId);
    }
  }

  return null;
}
