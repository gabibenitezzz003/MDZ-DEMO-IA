import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWhatsAppCampoUrl,
  getWhatsAppCampoNumber,
} from "@/lib/whatsapp-odk";

const originalOdk = process.env.WHATSAPP_ODK_NUMBER;
const originalRut = process.env.WHATSAPP_RUT_NUMBER;

afterEach(() => {
  if (originalOdk === undefined) delete process.env.WHATSAPP_ODK_NUMBER;
  else process.env.WHATSAPP_ODK_NUMBER = originalOdk;
  if (originalRut === undefined) delete process.env.WHATSAPP_RUT_NUMBER;
  else process.env.WHATSAPP_RUT_NUMBER = originalRut;
  vi.unstubAllEnvs();
});

describe("whatsapp campo number", () => {
  it("uses WHATSAPP_ODK_NUMBER when set", () => {
    vi.stubEnv("WHATSAPP_ODK_NUMBER", "5492613417054");
    vi.stubEnv("WHATSAPP_RUT_NUMBER", "5492612507736");
    expect(getWhatsAppCampoNumber()).toBe("5492613417054");
    expect(buildWhatsAppCampoUrl("hola")).toContain("5492613417054");
    expect(buildWhatsAppCampoUrl("hola")).not.toContain("5492612507736");
  });

  it("falls back to the RUT number if ODK is missing", () => {
    vi.stubEnv("WHATSAPP_ODK_NUMBER", "");
    vi.stubEnv("WHATSAPP_RUT_NUMBER", "5492612507736");
    expect(getWhatsAppCampoNumber()).toBe("5492612507736");
  });
});
