import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/agent/action/route";

function request(target: string) {
  return new NextRequest("http://localhost/api/agent/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-security-test",
      action: "open_external",
      target,
    }),
  });
}

describe("external agent actions", () => {
  it("rejects arbitrary external domains", async () => {
    const response = await POST(request("https://evil.example/phishing"));
    expect(response.status).toBe(400);
  });

  it("allows official Mendoza domains", async () => {
    const response = await POST(
      request("https://www.mendoza.gov.ar/economia/")
    );
    expect(response.status).toBe(200);
  });
});
