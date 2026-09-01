import { describe, expect, it } from "vitest";
import { matchTourChoice, type TourChoice } from "@/lib/demo-tour";

const choices: TourChoice[] = [
  {
    id: "official",
    label: "Abrir oficial",
    match: /oficial/i,
  },
  {
    id: "continue",
    label: "Seguir",
    match: /segui/i,
  },
];

describe("matchTourChoice", () => {
  it("maps dale/ok to continue, not official", () => {
    expect(matchTourChoice("dale", choices)).toBe("continue");
    expect(matchTourChoice("ok", choices)).toBe("continue");
  });

  it("still matches explicit official", () => {
    expect(matchTourChoice("abrí el oficial", choices)).toBe("official");
  });
});
