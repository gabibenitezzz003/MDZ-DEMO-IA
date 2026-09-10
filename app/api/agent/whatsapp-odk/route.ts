import { NextRequest, NextResponse } from "next/server";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";
import {
  buildWhatsAppCampoUrl,
  getWhatsAppCampoNumber,
  getWhatsAppCampoPrefill,
} from "@/lib/whatsapp-odk";

export async function GET(req: NextRequest) {
  try {
    secureApiRequest(req, { requireSession: true, rateLimit: 30 });
    const number = getWhatsAppCampoNumber();
    return NextResponse.json({
      ok: true,
      configured: Boolean(number),
      url: buildWhatsAppCampoUrl(),
      prefill: getWhatsAppCampoPrefill(),
    });
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status });
  }
}
