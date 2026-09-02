import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ApiSecurityError,
  createSessionToken,
  secureApiRequest,
  sessionCookie,
} from "@/lib/api-security";

export async function POST(req: NextRequest) {
  try {
    secureApiRequest(req, { maxBytes: 2_048, rateLimit: 20 });
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: string;
    };
    const requested = String(body.sessionId || "").trim();
    const sessionId = /^[a-zA-Z0-9_-]{8,80}$/.test(requested)
      ? requested
      : randomUUID();
    const response = NextResponse.json({ ok: true, sessionId });
    response.cookies.set(sessionCookie(createSessionToken(sessionId)));
    return response;
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "error" },
      { status }
    );
  }
}
