import { describe, expect, it } from "vitest";
import {
  normalizeAudioMime,
  parseGeminiTranscript,
} from "@/lib/gemini-stt";

describe("gemini-stt", () => {
  it("normalizes browser recorder mime types", () => {
    expect(normalizeAudioMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioMime("audio/ogg")).toBe("audio/ogg");
  });

  it("parses gemini transcript variants", () => {
    expect(parseGeminiTranscript("Hola")).toBe("Hola");
    expect(parseGeminiTranscript('"hola"')).toBe("hola");
    expect(parseGeminiTranscript("Transcripción: buenas")).toBe("buenas");
    expect(parseGeminiTranscript("vacío")).toBeNull();
    expect(parseGeminiTranscript("")).toBeNull();
  });
});
