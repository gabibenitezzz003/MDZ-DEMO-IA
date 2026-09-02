import { NextRequest } from "next/server";
import { subscribe } from "@/lib/agent-bus";
import type { AgentEvent } from "@/lib/types";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let authenticatedSession: string | null;
  try {
    authenticatedSession = secureApiRequest(req, {
      requireSession: true,
      rateLimit: 12,
      windowMs: 60_000,
    });
  } catch (error) {
    const status = error instanceof ApiSecurityError ? error.status : 500;
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) {
    return new Response(JSON.stringify({ error: "invalid sessionId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (authenticatedSession && sessionId !== authenticatedSession) {
    return new Response(JSON.stringify({ error: "session mismatch" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown, event = "message") => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send({ type: "connected", sessionId }, "ready");

      unsubscribe = subscribe(sessionId, (evt: AgentEvent) => {
        send(evt, "agent");
      });

      heartbeat = setInterval(() => {
        send({ type: "ping", t: Date.now() }, "ping");
      }, 15000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
