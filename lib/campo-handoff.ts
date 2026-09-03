export type CampoHandoff = {
  id: string;
  chatId: string;
  reason: string;
  summary: string;
  relevamientoSnapshot?: Record<string, unknown>;
  notes?: Array<{ text: string; at: number }>;
  at: number;
  status: "open" | "claimed";
};

type HandoffStore = { items: CampoHandoff[] };

function store(): HandoffStore {
  const g = globalThis as typeof globalThis & { __campoHandoffs?: HandoffStore };
  if (!g.__campoHandoffs) g.__campoHandoffs = { items: [] };
  return g.__campoHandoffs;
}

export function pushHandoff(item: Omit<CampoHandoff, "status">) {
  const saved: CampoHandoff = { ...item, status: "open" };
  const s = store();
  s.items.unshift(saved);
  s.items = s.items.slice(0, 30);
  return saved;
}

export function listHandoffs() {
  return store().items;
}
