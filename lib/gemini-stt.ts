import { withTimeout } from "@/lib/async-timeout";

const STT_TIMEOUT_MS = 12_000;

function modelCandidates() {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const list = [
    preferred,
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
  ].filter(Boolean) as string[];
  return [...new Set(list)].slice(0, 2);
}

/**
 * Fallback transcription with Gemini multimodal (inline audio).
 */
export async function transcribeWithGemini(
  audio: Buffer,
  mimeType = "audio/webm"
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || audio.length < 200) return null;

  const b64 = audio.toString("base64");
  const prompt =
    "Transcribí este audio en español (Argentina). Devolvé SOLO el texto hablado, sin comillas ni explicación. Si no hay habla clara, devolvé exactamente: VACIO";

  for (const model of modelCandidates()) {
    try {
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
                  { inline_data: { mime_type: mimeType, data: b64 } },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 256,
            },
          }),
        }),
        STT_TIMEOUT_MS,
        null as Response | null
      );
      if (!res) continue;
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("Gemini STT error", model, res.status, body.slice(0, 200));
        continue;
      }
      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || "")
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!text || /^vacio$/i.test(text)) return null;
      return text;
    } catch (err) {
      console.error("Gemini STT failed", model, err);
    }
  }
  return null;
}
