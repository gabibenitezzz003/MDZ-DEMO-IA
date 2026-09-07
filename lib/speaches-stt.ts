import catalog from "@/content/site-catalog.json";

const DEFAULT_SPEACHES_URL = "http://127.0.0.1:8771";
const DEFAULT_SPEACHES_MODEL = "Systran/faster-whisper-small";
const LOCAL_STT_TIMEOUT_MS = 2_400;

function buildDemoHotwords() {
  const fromCatalog = catalog.sections.flatMap((s) => [
    s.title,
    ...s.keywords,
    s.id.replace(/-/g, " "),
  ]);
  const extra = [
    "Agricultura Mendoza",
    "Dirección de Agricultura",
    "ODK Collect",
    "agrometeorología",
    "Registro Único de Tierras",
    "WhatsApp",
    "demo guiada",
  ];
  return [...new Set([...fromCatalog, ...extra])].slice(0, 120).join(", ");
}

const STT_PROMPT =
  "Conversación en español argentino sobre el portal de la Dirección de Agricultura de Mendoza: cultivos, mapas, clima, precios, RUT, capacitaciones, ODK.";

function extensionFor(mimeType: string) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

/** Transcripción local OpenAI-compatible mediante Speaches/faster-whisper. */
export async function transcribeWithSpeaches(
  audio: Buffer,
  mimeType = "audio/webm"
): Promise<string | null> {
  if (audio.length < 200) return null;

  const baseUrl = (
    process.env.SPEACHES_URL?.trim() || DEFAULT_SPEACHES_URL
  ).replace(/\/$/, "");
  const model =
    process.env.SPEACHES_STT_MODEL?.trim() || DEFAULT_SPEACHES_MODEL;
  const form = new FormData();
  form.append("model", model);
  form.append("language", "es");
  form.append("response_format", "json");
  form.append("temperature", "0");
  form.append("vad_filter", "true");
  form.append("prompt", STT_PROMPT);
  form.append("hotwords", buildDemoHotwords());
  form.append(
    "file",
    new Blob([Uint8Array.from(audio)], { type: mimeType || "audio/webm" }),
    `speech.${extensionFor(mimeType)}`
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_STT_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      signal: controller.signal,
      body: form,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    const text = (data.text || "").trim();
    return text || null;
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name !== "AbortError") console.error("Local Speaches STT failed", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
