import { describe, expect, it } from "vitest";
import {
  looksIncompleteUtterance,
  mergeUtterances,
} from "@/lib/incomplete-utterance";

describe("incomplete utterance detection", () => {
  it("flags cut-off explain requests", () => {
    expect(looksIncompleteUtterance("eh me podrias explicar que es")).toBe(true);
    expect(looksIncompleteUtterance("explicame que hace")).toBe(true);
  });

  it("accepts complete requests", () => {
    expect(looksIncompleteUtterance("explicame que es el rut")).toBe(false);
    expect(looksIncompleteUtterance("llevame a ciruela")).toBe(false);
  });

  it("merges continuation chunks", () => {
    expect(
      mergeUtterances("eh me podrias explicar que es", "el rut")
    ).toBe("eh me podrias explicar que es el rut");
  });
});
