import { describe, expect, it } from "vitest";
import {
  isLikelyUserBargeIn,
  isNearDuplicateHeard,
  isParaphraseOfAssistant,
  looksLikeEcho,
  shouldAcceptVoiceTranscript,
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

  it("drops multi-word fragments copied from the assistant", () => {
    expect(
      looksLikeEcho(
        "informes sobre durazno",
        "En fruticultura vas a encontrar informes sobre durazno, ciruela y vid."
      )
    ).toBe(true);
  });

  it("drops a lone listed option the assistant just said", () => {
    expect(
      looksLikeEcho(
        "RUT",
        "Pedime un cultivo, mapas o el RUT y te llevo."
      )
    ).toBe(true);
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
  it("cuts on any non-echo speech", () => {
    expect(
      shouldCutSpeechOnInterim("y que mas hay", "Te explico fruticultura")
    ).toBe(true);
    expect(
      shouldCutSpeechOnInterim("mostrame el rut", "Te muestro los mapas agrícolas")
    ).toBe(true);
    expect(
      shouldCutSpeechOnInterim("llevame a ciruela", "Te explico fruticultura")
    ).toBe(true);
    expect(shouldCutSpeechOnInterim("parar", "Te explico fruticultura")).toBe(
      true
    );
    expect(shouldCutSpeechOnInterim("para", "Te explico fruticultura")).toBe(
      true
    );
  });

  it("ignores echo that merely mentions whatsapp mid-phrase", () => {
    expect(
      shouldCutSpeechOnInterim(
        "centrarse en el root te atiende una gente por whatsapp valida datos",
        "Para registrarte en el RUT te atiende un agente por WhatsApp: valida datos."
      )
    ).toBe(false);
  });

  it("ignores tiny noise", () => {
    expect(shouldCutSpeechOnInterim("a", "Hola")).toBe(false);
    expect(shouldCutSpeechOnInterim("si", "Hola")).toBe(false);
  });

  it("ignores echo of the assistant without user intent", () => {
    expect(
      shouldCutSpeechOnInterim("fruticultura", "En fruticultura vas a encontrar informes")
    ).toBe(false);
    expect(
      shouldCutSpeechOnInterim(
        "informes sobre durazno",
        "En fruticultura vas a encontrar informes sobre durazno, ciruela y vid."
      )
    ).toBe(false);
  });
});

describe("isParaphraseOfAssistant", () => {
  const spoken =
    "Para registrarte en el RUT te atiende un agente por WhatsApp: valida datos, pide fotos y documentación.";

  it("detects STT echo of the assistant reply", () => {
    expect(
      isParaphraseOfAssistant(
        "centrarse en el root te atiende una gente por whatsapp valida datos",
        spoken
      )
    ).toBe(true);
    expect(
      shouldAcceptVoiceTranscript(
        "centrarse en el root te atiende una gente por whatsapp valida datos",
        spoken
      )
    ).toBe(false);
  });
});

describe("isLikelyUserBargeIn", () => {
  const spoken =
    "En fruticultura vas a encontrar informes sobre durazno, ciruela y vid en Mendoza.";

  it("rejects single-word echo", () => {
    expect(isLikelyUserBargeIn("fruticultura", spoken)).toBe(false);
  });

  it("accepts any real speech that is not echo", () => {
    expect(isLikelyUserBargeIn("llevame a ciruela", spoken)).toBe(true);
    expect(isLikelyUserBargeIn("parar llevame a ciruela", spoken)).toBe(true);
    expect(isLikelyUserBargeIn("parar", spoken)).toBe(true);
    expect(isLikelyUserBargeIn("y que mas hay aca", spoken)).toBe(true);
  });

  it("rejects phrase copied from the assistant", () => {
    expect(
      isLikelyUserBargeIn("durazno ciruela y vid", spoken)
    ).toBe(false);
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
