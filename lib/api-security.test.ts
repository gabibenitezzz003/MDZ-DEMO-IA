import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetRateLimitsForTests,
  ApiSecurityError,
  createSessionToken,
  secureApiRequest,
  verifySessionToken,
} from "@/lib/api-security";

describe("API security", () => {
  beforeEach(() => {
    __resetRateLimitsForTests();
  });

  it("signs sessions and rejects tampered or expired tokens", () => {
    const now = 1_000_000;
    const token = createSessionToken("session-valid-123", now);
    expect(verifySessionToken(token, now + 1)).toBe("session-valid-123");
    expect(verifySessionToken(`${token}x`, now + 1)).toBeNull();
    expect(verifySessionToken(token, now + 9 * 60 * 60 * 1000)).toBeNull();
  });

  it("rejects cross-origin browser requests", () => {
    const request = new NextRequest("http://localhost/api/agent/chat", {
      headers: { origin: "https://evil.example" },
    });
    expect(() => secureApiRequest(request)).toThrowError(ApiSecurityError);
  });

  it("rate limits by endpoint and IP", () => {
    const request = new NextRequest("http://localhost/api/agent/chat", {
      headers: { "x-forwarded-for": "192.0.2.10" },
    });
    secureApiRequest(request, { rateLimit: 2 });
    secureApiRequest(request, { rateLimit: 2 });
    expect(() =>
      secureApiRequest(request, { rateLimit: 2 })
    ).toThrowError(ApiSecurityError);
  });
});
