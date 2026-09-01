import { describe, expect, it } from "vitest";
import {
  recallConflictSpoken,
  wantsRecallPriorFields,
} from "@/lib/rut-conversation";

describe("wantsRecallPriorFields", () => {
  it("detects ya te lo había pasado variants", () => {
    expect(wantsRecallPriorFields("ya te lo había pasado")).toBe(true);
    expect(wantsRecallPriorFields("Ya te lo pase")).toBe(true);
    expect(wantsRecallPriorFields("mostrame el rut")).toBe(false);
  });
});

describe("recallConflictSpoken", () => {
  it("asks again when missing", () => {
    const text = recallConflictSpoken("el correo electrónico", {
      cuit: "20-12345678-9",
    });
    expect(text).toMatch(/Tenés razón|correo/i);
  });
});
