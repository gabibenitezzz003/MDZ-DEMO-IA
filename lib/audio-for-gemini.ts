import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function inputExt(mimeType: string) {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() || "audio/webm";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("wav")) return "wav";
  if (base.includes("mp4") || base.includes("m4a")) return "m4a";
  return "webm";
}

/**
 * WhatsApp/n8n usan OGG Opus; el navegador graba WebM. Gemini entiende mejor
 * OGG mono 16 kHz cuando el WebM viene corto o con codecs raros.
 */
export async function transcodeForGemini(
  audio: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (audio.length < 80) return null;
  const dir = await mkdtemp(join(tmpdir(), "demo-stt-"));
  const inPath = join(dir, `in.${inputExt(mimeType)}`);
  const oggPath = join(dir, "out.ogg");
  const wavPath = join(dir, "out.wav");
  try {
    await writeFile(inPath, audio);
    try {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          inPath,
          "-ac",
          "1",
          "-ar",
          "16000",
          "-c:a",
          "libopus",
          oggPath,
        ],
        { timeout: 8_000 }
      );
      const ogg = await readFile(oggPath);
      if (ogg.length >= 80) return { buffer: ogg, mime: "audio/ogg" };
    } catch {
      // fallback wav
    }
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        inPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        wavPath,
      ],
      { timeout: 8_000 }
    );
    const wav = await readFile(wavPath);
    return wav.length >= 80 ? { buffer: wav, mime: "audio/wav" } : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
