import { transcodeForGemini } from "@/lib/audio-for-gemini";
import { withTimeout } from "@/lib/async-timeout";

const MODEL_TIMEOUT_MS = 2_400;

const STT_PROMPT =
  "Transcribí este audio al español rioplatense. Devolvé únicamente el texto hablado, sin comillas. Si no se entiende, vacío.";

function sttModel(): string {
  return (
    process.env.GEMINI_STT_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-3.6-flash"
  );
}

export function normalizeAudioMime(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() || "audio/webm";
  if (base === "audio/webm" || base === "audio/ogg" || base === "audio/wav") {
    return base;
  }
  if (base.includes("mp4") || base.includes("m4a")) return "audio/mp4";
  return "audio/webm";
}

export function parseGeminiTranscript(raw: string): string | null {
  const text = raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(transcripci[oó]n|texto):\s*/i, "")
    .trim();
  if (!text) return null;
  if (/^(vacio|vacío|empty|n\/a|na|silence|silencio)$/i.test(text)) return null;
  return text;
}

async function callGeminiStt(
  apiKey: string,
  model: string,
  prompt: string,
  audio: Buffer,
  mimeType: string
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: normalizeAudioMime(mimeType),
                  data: audio.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
      }),
    }),
    MODEL_TIMEOUT_MS,
    null as Response | null
  );
  if (!res?.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text?.trim() || "")
      .filter(Boolean)
      .join(" ") || "";
  return parseGeminiTranscript(raw);
}

/** Solo si STT_PROVIDER=gemini. Un modelo, un intento, ≤2.4s. */
export async function transcribeWithGemini(
  audio: Buffer,
  mimeType = "audio/webm",
  contextHint?: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || audio.length < 80) return null;

  const prompt = contextHint
    ? `Contexto: sección «${contextHint}».\n${STT_PROMPT}`
    : STT_PROMPT;
  const model = sttModel();

  const parsed = await callGeminiStt(apiKey, model, prompt, audio, mimeType);
  if (parsed) return parsed;

  const ogg = await transcodeForGemini(audio, mimeType);
  if (!ogg) return null;
  return callGeminiStt(apiKey, model, prompt, ogg.buffer, ogg.mime);
}
