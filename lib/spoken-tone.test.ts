import { describe, expect, it } from "vitest";
import { neutralizeToUsted } from "@/lib/spoken-tone";

describe("neutralizeToUsted", () => {
  it("converts common voseo to usted", () => {
    expect(neutralizeToUsted("Dale, decime el CUIT y tocá el botón")).toMatch(
      /De acuerdo|dígame|toque/i
    );
    expect(neutralizeToUsted("Tenés razón, pasame el mail")).toMatch(
      /Tiene razón|páseme/i
    );
  });

  it("keeps already neutral phrases readable", () => {
    const out = neutralizeToUsted(
      "De acuerdo, le abro el recurso oficial en otra pestaña."
    );
    expect(out).toMatch(/recurso oficial/i);
  });
});
