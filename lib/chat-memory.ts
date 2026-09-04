import { mergeFieldsWithConflicts } from "@/lib/field-merge";
import { normalizeRutFields } from "@/lib/rut-conversation";

export type MemoryTurn = { role: "user" | "assistant"; text: string };

/**
 * Algo que el asistente ofreció y quedó esperando un sí. Sin esto, un "dale"
 * o un "abrímelo" del turno siguiente no tiene a qué referirse y lo termina
 * capturando cualquier regla por palabra suelta.
 */
export type PendingOffer = "whatsapp_rut";

type SessionMem = {
  pendingFields: Record<string, string>;
  awaitingFillConfirm: boolean;
  lastSectionId?: string;
  sectionHistory: string[];
  turns: MemoryTurn[];
  rutStep?: number;
  rutMode?: "idle" | "collecting" | "confirm" | "done";
  ackSalt?: number;
  facts: Record<string, string>;
  pendingOffer?: PendingOffer;
};

const globalStore = globalThis as typeof globalThis & {
  __demoChatMemory?: Map<string, SessionMem>;
};

if (!globalStore.__demoChatMemory) {
  globalStore.__demoChatMemory = new Map();
}

const memory = globalStore.__demoChatMemory;

function empty(): SessionMem {
  return {
    pendingFields: {},
    awaitingFillConfirm: false,
    lastSectionId: undefined,
    sectionHistory: [],
    turns: [],
    rutStep: undefined,
    rutMode: "idle",
    facts: {},
    pendingOffer: undefined,
  };
}

export function setPendingOffer(sessionId: string, offer?: PendingOffer) {
  const current = getMemory(sessionId);
  memory.set(sessionId, { ...current, pendingOffer: offer });
}

function harvestFactsFromText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const name =
    text.match(
      /\b(?:me llamo|soy|mi nombre es)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,2})/i
    )?.[1] ||
    text.match(
      /\b(?:me llamo|soy|mi nombre es)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/i
    )?.[1];
  if (name && name.length > 1 && name.length < 40) {
    out.name = name.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const crop = text.match(
    /\b(?:produzco|tengo|trabajo)\s+(?:con\s+)?(ciruela|durazno|ajo|tomate|vid|uva|oliva|nuez|almendra|hortaliza|horticultura)\b/i
  )?.[1];
  if (crop) out.crop = crop.toLowerCase();
  const depto = text.match(
    /\b(?:de|en|del)\s+(Guaymall[eé]n|Maip[uú]|Luj[aá]n|San Mart[ií]n|Jun[ií]n|Rivadavia|Tunuy[aá]n|Tupungato|San Carlos|Lavalle|Las Heras|Godoy Cruz|Capital|Malarg[uü]e|San Rafael|General Alvear)\b/i
  )?.[1];
  if (depto) out.departamento = depto;
  return out;
}

export function setRutProgress(
  sessionId: string,
  patch: { rutStep?: number; rutMode?: SessionMem["rutMode"] }
) {
  const current = getMemory(sessionId);
  memory.set(sessionId, { ...current, ...patch });
}

export function appendTurn(
  sessionId: string,
  role: MemoryTurn["role"],
  text: string
) {
  const current = getMemory(sessionId);
  const turns = [...current.turns, { role, text }].slice(-24);
  const facts =
    role === "user"
      ? { ...current.facts, ...harvestFactsFromText(text) }
      : current.facts;
  memory.set(sessionId, { ...current, turns, facts });
}

export function mergeSessionFacts(
  sessionId: string,
  patch: Record<string, string | undefined | null>
) {
  const current = getMemory(sessionId);
  const facts = { ...current.facts };
  for (const [k, v] of Object.entries(patch)) {
    const clean = String(v ?? "").trim();
    if (clean) facts[k] = clean;
  }
  memory.set(sessionId, { ...current, facts });
  return facts;
}

export function setLastSection(sessionId: string, sectionId: string) {
  const current = getMemory(sessionId);
  const history = [...(current.sectionHistory ?? [])];
  if (current.lastSectionId && current.lastSectionId !== sectionId) {
    history.push(current.lastSectionId);
  }
  const topics = current.facts.topics
    ? current.facts.topics.split("|").filter(Boolean)
    : [];
  if (!topics.includes(sectionId)) topics.push(sectionId);
  memory.set(sessionId, {
    ...current,
    lastSectionId: sectionId,
    sectionHistory: history.slice(-12),
    facts: {
      ...current.facts,
      topics: topics.slice(-16).join("|"),
      lastTopic: sectionId,
    },
  });
}

export function popPreviousSection(sessionId: string): string | undefined {
  const current = getMemory(sessionId);
  const history = [...(current.sectionHistory ?? [])];
  const prev = history.pop();
  memory.set(sessionId, {
    ...current,
    sectionHistory: history,
    lastSectionId: prev ?? current.lastSectionId,
  });
  return prev;
}

export function getMemory(sessionId: string): SessionMem {
  const current = memory.get(sessionId);
  if (!current) return empty();
  return {
    ...current,
    pendingFields: current.pendingFields ?? {},
    turns: current.turns ?? [],
    sectionHistory: current.sectionHistory ?? [],
    facts: current.facts ?? {},
  };
}

export function mergePendingFields(
  sessionId: string,
  fields: Record<string, string>
) {
  const current = getMemory(sessionId);
  const { merged } = mergeFieldsWithConflicts(current.pendingFields, fields);
  const next = { ...current, pendingFields: normalizeRutFields(merged) };
  memory.set(sessionId, next);
  return next;
}

export function mergePendingFieldsDetailed(
  sessionId: string,
  fields: Record<string, string>
) {
  const current = getMemory(sessionId);
  const result = mergeFieldsWithConflicts(current.pendingFields, fields);
  const next = {
    ...current,
    pendingFields: normalizeRutFields(result.merged),
  };
  memory.set(sessionId, next);
  return { memory: next, ...result };
}

export function bumpAckSalt(sessionId: string) {
  const current = getMemory(sessionId);
  const ackSalt = (current.ackSalt ?? 0) + 1;
  memory.set(sessionId, { ...current, ackSalt });
  return ackSalt;
}

export function setAwaitingFill(sessionId: string, awaiting: boolean) {
  const current = getMemory(sessionId);
  const next = { ...current, awaitingFillConfirm: awaiting };
  memory.set(sessionId, next);
  return next;
}

export function clearPendingFill(sessionId: string) {
  const current = getMemory(sessionId);
  memory.set(sessionId, {
    ...current,
    pendingFields: {},
    awaitingFillConfirm: false,
  });
}

export function clearSession(sessionId: string) {
  memory.delete(sessionId);
}
