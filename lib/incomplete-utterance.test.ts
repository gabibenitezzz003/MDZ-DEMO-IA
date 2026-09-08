import { describe, expect, it } from "vitest";
import {
  looksIncompleteUtterance,
  mergeUtterances,
} from "@/lib/incomplete-utterance";

describe("incomplete utterance detection", () => {
  it("flags cut-off explain requests", () => {
    expect(looksIncompleteUtterance("explicame que")).toBe(true);
    expect(looksIncompleteUtterance("eh me podrias")).toBe(true);
  });

  it("does not block substantive explain requests", () => {
    expect(looksIncompleteUtterance("eh me podrias explicar que es")).toBe(false);
    expect(looksIncompleteUtterance("explicame que hace el manejo hidrico")).toBe(
      false
    );
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
