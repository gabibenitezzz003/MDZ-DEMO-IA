import type { AgentEvent } from "@/lib/types";

type Listener = (event: AgentEvent) => void;

type BusState = {
  listeners: Map<string, Set<Listener>>;
  recent: Map<string, AgentEvent[]>;
};

const MAX_RECENT = 50;

/**
 * Use globalThis so App Router route modules share one bus in the same Node process.
 * (Separate module instances would otherwise each get an empty Map.)
 */
function getState(): BusState {
  const g = globalThis as typeof globalThis & { __demoAgentBus?: BusState };
  if (!g.__demoAgentBus) {
    g.__demoAgentBus = {
      listeners: new Map(),
      recent: new Map(),
    };
  }
  return g.__demoAgentBus;
}

export function publish(event: AgentEvent): void {
  const { listeners, recent } = getState();
  const list = recent.get(event.sessionId) ?? [];
  list.push(event);
  if (list.length > MAX_RECENT) list.shift();
  recent.set(event.sessionId, list);

  const set = listeners.get(event.sessionId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribe(sessionId: string, listener: Listener): () => void {
  const { listeners } = getState();
  let set = listeners.get(sessionId);
  if (!set) {
    set = new Set();
    listeners.set(sessionId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(sessionId);
  };
}

export function getRecent(sessionId: string): AgentEvent[] {
  return getState().recent.get(sessionId) ?? [];
}
