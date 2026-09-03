import { NextRequest, NextResponse } from "next/server";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";
import {
  displayCampoReply,
  runOdkCampoResponder,
} from "@/lib/odk-campo-responder";
import { pushOdkSubmission } from "@/lib/odk-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    secureApiRequest(req, {
      requireSession: true,
      maxBytes: 32_000,
      rateLimit: 40,
    });
    const body = (await req.json()) as {
      chatId?: string;
      text?: string;
      inputType?: string;
      stateJson?: string;
      lat?: number;
      lon?: number;
    };
    const text = String(body.text || "").trim();
    if (!text && body.inputType !== "image" && body.inputType !== "location") {
      return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
    }
    const result = runOdkCampoResponder({
      chatId: body.chatId || "demo-campo",
      input: text,
      inputType: body.inputType || "text",
      state_raw: body.stateJson || "",
      lat: body.lat,
      lon: body.lon,
    });
    if (result.submission) {
      pushOdkSubmission(result.submission);
    }
    return NextResponse.json({
      ok: true,
      reply: displayCampoReply(result.reply),
      stateJson: result.stateJson,
      status: result.status,
      formId: result.formId,
      formKey: result.formKey,
      data: result.data,
      hasPhoto: result.hasPhoto,
      geo: result.geo,
      submission: result.submission,
    });
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    return NextResponse.json({ ok: false, error: "campo_failed" }, { status });
  }
}
