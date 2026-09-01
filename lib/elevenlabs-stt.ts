import { withTimeout } from "@/lib/async-timeout";

const STT_TIMEOUT_MS = 12_000;

/**
 * Transcribe short browser recordings via ElevenLabs Scribe.
 * Returns null if the key/model is unavailable or the call fails.
 */
export async function transcribeWithElevenLabs(
  audio: Buffer,
  mimeType = "audio/webm"
): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey || audio.length < 200) return null;

  const modelId =
    process.env.ELEVENLABS_STT_MODEL_ID?.trim() || "scribe_v2";
  const ext = mimeType.includes("ogg")
    ? "ogg"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "m4a"
      : mimeType.includes("wav")
        ? "wav"
        : "webm";

  const form = new FormData();
  form.append(
    "file",
    new Blob([Uint8Array.from(audio)], { type: mimeType || "audio/webm" }),
    `speech.${ext}`
  );
  form.append("model_id", modelId);
  form.append("language_code", "es");
  form.append("tag_audio_events", "false");

  try {
    const res = await withTimeout(
      fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
      }),
      STT_TIMEOUT_MS,
      null as Response | null
    );
    if (!res) return null;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("ElevenLabs STT error", res.status, body.slice(0, 240));
      return null;
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text || "").trim();
    return text || null;
  } catch (err) {
    console.error("ElevenLabs STT failed", err);
    return null;
  }
}
