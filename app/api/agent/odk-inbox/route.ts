import { NextRequest, NextResponse } from "next/server";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";
import { inboxStats, listOdkSubmissions, pushOdkSubmission } from "@/lib/odk-inbox";
import type { OdkCampoSubmission } from "@/lib/odk-campo-responder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    secureApiRequest(req, { requireSession: true, rateLimit: 40 });
    return NextResponse.json({
      ok: true,
      items: listOdkSubmissions(),
      stats: inboxStats(),
    });
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status });
  }
}

/** n8n / OpenWA pueden depositar un paquete ya armado. */
export async function POST(req: NextRequest) {
  try {
    secureApiRequest(req, {
      requireSession: true,
      maxBytes: 64_000,
      rateLimit: 40,
    });
    const body = (await req.json()) as { submission?: OdkCampoSubmission };
    if (!body.submission?.formId || !body.submission.xml) {
      return NextResponse.json({ ok: false, error: "submission required" }, { status: 400 });
    }
    const saved = pushOdkSubmission({
      ...body.submission,
      id: body.submission.id || `campo-${Date.now().toString(36)}`,
      createdAt: body.submission.createdAt || Date.now(),
      note:
        body.submission.note ||
        "Ficha simulada de demostración. No es un formulario de Central.",
    });
    return NextResponse.json({ ok: true, item: saved, stats: inboxStats() });
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status });
  }
}
