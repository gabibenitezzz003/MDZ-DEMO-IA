import { describe, expect, it } from "vitest";
import {
  normalizeWhatsAppNumber,
  wantsRutDemoWizard,
  wantsRutExplainOnly,
  wantsRutNavigate,
  wantsRutWhatsAppHandoff,
} from "@/lib/whatsapp-rut";
import { isLikelyNoiseTranscript } from "@/lib/noise-transcript";

describe("whatsapp rut intent", () => {
  it("routes registration to WhatsApp", () => {
    expect(wantsRutWhatsAppHandoff("Quiero el RUT por WhatsApp")).toBe(true);
    expect(wantsRutWhatsAppHandoff("mostrame el RUT")).toBe(true);
    expect(wantsRutWhatsAppHandoff("quiero registrarme")).toBe(true);
    expect(wantsRutWhatsAppHandoff("RUT")).toBe(false);
    expect(wantsRutWhatsAppHandoff("el RUT")).toBe(false);
  });

  it("keeps explain / wizard demo out of WhatsApp handoff", () => {
    expect(wantsRutExplainOnly("qué es el RUT")).toBe(true);
    expect(wantsRutWhatsAppHandoff("qué es el RUT")).toBe(false);
    expect(wantsRutDemoWizard("abrime el wizard demo")).toBe(true);
    expect(wantsRutWhatsAppHandoff("abrime el wizard demo")).toBe(false);
  });

  it("normalizes phone numbers", () => {
    expect(normalizeWhatsAppNumber("+54 9 261 123-4567")).toBe("5492611234567");
    expect(normalizeWhatsAppNumber("123")).toBeNull();
  });

  it("navigates to rut section with STT homophones", () => {
    expect(wantsRutNavigate("llevame a la parte del root")).toBe(true);
    expect(wantsRutNavigate("RUT")).toBe(true);
    expect(wantsRutWhatsAppHandoff("Quiero el RUT por WhatsApp")).toBe(true);
  });
});

describe("noise transcript filter", () => {
  it("drops tiny / filler STT junk", () => {
    expect(isLikelyNoiseTranscript("eh")).toBe(true);
    expect(isLikelyNoiseTranscript("mm")).toBe(true);
    expect(isLikelyNoiseTranscript("mostrame el rut")).toBe(false);
  });
});
