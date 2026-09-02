import { NextRequest, NextResponse } from "next/server";
import { transcribeWithElevenLabs } from "@/lib/elevenlabs-stt";
import { transcribeWithGemini } from "@/lib/gemini-stt";
import { transcribeWithSpeaches } from "@/lib/speaches-stt";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    secureApiRequest(req, {
      requireSession: true,
      maxBytes: 12 * 1024 * 1024,
      rateLimit: 24,
    });
    const body = (await req.json()) as {
      audioBase64?: string;
      mimeType?: string;
    };
    const audioBase64 = body.audioBase64?.trim();
    if (!audioBase64) {
      return NextResponse.json(
        { ok: false, error: "audioBase64 required" },
        { status: 400 }
      );
    }

    const mimeType = body.mimeType?.trim() || "audio/webm";
    let audio: Buffer;
    try {
      audio = Buffer.from(audioBase64, "base64");
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid base64" },
        { status: 400 }
      );
    }
    if (audio.length > 8 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "audio_too_large" },
        { status: 413 }
      );
    }

    if (audio.length < 200) {
      return NextResponse.json({ ok: true, text: "", via: "empty" });
    }

    const fromLocal = await transcribeWithSpeaches(audio, mimeType);
    if (fromLocal) {
      return NextResponse.json({
        ok: true,
        text: fromLocal,
        via: "speaches-local",
      });
    }

    const fromEleven = await transcribeWithElevenLabs(audio, mimeType);
    if (fromEleven) {
      return NextResponse.json({
        ok: true,
        text: fromEleven,
        via: "elevenlabs",
      });
    }

    const fromGemini = await transcribeWithGemini(audio, mimeType);
    if (fromGemini) {
      return NextResponse.json({
        ok: true,
        text: fromGemini,
        via: "gemini",
      });
    }

    return NextResponse.json({
      ok: true,
      text: "",
      via: "none",
      error: "No pude transcribir el audio",
    });
  } catch (err) {
    console.error("STT route error", err);
    const status = err instanceof ApiSecurityError ? err.status : 500;
    return NextResponse.json(
      { ok: false, error: "stt_failed" },
      { status }
    );
  }
}
