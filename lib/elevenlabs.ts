import { withTimeout } from "@/lib/async-timeout";

const DEFAULT_VOICE_ID = "xDZJO6bbSnscJEAbhpRF";
const DEFAULT_CHAT_MODEL = "eleven_flash_v2_5";
const DEFAULT_NARRATION_MODEL = "eleven_multilingual_v2";

export type TtsQuality = "chat" | "narration";

type SynthOpts = {
  quality?: TtsQuality;
};

async function synthesizeSpeechOnce(
  text: string,
  opts: SynthOpts = {}
): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey || !text.trim()) return null;

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
  // Narración: más estable y lenta. Evitamos "style/speed" en multilingual
  // porque algunos modelos los rechazan y el audio cae al fallback del browser.
  const voice_settings =
    quality === "narration"
      ? {
          stability: 0.68,
          similarity_boost: 0.78,
          use_speaker_boost: true,
        }
      : {
          stability: 0.52,
          similarity_boost: 0.82,
          style: 0.22,
          use_speaker_boost: true,
          speed: 1.02,
        };

  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 8_000);
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
    console.error("ElevenLabs TTS failed", res.status, errText.slice(0, 300));
    if (quality === "narration" && modelId !== chatModel) {
      return synthesizeSpeechOnce(text, { quality: "chat" });
    }
    return null;
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function synthesizeSpeech(
  text: string,
  opts: SynthOpts = {}
): Promise<Buffer | null> {
  return withTimeout(synthesizeSpeechOnce(text, opts), 9_000, null);
}
