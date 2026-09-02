import { describe, expect, it } from "vitest";
import { createVadGate, stepVadGate } from "@/lib/mic-capture";

describe("stepVadGate", () => {
  it("does not treat a single loud noise spike as barge-in", () => {
    const gate = createVadGate();
    expect(stepVadGate(gate, 0.12, 0.1, 40).barge).toBe(false);
  });

  it("recognizes sustained voice as intentional barge-in", () => {
    const gate = createVadGate();
    const frames = Array.from({ length: 6 }, () =>
      stepVadGate(gate, 0.08, 0.42, 40)
    );
    expect(frames.some((frame) => frame.barge)).toBe(true);
  });
});
