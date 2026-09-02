import { describe, expect, it } from "vitest";
import { createAgentEventDedupe } from "@/lib/agent-event-dedupe";

describe("agent event dedupe", () => {
  it("accepts one delivery and drops the HTTP/SSE duplicate", () => {
    const accept = createAgentEventDedupe();
    expect(accept("event-1")).toBe(true);
    expect(accept("event-1")).toBe(false);
    expect(accept("event-2")).toBe(true);
  });
});
