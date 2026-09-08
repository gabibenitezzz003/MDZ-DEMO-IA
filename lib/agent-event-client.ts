import type { AgentEvent } from "@/lib/types";

/** Aplica en la página demo un evento devuelto por /api/agent/chat. */
export function dispatchAgentEvent(event?: AgentEvent | null) {
  if (!event || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("demo:agent-event", { detail: event }));
}
