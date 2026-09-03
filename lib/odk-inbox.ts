import type { OdkCampoSubmission } from "@/lib/odk-campo-responder";

type InboxState = {
  items: OdkCampoSubmission[];
  listeners: Set<(items: OdkCampoSubmission[]) => void>;
};

function getInbox(): InboxState {
  const g = globalThis as typeof globalThis & { __odkCampoInbox?: InboxState };
  if (!g.__odkCampoInbox) {
    g.__odkCampoInbox = { items: [], listeners: new Set() };
  }
  return g.__odkCampoInbox;
}

export function pushOdkSubmission(item: OdkCampoSubmission) {
  const inbox = getInbox();
  inbox.items.unshift(item);
  inbox.items = inbox.items.slice(0, 40);
  for (const listener of inbox.listeners) {
    try {
      listener(inbox.items);
    } catch {
      // ignore
    }
  }
  return item;
}

export function listOdkSubmissions() {
  return getInbox().items;
}

export function subscribeOdkInbox(
  listener: (items: OdkCampoSubmission[]) => void
) {
  const inbox = getInbox();
  inbox.listeners.add(listener);
  return () => inbox.listeners.delete(listener);
}

export function inboxStats() {
  const items = listOdkSubmissions();
  return {
    total: items.length,
    olivos: items.filter((item) => item.formId.includes("olivo")).length,
    visitas: items.filter((item) => item.formId.includes("visita")).length,
    fincas: items.filter((item) => item.formId.includes("finca")).length,
  };
}
