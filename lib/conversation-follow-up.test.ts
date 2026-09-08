import { describe, expect, it } from "vitest";
import {
  resolveContinuationIntent,
  wantsConversationContinuation,
} from "@/lib/conversation-follow-up";
import { looksIncompleteUtterance } from "@/lib/incomplete-utterance";

describe("wantsConversationContinuation", () => {
  it("detects sí explícame after an offer", () => {
    expect(wantsConversationContinuation("sí por favor explícame")).toBe(true);
    expect(wantsConversationContinuation("que me expliques")).toBe(true);
  });

  it("does not treat unrelated phrases as continuation", () => {
    expect(wantsConversationContinuation("mandame a fruticultura")).toBe(false);
  });
});

describe("resolveContinuationIntent", () => {
  it("continues RUT topic from assistant history without lastSectionId", () => {
    const intent = resolveContinuationIntent("sí por favor explícame", {
      turns: [
        { role: "user", text: "qué es el rut" },
        {
          role: "assistant",
          text:
            "El RUT es el Registro Único de Tierras. ¿Te gustaría que te cuente cómo iniciar el trámite?",
        },
      ],
    });
    expect(intent?.target).toBe("rut");
    expect(intent?.action).toBe("navigate");
    expect(intent?.reply).toMatch(/registro único|whatsapp/i);
  });

  it("defers non-RUT section follow-ups to the brain", () => {
    const intent = resolveContinuationIntent("contame más", {
      lastSectionId: "economia-regional",
      turns: [
        { role: "user", text: "economía regional" },
        { role: "assistant", text: "Esta es economía regional…" },
      ],
    });
    expect(intent).toBeNull();
  });
});

describe("looksIncompleteUtterance with continuation", () => {
  it("does not mark sí explícame as incomplete", () => {
    expect(looksIncompleteUtterance("sí por favor explícame")).toBe(false);
  });
});
