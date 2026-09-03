import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";
import { listHandoffs, pushHandoff } from "@/lib/campo-handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    secureApiRequest(req, { requireSession: true, rateLimit: 40 });
    return NextResponse.json({ ok: true, items: listHandoffs() });
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    secureApiRequest(req, { requireSession: true, maxBytes: 32_000, rateLimit: 40 });
    const body = (await req.json()) as {
      id?: string;
      chatId?: string;
      reason?: string;
      summary?: string;
      relevamientoSnapshot?: Record<string, unknown>;
      notes?: Array<{ text: string; at: number }>;
      at?: number;
    };
    if (!body.chatId || !body.summary) {
      return NextResponse.json({ ok: false, error: "chatId and summary required" }, { status: 400 });
    }
    const saved = pushHandoff({
      id: body.id || `handoff-${Date.now().toString(36)}`,
      chatId: body.chatId,
      reason: body.reason || "user_request",
      summary: body.summary,
      relevamientoSnapshot: body.relevamientoSnapshot,
      notes: body.notes,
      at: body.at || Date.now(),
    });
    return NextResponse.json({ ok: true, item: saved });
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    return NextResponse.json({ ok: false, error: "handoff_failed" }, { status });
  }
}
