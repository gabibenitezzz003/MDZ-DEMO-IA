import { NextRequest, NextResponse } from "next/server";
import {
  buildWhatsAppRutUrl,
  getWhatsAppRutNumber,
  getWhatsAppRutPrefill,
} from "@/lib/whatsapp-rut";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";

/** Expone la URL wa.me (número solo en servidor; no requiere NEXT_PUBLIC). */
export async function GET(req: NextRequest) {
  try {
    secureApiRequest(req, { requireSession: true, rateLimit: 30 });
    const number = getWhatsAppRutNumber();
    const url = buildWhatsAppRutUrl();
    return NextResponse.json({
      ok: true,
      configured: Boolean(number),
      url,
      prefill: getWhatsAppRutPrefill(),
    });
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status });
  }
}
