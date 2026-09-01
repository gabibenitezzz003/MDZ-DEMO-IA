import type { AssistantIntent } from "@/lib/demo-assistant";
import type { ChatTurn } from "@/lib/gemini-brain";
import { withTimeout } from "@/lib/async-timeout";
import type { ClientPageContext } from "@/lib/page-context";
import type { AgentAction } from "@/lib/types";

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

function parseIntent(raw: Record<string, unknown>): AssistantIntent | null {
  const action = ACTIONS.includes(raw.action as AgentAction)
    ? (raw.action as AgentAction)
    : "describe";
  const reply = String(raw.reply ?? raw.spoken ?? "").trim();
  if (!reply) return null;

  const target = raw.target ? String(raw.target) : undefined;
  const url = raw.url ? String(raw.url) : undefined;
  const openLink = raw.openLink === true;
  const openExternal = raw.openExternal === true;
  const extracted =
    raw.extractedFields && typeof raw.extractedFields === "object"
      ? (raw.extractedFields as Record<string, string>)
      : undefined;
  const fillMode =
    raw.fillMode === "auto" ||
    raw.fillMode === "manual" ||
    raw.fillMode === "ask"
      ? raw.fillMode
      : undefined;

  const nested =
    raw.payload && typeof raw.payload === "object"
      ? (raw.payload as Record<string, unknown>)
      : {};

  const payload: Record<string, unknown> = {
    ...nested,
    openLink: nested.openLink === true || openLink,
    click: nested.click !== false,
    heardAs: raw.heardAs ? String(raw.heardAs) : undefined,
  };
  if (url) payload.url = url;
  if (openExternal) payload.openExternal = true;
  if (extracted && Object.keys(extracted).length) {
    payload.fields = extracted;
  }
  if (raw.remember && typeof raw.remember === "object") {
    payload.remember = raw.remember;
  }

  return {
    action: action === "open_external" && url ? "open_external" : action,
    target: action === "open_external" ? url || target : target,
    payload,
    reply,
    extractedFields: extracted,
    fillMode,
    endSession: raw.endSession === true,
    understood: true,
    useGuide: false,
  };
}

export async function interpretWithN8n(input: {
  sessionId: string;
  text: string;
  originalText: string;
  history: ChatTurn[];
  lastSectionId?: string;
  pageContext?: ClientPageContext | null;
  pendingFields?: Record<string, string>;
  rutMode?: string;
  facts?: Record<string, string>;
}): Promise<AssistantIntent | null> {
  const webhook = process.env.N8N_WEBHOOK_URL?.trim();
  if (!webhook) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(webhook, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: input.sessionId,
        text: input.text,
        originalText: input.originalText,
        source: "demo-web",
        history: input.history.slice(-8),
        lastSectionId: input.lastSectionId,
        pageContext: input.pageContext,
        pendingFields: input.pendingFields || {},
        rutMode: input.rutMode || "idle",
        facts: input.facts || {},
        model: process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash",
        geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    if (json.ok === false) return null;
    return parseIntent(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Preferimos Gemini/local con timeout duro.
 * n8n solo si Gemini falla — evita “gana el primero” con respuestas incorrectas.
 */
export async function interpretFast(input: {
  sessionId: string;
  text: string;
  originalText: string;
  history: ChatTurn[];
  lastSectionId?: string;
  pageContext?: ClientPageContext | null;
  pendingFields?: Record<string, string>;
  rutMode?: string;
  facts?: Record<string, string>;
  local: () => Promise<AssistantIntent | null>;
}): Promise<AssistantIntent | null> {
  const useN8n =
    process.env.USE_N8N_AS_BRAIN === "true" &&
    Boolean(process.env.N8N_WEBHOOK_URL?.trim());

  const local = await withTimeout(input.local(), 9_000, null);
  if (local) return local;

  if (!useN8n) return null;
  return withTimeout(interpretWithN8n(input), 4_000, null);
}
