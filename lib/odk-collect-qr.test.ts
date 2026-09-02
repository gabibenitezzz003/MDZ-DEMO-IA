import { describe, expect, it } from "vitest";
import {
  decodeOdkCollectPayload,
  DEFAULT_ODK_SETTINGS,
  encodeOdkCollectPayload,
} from "@/lib/odk-collect-qr";

describe("ODK Collect QR payload", () => {
  it("round-trips gzip+base64 settings Collect can import", () => {
    const payload = encodeOdkCollectPayload(DEFAULT_ODK_SETTINGS);
    expect(payload.length).toBeGreaterThan(20);
    expect(payload).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decodeOdkCollectPayload(payload)).toMatchObject({
      general: {
        protocol: "odk_default",
      },
      project: {
        name: DEFAULT_ODK_SETTINGS.project.name,
      },
    });
    expect(decodeOdkCollectPayload(payload).general.server_url).toMatch(
      /^https:\/\//
    );
  });
});
