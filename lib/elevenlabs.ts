const DEFAULT_VOICE_ID = "xDZJO6bbSnscJEAbhpRF";
const DEFAULT_MODEL = "eleven_flash_v2_5";

export async function synthesizeSpeech(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey || !text.trim()) return null;

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL;
  const clipped = text.trim().length > 420 ? `${text.trim().slice(0, 400).trim()}…` : text.trim();

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=3`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: clipped,
        model_id: modelId,
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.85,
          style: 0.35,
          use_speaker_boost: true,
          speed: 1.06,
        },
        apply_text_normalization: "on",
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("ElevenLabs TTS failed", res.status, errText.slice(0, 300));
    return null;
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
