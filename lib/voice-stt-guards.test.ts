import { describe, expect, it } from "vitest";
import {
  isNearDuplicateHeard,
  looksLikeEcho,
  shouldCutSpeechOnInterim,
} from "@/lib/voice-stt-guards";

describe("looksLikeEcho", () => {
  it("does not block short user commands that share vocabulary", () => {
    expect(
      looksLikeEcho("mostrame el rut", "Dale, te abro el wizard del RUT")
    ).toBe(false);
    expect(
      looksLikeEcho("parar", "Buenas. Soy el asistente de Agricultura")
    ).toBe(false);
  });

  it("detects near-full echo of the assistant line", () => {
    expect(
      looksLikeEcho(
        "dale te abro el wizard del rut",
        "Dale, te abro el wizard del RUT"
      )
    ).toBe(true);
  });
});

describe("shouldCutSpeechOnInterim", () => {
  it("cuts on real interim speech", () => {
    expect(
      shouldCutSpeechOnInterim("mostrame", "Te muestro los mapas agrícolas")
    ).toBe(true);
  });

  it("ignores tiny noise", () => {
    expect(shouldCutSpeechOnInterim("a", "Hola")).toBe(false);
  });
});

describe("isNearDuplicateHeard", () => {
  it("dedupes same utterance", () => {
    expect(
      isNearDuplicateHeard("ya te lo habia pasado", "ya te lo había pasado")
    ).toBe(true);
  });

  it("allows a corrected follow-up", () => {
    expect(
      isNearDuplicateHeard("mostrame el rut", "mostrame los mapas")
    ).toBe(false);
  });
});
