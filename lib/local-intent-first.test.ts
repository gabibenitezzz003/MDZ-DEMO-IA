import { describe, expect, it } from "vitest";
import {
  classifyConversationMode,
  resolveLocalIntent,
} from "@/lib/local-intent-first";

describe("local-first presentation intents", () => {
  it.each([
    ["Qué es el QR", "odk-collect"],
    ["Quién es el director", "autoridades"],
    ["Mapas agrícolas", "mapas-agricolas"],
  ])("resolves %s without waiting for Gemini", (text, target) => {
    expect(resolveLocalIntent(text, text, [])?.target).toBe(target);
  });

  it.each([
    ["Qué podés hacer", "describe"],
    ["Volvé al inicio", "go_home"],
    ["Bajá un poco", "scroll"],
  ])("keeps known command %s fully local", (text, action) => {
    expect(resolveLocalIntent(text, text, [])?.action).toBe(action);
  });

  it("answers a thematic question without opening the official site", () => {
    const text = "Tengo ciruela, ¿para qué sirve la fenología?";
    expect(classifyConversationMode(text)).toBe("explain");
    expect(resolveLocalIntent(text, text, [])).toMatchObject({
      action: "describe",
      target: "fenologia",
      payload: { openLink: false },
    });
  });

  it("answers a greeting without jumping to RUT", () => {
    expect(resolveLocalIntent("hola como estas", "hola como estas", [])).toMatchObject({
      action: "describe",
    });
    expect(resolveLocalIntent("hola como estas", "hola como estas", [])?.target).toBeUndefined();
    expect(resolveLocalIntent("RUT", "RUT", [])).toMatchObject({
      action: "navigate",
      target: "rut",
    });
    expect(resolveLocalIntent("RUT", "RUT", [])?.action).not.toBe("open_whatsapp");
  });

  it("keeps an explicit navigation request as navigation", () => {
    const text = "Llevame a fenología";
    expect(classifyConversationMode(text)).toBe("navigate");
    expect(resolveLocalIntent(text, text, [])?.action).toBe("navigate");
  });
});
