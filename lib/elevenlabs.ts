import { withTimeout } from "@/lib/async-timeout";

const DEFAULT_VOICE_ID = "h60rOzgfLmYsntfqgGu2";
const DEFAULT_CHAT_MODEL = "eleven_turbo_v2_5";
const DEFAULT_NARRATION_MODEL = "eleven_multilingual_v2";

type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  use_speaker_boost: boolean;
  style?: number;
  speed?: number;
};

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.7,
  similarity_boost: 0.75,
  style: 0.12,
  use_speaker_boost: true,
  speed: 0.98,
};

const NARRATION_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.74,
  similarity_boost: 0.72,
  use_speaker_boost: true,
};

function parseVoiceSettings(raw?: string): VoiceSettings {
  if (!raw?.trim()) return DEFAULT_VOICE_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      ...DEFAULT_VOICE_SETTINGS,
      ...parsed,
      use_speaker_boost: parsed.use_speaker_boost ?? true,
    };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export type TtsQuality = "chat" | "narration";

/** Motivo del último fallo de síntesis, para poder diagnosticarlo sin leer logs. */
let lastFailure: string | null = null;

export function lastTtsFailure(): string | null {
  return lastFailure;
}

type SynthOpts = {
  quality?: TtsQuality;
};

async function synthesizeSpeechOnce(
  text: string,
  opts: SynthOpts = {}
): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    lastFailure = "Falta ELEVENLABS_API_KEY: la voz cae al navegador.";
    return null;
  }
  if (!text.trim()) return null;

  const quality = opts.quality || "chat";
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const chatModel = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_CHAT_MODEL;
  const narrationModel =
    process.env.ELEVENLABS_TOUR_MODEL_ID?.trim() ||
    process.env.ELEVENLABS_NARRATION_MODEL_ID?.trim() ||
    DEFAULT_NARRATION_MODEL;

  const modelId = quality === "narration" ? narrationModel : chatModel;
  const maxChars = quality === "narration" ? 900 : 480;
  const clipped =
    text.trim().length > maxChars
      ? `${text.trim().slice(0, maxChars - 1).trim()}…`
      : text.trim();

  const latency =
    quality === "narration" ? "0" : "3";

  const userSettings = parseVoiceSettings(process.env.ELEVENLABS_VOICE_SETTINGS);
  const voice_settings: VoiceSettings =
    quality === "narration"
      ? { ...userSettings, ...NARRATION_VOICE_SETTINGS }
      : userSettings;

  const controller = new AbortController();
  const kill = setTimeout(
    () => controller.abort(),
    quality === "narration" ? 12_000 : 8_000
  );
  let res: Response;
  try {
    res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=${latency}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: clipped,
          model_id: modelId,
          voice_settings,
          apply_text_normalization: "on",
        }),
      }
    );
  } catch (err) {
    console.error("ElevenLabs fetch failed", err);
    return null;
  } finally {
    clearTimeout(kill);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // La causa importa: sin crédito o con la key vencida el sitio sigue
    // hablando con la voz del navegador y el fallo pasa inadvertido hasta
    // que alguien lo escucha en vivo. Dejamos el motivo explícito.
    lastFailure =
      /quota_exceeded/.test(errText)
        ? "ElevenLabs sin créditos (quota_exceeded): la voz cae al navegador."
        : res.status === 401
          ? "ElevenLabs rechazó la API key (401)."
          : `ElevenLabs respondió ${res.status}.`;
    console.error("ElevenLabs TTS failed", res.status, errText.slice(0, 300));
    if (quality === "narration" && modelId !== chatModel) {
      return synthesizeSpeechOnce(text, { quality: "chat" });
    }
    return null;
  }
  lastFailure = null;

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function synthesizeSpeech(
  text: string,
  opts: SynthOpts = {}
): Promise<Buffer | null> {
  const waitMs = opts.quality === "narration" ? 13_000 : 9_000;
  return withTimeout(synthesizeSpeechOnce(text, opts), waitMs, null);
}
