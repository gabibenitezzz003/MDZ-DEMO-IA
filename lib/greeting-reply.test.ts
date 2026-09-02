import { describe, expect, it } from "vitest";
import { askedHowAreYou, greetingReply } from "@/lib/greeting-reply";

describe("greetingReply", () => {
  it("answers how-are-you instead of listing trámites", () => {
    expect(askedHowAreYou("Hola, ¿cómo estás?")).toBe(true);
    const reply = greetingReply("Hola, ¿cómo estás?");
    expect(reply).toMatch(/bien|gracias|andamos/i);
    expect(reply).not.toMatch(/QR|RUT|cultivo|mapas/i);
  });

  it("keeps a short hola warm and open", () => {
    expect(askedHowAreYou("hola")).toBe(false);
    expect(greetingReply("hola")).toMatch(/hola|buenas|ayudo|necesit/i);
  });

  it("greets the engineering view without opening the producer path", () => {
    const reply = greetingReply("hola como estas", 1, { mode: "engineering" });
    expect(reply).toMatch(/ingenier|técnic|QR|formulario|recorrido/i);
    expect(reply).not.toMatch(/WhatsApp|registrarte/i);
  });
});

