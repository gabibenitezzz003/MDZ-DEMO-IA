import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/stt-transcribe";
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
      hint?: string;
      lastSectionId?: string;
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

    if (audio.length < 80) {
      return NextResponse.json({ ok: true, text: "", via: "empty" });
    }

    const result = await transcribeAudio(audio, mimeType, {
      hint: body.hint?.trim(),
      lastSectionId: body.lastSectionId?.trim(),
    });

    if (!result?.text) {
      return NextResponse.json({
        ok: true,
        text: "",
        via: "none",
        error: "No pude transcribir el audio",
      });
    }

    return NextResponse.json({
      ok: true,
      text: result.text,
      via: result.via,
      heardAs: result.heardAs,
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
