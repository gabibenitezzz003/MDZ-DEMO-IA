import { describe, expect, it } from "vitest";
import { tryInstantVoiceReply } from "@/lib/voice-instant-reply";

describe("tryInstantVoiceReply", () => {
  it("replies to hola without network", () => {
    const r = tryInstantVoiceReply("hola");
    expect(r?.spoken).toMatch(/hola|buenas|ayudo/i);
    expect(r?.via).toBe("instant-greeting");
  });

  it("ignores navigation requests", () => {
    expect(tryInstantVoiceReply("mostrame ciruela")).toBeNull();
  });
});
