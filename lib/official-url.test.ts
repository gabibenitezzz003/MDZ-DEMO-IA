import { describe, expect, it } from "vitest";
import { isAllowedOfficialUrl } from "@/lib/official-url";

describe("isAllowedOfficialUrl", () => {
  it("allows sitios.mendoza.gob.ar", () => {
    expect(
      isAllowedOfficialUrl(
        "https://sitios.mendoza.gob.ar/produccion/direccion-de-agricultura/"
      )
    ).toBe(true);
  });

  it("allows informacionoficial.mendoza.gob.ar", () => {
    expect(
      isAllowedOfficialUrl(
        "https://informacionoficial.mendoza.gob.ar/produccion/ciruelas/"
      )
    ).toBe(true);
  });

  it("allows sia.mendoza.gov.ar", () => {
    expect(
      isAllowedOfficialUrl("https://sia.mendoza.gov.ar/account/login")
    ).toBe(true);
  });

  it("allows catalog external URLs (Looker, NotebookLM)", () => {
    expect(
      isAllowedOfficialUrl(
        "https://lookerstudio.google.com/reporting/dd323f33-73a9-4231-884e-d2851a7274c3"
      )
    ).toBe(true);
    expect(
      isAllowedOfficialUrl(
        "https://notebooklm.google.com/notebook/e1284bb0-5039-43a0-beaf-8ade96cc7586"
      )
    ).toBe(true);
  });

  it("rejects arbitrary domains", () => {
    expect(isAllowedOfficialUrl("https://evil.example/phish")).toBe(false);
  });
});
