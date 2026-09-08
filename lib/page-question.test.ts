import { describe, expect, it } from "vitest";
import {
  hadRecentExplainAsk,
  resolveExplainSectionId,
  wantsAnyExplain,
  wantsExplainCurrentPage,
  wantsExplainFollowUp,
  wantsExplainNamedSection,
  wantsPageCapabilities,
  wantsPageLocation,
} from "@/lib/page-question";

describe("page-aware voice questions", () => {
  it("understands accented location questions", () => {
    expect(wantsPageLocation("¿Dónde estoy?")).toBe(true);
    expect(wantsPageLocation("¿En qué sección me dejaste?")).toBe(true);
  });

  it("understands accented explanation questions", () => {
    expect(wantsExplainCurrentPage("Explícame esto")).toBe(true);
    expect(wantsExplainCurrentPage("¿Qué hay acá?")).toBe(true);
  });

  it("understands follow-up explain pronouns", () => {
    expect(wantsExplainFollowUp("explicamelo")).toBe(true);
    expect(wantsExplainFollowUp("contame mas")).toBe(true);
    expect(wantsAnyExplain("explicame que hace frutos secos")).toBe(true);
  });

  it("resolves explain target from context or named section", () => {
    expect(
      resolveExplainSectionId("explicamelo", {
        lastSectionId: "frutos-secos",
      })
    ).toBe("frutos-secos");
    expect(
      resolveExplainSectionId("explicame que hace frutos secos", {
        lastSectionId: "mapas-agricolas",
        namedSectionId: "frutos-secos",
        namesSection: true,
      })
    ).toBe("frutos-secos");
  });

  it("detects repeated explain asks", () => {
    expect(
      hadRecentExplainAsk([
        { role: "user", text: "explicame esto" },
        { role: "assistant", text: "Estás en mapas" },
        { role: "user", text: "explicame esto otra vez" },
      ])
    ).toBe(true);
  });

  it("matches named section explain phrasing", () => {
    expect(wantsExplainNamedSection("explicame que hace frutos secos")).toBe(
      true
    );
  });

  it("understands what can I do on this page (brain-first, not hardcoded)", () => {
    expect(
      wantsPageCapabilities("¿Me podrías explicar qué puedo hacer en esta página?")
    ).toBe(true);
    expect(wantsAnyExplain("¿Me podrías explicar qué puedo hacer en esta página?")).toBe(
      false
    );
  });
});
