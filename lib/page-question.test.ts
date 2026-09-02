import { describe, expect, it } from "vitest";
import {
  wantsExplainCurrentPage,
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
});
