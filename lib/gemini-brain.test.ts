import { describe, expect, it } from "vitest";
import { parseGeminiIntent } from "@/lib/gemini-brain";

describe("parseGeminiIntent", () => {
  it("parses a valid navigate intent", () => {
    const intent = parseGeminiIntent(
      JSON.stringify({
        action: "navigate",
        target: "ciruela",
        reply: "Te llevo a ciruela.",
        openLink: false,
      })
    );
    expect(intent?.action).toBe("navigate");
    expect(intent?.target).toBe("ciruela");
    expect(intent?.reply).toMatch(/ciruela/i);
  });

  it("rejects empty reply", () => {
    expect(
      parseGeminiIntent(JSON.stringify({ action: "describe", reply: "" }))
    ).toBeNull();
  });

  it("falls back unknown action to describe", () => {
    const intent = parseGeminiIntent(
      JSON.stringify({ action: "teleport", reply: "Listo." })
    );
    expect(intent?.action).toBe("describe");
  });
});
