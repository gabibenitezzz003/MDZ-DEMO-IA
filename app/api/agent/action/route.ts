import { NextRequest, NextResponse } from "next/server";
import { publish } from "@/lib/agent-bus";
import { buildSectionGuide } from "@/lib/section-guide";
import { isValidSectionId } from "@/lib/section-ids";
import type { AgentAction, AgentActionRequest, AgentEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: AgentAction[] = [
  "navigate",
  "highlight",
  "open_external",
  "open_rut",
  "rut_set_step",
  "rut_focus_field",
  "show_checklist",
  "fill_form",
  "ask_confirm",
  "scroll",
  "go_home",
  "go_back",
  "go_forward",
  "describe",
];

const SCROLL_TARGETS = ["up", "down", "top", "bottom"];

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.DEMO_AGENT_SECRET ?? "demo-secret-change-me";
  const header = req.headers.get("x-demo-secret");
  if (!header || header !== secret) {
    return unauthorized();
  }

  let body: AgentActionRequest;
  try {
    body = (await req.json()) as AgentActionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const action = body.action;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (
    (action === "navigate" || action === "highlight" || action === "describe") &&
    body.target &&
    !isValidSectionId(body.target)
  ) {
    return NextResponse.json(
      { error: `Unknown section_id: ${body.target}` },
      { status: 400 }
    );
  }

  if (action === "scroll") {
    const direction = String(
      body.target ?? body.payload?.direction ?? "down"
    ).toLowerCase();
    if (!SCROLL_TARGETS.includes(direction)) {
      return NextResponse.json(
        { error: "scroll requires target/direction: up, down, top or bottom" },
        { status: 400 }
      );
    }
    body.target = direction;
  }

  if (action === "rut_set_step") {
    const step = Number(body.target ?? body.payload?.step);
    if (!Number.isInteger(step) || step < 1 || step > 5) {
      return NextResponse.json(
        { error: "rut_set_step requires target/step 1-5" },
        { status: 400 }
      );
    }
    body.target = String(step);
  }

  const event: AgentEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    action,
    target: body.target,
    payload: body.payload,
    createdAt: Date.now(),
  };

  publish(event);

  const guide =
    (action === "navigate" || action === "highlight" || action === "describe") &&
    event.target
      ? buildSectionGuide(event.target)
      : null;

  return NextResponse.json({
    ok: true,
    event,
    guide,
    spoken: guide?.spoken ?? spokenFallback(action, event.target),
  });
}

function spokenFallback(action: AgentAction, target?: string) {
  if (action === "open_rut") {
    return "Te abri el wizard del RUT. Vamos paso a paso: primero la cuenta SIA, despues el mail, y despues la declaracion jurada.";
  }
  if (action === "go_home") {
    return "Volvi al inicio del portal. Decime que queres ver ahora.";
  }
  if (action === "go_back") {
    return "Retrocedi a lo que estabamos viendo recien.";
  }
  if (action === "scroll") {
    const labels: Record<string, string> = {
      up: "Subi un poco la pagina.",
      down: "Baje un poco para que veas lo que sigue.",
      top: "Te lleve arriba de todo.",
      bottom: "Te lleve hasta el final de la pagina.",
    };
    return labels[target ?? "down"] ?? "Movi la pagina.";
  }
  if (action === "show_checklist") {
    return "Te mostre el listado de documentacion segun la condicion frente a la tierra.";
  }
  if (action === "fill_form") {
    return "Te estoy cargando los datos en el formulario.";
  }
  return undefined;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-demo-secret",
    },
  });
}
