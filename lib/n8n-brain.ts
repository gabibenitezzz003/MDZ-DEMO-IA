import type { AssistantIntent } from "@/lib/demo-assistant";
import type { ChatTurn } from "@/lib/gemini-brain";
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

function parseIntent(raw: unknown): AssistantIntent | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const nested =
    data.intent && typeof data.intent === "object"
      ? (data.intent as Record<string, unknown>)
      : data;

  const action = ACTIONS.includes(nested.action as AgentAction)
    ? (nested.action as AgentAction)
    : "describe";
  const reply = String(nested.reply ?? nested.spoken ?? data.spoken ?? "").trim();
  if (!reply) return null;

  const target = nested.target ? String(nested.target) : undefined;
  const url = nested.url ? String(nested.url) : undefined;
  const openLink = nested.openLink === true;
  const openExternal = nested.openExternal === true;
  const extracted =
    nested.extractedFields && typeof nested.extractedFields === "object"
      ? (nested.extractedFields as Record<string, string>)
      : undefined;
  const fillMode =
    nested.fillMode === "auto" ||
    nested.fillMode === "manual" ||
    nested.fillMode === "ask"
      ? nested.fillMode
      : undefined;

  const payload: Record<string, unknown> = {
    openLink,
    click: true,
    heardAs: nested.heardAs ? String(nested.heardAs) : undefined,
  };
  if (url) payload.url = url;
  if (openExternal) payload.openExternal = true;
  if (extracted && Object.keys(extracted).length) {
    payload.fields = extracted;
  }
  if (nested.remember && typeof nested.remember === "object") {
    payload.remember = nested.remember;
  }

  return {
    action: action === "open_external" && url ? "open_external" : action,
    target: action === "open_external" ? url || target : target,
    payload,
    reply,
    extractedFields: extracted,
    fillMode,
    endSession: nested.endSession === true,
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
  const url = process.env.N8N_WEBHOOK_URL?.trim();
  if (!url || process.env.USE_N8N_AS_BRAIN !== "true") return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_500);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
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
        model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
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

  if (!useN8n) return input.local();

  const n8nPromise = interpretWithN8n(input);
  const localPromise = input.local();

  return await new Promise<AssistantIntent | null>((resolve) => {
    let settled = false;
    const finish = (intent: AssistantIntent | null) => {
      if (settled || !intent) return;
      settled = true;
      resolve(intent);
    };
    void n8nPromise.then(finish).catch(() => undefined);
    void localPromise.then(finish).catch(() => undefined);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      void Promise.all([n8nPromise, localPromise]).then(([a, b]) => {
        resolve(a ?? b ?? null);
      });
    }, 5_800);
  });
}
