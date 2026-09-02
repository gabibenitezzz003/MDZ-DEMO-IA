import { NextRequest, NextResponse } from "next/server";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";
import { synthesizeSpeech } from "@/lib/elevenlabs";
import { humanizeSpoken } from "@/lib/spoken-style";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    secureApiRequest(req, {
      requireSession: true,
      maxBytes: 8_000,
      rateLimit: 40,
    });
    const body = (await req.json()) as { text?: string };
    const text = humanizeSpoken(String(body.text || "").trim());
    if (!text) {
      return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
    }
    const audio = await synthesizeSpeech(text, { quality: "chat" });
    if (!audio) {
      return NextResponse.json({ ok: true, audioBase64: null });
    }
    return NextResponse.json({
      ok: true,
      audioBase64: audio.toString("base64"),
      audioMime: "audio/mpeg",
    });
  } catch (err) {
    const status = err instanceof ApiSecurityError ? err.status : 500;
    const message = err instanceof Error ? err.message.slice(0, 160) : "tts failed";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
