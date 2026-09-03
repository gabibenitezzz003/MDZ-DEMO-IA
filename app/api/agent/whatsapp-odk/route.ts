import { NextRequest, NextResponse } from "next/server";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";
import {
  buildWhatsAppCampoUrl,
  getWhatsAppCampoPrefill,
} from "@/lib/whatsapp-odk";
import { getWhatsAppRutNumber } from "@/lib/whatsapp-rut";

export async function GET(req: NextRequest) {
  try {
    secureApiRequest(req, { requireSession: true, rateLimit: 30 });
    const number = getWhatsAppRutNumber();
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
