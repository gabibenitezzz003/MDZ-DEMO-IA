import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeWithSpeaches } from "@/lib/speaches-stt";

describe("transcribeWithSpeaches", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the local Spanish Whisper service with demo vocabulary", async () => {
    vi.stubEnv("SPEACHES_URL", "http://127.0.0.1:8771");
    vi.stubEnv("SPEACHES_STT_MODEL", "Systran/faster-whisper-small");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("model")).toBe("Systran/faster-whisper-small");
      expect(form.get("language")).toBe("es");
      expect(String(form.get("hotwords"))).not.toContain("RUT");
      expect(String(form.get("prompt"))).toMatch(/hola/i);
      expect(form.get("vad_filter")).toBe("true");
      return new Response(JSON.stringify({ text: "quiero registrar el RUT" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transcribeWithSpeaches(Buffer.alloc(500, 1), "audio/webm")
    ).resolves.toBe("quiero registrar el RUT");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8771/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("falls back cleanly when the local service is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("offline", { status: 503 })));

    await expect(
      transcribeWithSpeaches(Buffer.alloc(500, 1), "audio/webm")
    ).resolves.toBeNull();
  });
});
