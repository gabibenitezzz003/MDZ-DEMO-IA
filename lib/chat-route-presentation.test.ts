import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/elevenlabs", () => ({
  synthesizeSpeech: vi.fn(async () => null),
}));

import { POST } from "@/app/api/agent/chat/route";

describe("chat route presentation actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the educational ODK QR inside the demo page", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-qr-local",
        text: "Qué es el QR",
        context: { pathname: "/", sectionId: "rut" },
      }),
    });
    const response = await POST(req as never);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.event).toMatchObject({
      action: "navigate",
      target: "odk-collect",
      payload: { openLink: false },
    });
  });

  it("answers hola como estas without opening RUT or WhatsApp", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-greeting-human",
        text: "hola como estas",
        context: { pathname: "/", sectionId: "tramites" },
      }),
    });
    const response = await POST(req as never);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.event?.action).not.toBe("open_whatsapp");
    expect(data.event?.action).not.toBe("open_rut");
    expect(data.event?.target).not.toBe("rut");
    expect(String(data.reply || data.spoken)).toMatch(
      /bien|gracias|andamos|necesit|ayudo/i
    );
    expect(String(data.reply || data.spoken)).not.toMatch(/Q R|registro de tierras/i);
  });

  it("does not start RUT when a producer only shares context", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-producer-context",
        text: "Me llamo Pedro y tengo una finca de ciruela en Tunuyán",
        context: { pathname: "/" },
      }),
    });
    const response = await POST(req as never);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.event?.action).not.toBe("open_rut");
    expect(data.event?.action).not.toBe("open_whatsapp");
  });

  it("answers a crop question without opening an external page", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-fenologia-question",
        text: "Tengo ciruela, ¿para qué sirve la fenología?",
        context: { pathname: "/" },
      }),
    });
    const response = await POST(req as never);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.event).toMatchObject({
      action: "describe",
      target: "fenologia",
      payload: { openLink: false },
    });
    expect(data.reply).not.toMatch(/abr[ií].*otra pestaña/i);
  });

  it("lists official forms on the engineering page", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-eng-forms-list",
        text: "qué formularios hay",
        context: { pathname: "/ingenieria", sectionId: "ingenieria" },
      }),
    });
    const response = await POST(req as never);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.event).toMatchObject({
      action: "navigate",
      target: "odk-forms",
      payload: { openLink: false },
    });
    expect(String(data.reply || data.spoken)).toMatch(/cinco/i);
    expect(String(data.reply || data.spoken)).toMatch(
      /Certificaci[oó]n de Equipos/i
    );
  });

  it("maps fenología to ODK forms on /ingenieria, not the crop page", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-eng-fenologia",
        text: "Fenología 2026",
        context: { pathname: "/ingenieria", sectionId: "ingenieria" },
      }),
    });
    const response = await POST(req as never);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.event?.target).toBe("odk-forms");
    expect(data.event?.target).not.toBe("fenologia");
    expect(String(data.reply || data.spoken)).toMatch(/fincas|visitas/i);
  });

  it("greets on /ingenieria without opening RUT or WhatsApp", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-eng-greeting",
        text: "hola como estas",
        context: { pathname: "/ingenieria", sectionId: "ingenieria" },
      }),
    });
    const response = await POST(req as never);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.event?.action).not.toBe("open_whatsapp");
    expect(data.event?.action).not.toBe("open_rut");
    expect(data.event?.target).not.toBe("rut");
    expect(String(data.reply || data.spoken)).toMatch(
      /ingenier|técnic|QR|formulario|recorrido/i
    );
  });

  it("starts the engineering tour from /ingenieria demo guiada", async () => {
    const req = new Request("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "test-eng-tour",
        text: "demo guiada",
        context: { pathname: "/ingenieria", sectionId: "ingenieria" },
      }),
    });
    const response = await POST(req as never);
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.startTour).toBe("engineering");
    expect(String(data.reply || data.spoken)).toMatch(
      /ingenier|tablero|formulario|collect/i
    );
  });
});

