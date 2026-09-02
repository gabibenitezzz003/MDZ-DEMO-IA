import { describe, expect, it } from "vitest";
import {
  isEngineeringPath,
  resolveEngineeringQuestion,
  wantsEngineeringTour,
} from "@/lib/engineering-qa";
import { buildEngineeringTourBeats } from "@/lib/engineering-tour";
import { sectionHashUrl } from "@/lib/page-context";

describe("engineering voice QA", () => {
  it("keeps engineering hashes on /ingenieria", () => {
    expect(sectionHashUrl("/ingenieria", "odk-forms")).toBe(
      "/ingenieria#odk-forms"
    );
    expect(sectionHashUrl("/", "ciruela")).toBe("/#ciruela");
  });

  it("detects the engineering path", () => {
    expect(isEngineeringPath("/ingenieria")).toBe(true);
    expect(isEngineeringPath("/ingenieria#odk-forms")).toBe(true);
    expect(isEngineeringPath("/")).toBe(false);
  });

  it("starts a technical tour only with explicit engineering language", () => {
    expect(wantsEngineeringTour("recorrido técnico")).toBe(true);
    expect(wantsEngineeringTour("explicame ODK")).toBe(true);
    expect(wantsEngineeringTour("mostrame el flujo")).toBe(true);
    expect(wantsEngineeringTour("explicame todo")).toBe(false);
    expect(wantsEngineeringTour("mostrame todo")).toBe(false);
    expect(wantsEngineeringTour("demo guiada")).toBe(false);
  });

  it("does not steal producer crop fenología off the engineering page", () => {
    expect(
      resolveEngineeringQuestion(
        "Tengo ciruela, ¿para qué sirve la fenología?",
        { inEngineeringView: false }
      )
    ).toBeNull();
  });

  it("maps fenología to the official forms while in engineering", () => {
    const hit = resolveEngineeringQuestion("Fenología 2026", {
      inEngineeringView: true,
    });
    expect(hit).toMatchObject({
      action: "navigate",
      target: "odk-forms",
    });
    expect(hit?.reply).toMatch(/Fincas y Cuarteles|Visitas Técnicas/i);
  });

  it("lists published forms", () => {
    const hit = resolveEngineeringQuestion("qué formularios hay", {
      inEngineeringView: true,
    });
    expect(hit?.target).toBe("odk-forms");
    expect(hit?.reply).toMatch(/cinco/i);
    expect(hit?.reply).toMatch(/Certificación de Equipos/i);
  });

  it("explains the official QR in human language", () => {
    const hit = resolveEngineeringQuestion("Qué es el QR", {
      inEngineeringView: false,
    });
    expect(hit?.target).toBe("odk-collect");
    expect(hit?.reply).toMatch(/Collect|Agricultura Mendoza|proyecto 4/i);
    expect(hit?.reply).not.toMatch(/registrate|te abro WhatsApp/i);
  });

  it("builds a short engineering tour with QR and forms", () => {
    const beats = buildEngineeringTourBeats();
    expect(beats.map((b) => b.target)).toEqual([
      "ingenieria",
      "odk-tablero",
      "odk-collect",
      "odk-flujo",
      "odk-forms",
    ]);
    expect(beats.some((b) => b.skipUnlessChoice === "qr")).toBe(true);
  });
});
