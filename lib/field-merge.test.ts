import { describe, expect, it } from "vitest";
import {
  conflictSpoken,
  mergeFieldsWithConflicts,
} from "@/lib/field-merge";

describe("mergeFieldsWithConflicts", () => {
  it("merges new fields without conflict", () => {
    const result = mergeFieldsWithConflicts(
      { cuit: "20-12345678-9" },
      { email: "a@b.com" }
    );
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.email).toBe("a@b.com");
    expect(result.merged.cuit).toBe("20-12345678-9");
  });

  it("reports conflict when values differ", () => {
    const result = mergeFieldsWithConflicts(
      { cuit: "20-11111111-1" },
      { cuit: "20-22222222-2" }
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.merged.cuit).toBe("20-22222222-2");
    expect(conflictSpoken(result.conflicts)).toMatch(/CUIT/i);
  });
});
