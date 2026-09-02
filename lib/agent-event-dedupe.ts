/** Evita ejecutar dos veces el mismo evento recibido por SSE y por HTTP. */
export function createAgentEventDedupe(maxRemembered = 256) {
  const seen = new Set<string>();
  const order: string[] = [];

  return (eventId?: string) => {
    if (!eventId) return true;
    if (seen.has(eventId)) return false;
    seen.add(eventId);
    order.push(eventId);
    while (order.length > maxRemembered) {
      const oldest = order.shift();
      if (oldest) seen.delete(oldest);
    }
    return true;
  };
}
