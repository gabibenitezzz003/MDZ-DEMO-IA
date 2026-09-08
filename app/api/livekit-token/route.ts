import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    secureApiRequest(req, { requireSession: true, rateLimit: 20 });

    const body = (await req.json()) as {
      roomName?: string;
      participantName?: string;
    };
    const roomName = String(body.roomName || "").trim() || "demo-agricultura-room";
    const participantName = String(body.participantName || "").trim() || "productor";

    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { ok: false, error: "LiveKit no configurado" },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();

    return NextResponse.json({
      ok: true,
      token,
      url: process.env.LIVEKIT_URL?.trim() || "",
      roomName,
      participantName,
    });
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    const message = error instanceof Error ? error.message : "token_failed";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
