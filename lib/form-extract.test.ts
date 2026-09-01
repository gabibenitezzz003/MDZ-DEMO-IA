import { describe, expect, it } from "vitest";
import { detectFillPreference } from "@/lib/form-extract";

describe("detectFillPreference", () => {
  it("does not treat bare seguimos as auto-fill", () => {
    expect(detectFillPreference("seguimos")).toBe(null);
    expect(detectFillPreference("seguimos a autoridades")).toBe(null);
  });

  it("still detects explicit complete/confirm", () => {
    expect(detectFillPreference("completalo vos")).toBe("auto");
    expect(detectFillPreference("confirmá")).toBe("auto");
    expect(detectFillPreference("lo cargo a mano")).toBe("manual");
  });
});
