import { describe, expect, it } from "vitest";
import { resolveCatalogIntent } from "@/lib/catalog-intent";
import {
  alignTranscriptToCatalog,
  correctSpeechTranscript,
} from "@/lib/stt-correct";

describe("resolveCatalogIntent", () => {
  it("explains any catalog section without calling the LLM", () => {
    const intent = resolveCatalogIntent("mapas agricolas", "mapas agrícolas", {});
    expect(intent?.action).toBe("navigate");
    expect(intent?.target).toBe("mapas-agricolas");
  });

  it("defers explain requests to the brain", () => {
    const intent = resolveCatalogIntent(
      "que hace frutos secos",
      "explicame qué hace frutos secos",
      {}
    );
    expect(intent).toBeNull();
  });

  it("defers explicamelo follow-up to the brain", () => {
    const intent = resolveCatalogIntent("explicamelo", "explicamelo", {
      lastSectionId: "ciruela",
    });
    expect(intent).toBeNull();
  });

  it("navigates to economía regional when asked to go there", () => {
    const phrase =
      "me podrias llevar a la parte de economia regional por favor";
    const intent = resolveCatalogIntent(phrase, phrase, {});
    expect(intent?.action).toBe("navigate");
    expect(intent?.target).toBe("economia-regional");
    expect(intent?.payload?.click).toBe(true);
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

describe("correctSpeechTranscript", () => {
  it("fixes manejo hídrico and RUT mishearings", () => {
    expect(
      correctSpeechTranscript("llevame al manejo dirico").text
    ).toMatch(/manejo hídrico/i);
    expect(
      correctSpeechTranscript("trámite a ruth por favor").text
    ).toMatch(/trámite al RUT/i);
    expect(correctSpeechTranscript("difundimos en hidrico").text).toMatch(
      /profundicemos/i
    );
  });
});
