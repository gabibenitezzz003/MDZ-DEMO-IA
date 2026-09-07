import { describe, expect, it } from "vitest";
import { resolveCatalogIntent } from "@/lib/catalog-intent";
import { alignTranscriptToCatalog } from "@/lib/stt-correct";

describe("resolveCatalogIntent", () => {
  it("explains any catalog section without calling the LLM", () => {
    const intent = resolveCatalogIntent("mapas agricolas", "mapas agrícolas", {});
    expect(intent?.action).toBe("navigate");
    expect(intent?.target).toBe("mapas-agricolas");
  });

  it("explains on ask mode", () => {
    const intent = resolveCatalogIntent(
      "que hace frutos secos",
      "explicame qué hace frutos secos",
      {}
    );
    expect(intent?.action).toBe("describe");
    expect(intent?.target).toBe("frutos-secos");
    expect(intent?.reply).toMatch(/frutos secos|nuez|almendra/i);
  });

  it("follow-up explicamelo uses last section", () => {
    const intent = resolveCatalogIntent("explicamelo", "explicamelo", {
      lastSectionId: "ciruela",
    });
    expect(intent?.target).toBe("ciruela");
    expect(intent?.action).toBe("describe");
  });
});

describe("alignTranscriptToCatalog", () => {
  it("fixes common demo mishearings", () => {
    expect(alignTranscriptToCatalog("fruto seco").text).toMatch(/frutos secos/i);
    expect(alignTranscriptToCatalog("fruta cultura").text).toMatch(
      /fruticultura/i
    );
    expect(alignTranscriptToCatalog("mapa agricola").text).toMatch(
      /mapas agrícolas/i
    );
  });
});
