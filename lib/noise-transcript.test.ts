import { describe, expect, it } from "vitest";
import { isLikelyNoiseTranscript } from "@/lib/noise-transcript";

describe("isLikelyNoiseTranscript", () => {
  it("drops empty and filler audio", () => {
    for (const t of ["", "   ", ".", "...", "eh", "mmm", "ahh", "eh mm", "♪♪♪"]) {
      expect(isLikelyNoiseTranscript(t), t).toBe(true);
    }
  });

  it("drops the YouTube-style hallucinations Whisper emits on silence", () => {
    const hallucinations = [
      "Subtítulos realizados por la comunidad de Amara.org",
      "Subtitulado por la comunidad de Amara.org",
      "Más información en www.amara.org",
      "Subtitles by the Amara.org community",
      "¡Gracias por ver el video!",
      "Gracias por ver este video, nos vemos en el próximo",
      "Gracias por su atención",
      "¡Suscríbete!",
      "No olvides suscribirte al canal",
      "Nos vemos en el próximo video",
      "Hasta la próxima",
      "Thanks for watching!",
      "[Música]",
      "(Aplausos)",
      "Música",
      "Copyright 2024",
    ];
    for (const t of hallucinations) {
      expect(isLikelyNoiseTranscript(t), t).toBe(true);
    }
  });

  it("drops bare courtesies that are almost always hallucinated", () => {
    for (const t of ["Gracias.", "Muchas gracias", "Bye", "Chau", "Thank you"]) {
      expect(isLikelyNoiseTranscript(t), t).toBe(true);
    }
  });

  it("drops decoder loops", () => {
    expect(isLikelyNoiseTranscript("gracias gracias gracias")).toBe(true);
    expect(isLikelyNoiseTranscript("no no no no")).toBe(true);
  });

  it("drops stray short tokens that are not demo commands", () => {
    for (const t of ["you", "de", "por", "un", "the"]) {
      expect(isLikelyNoiseTranscript(t), t).toBe(true);
    }
  });

  it("keeps short demo commands", () => {
    for (const t of ["sí", "no", "dale", "hola", "RUT", "QR", "ajo", "mapas", "listo"]) {
      expect(isLikelyNoiseTranscript(t), t).toBe(false);
    }
  });

  it("keeps single words with actual meaning", () => {
    for (const t of ["ciruela", "durazno", "capacitaciones", "contacto", "olivo"]) {
      expect(isLikelyNoiseTranscript(t), t).toBe(false);
    }
  });

  it("keeps real requests, including ones that open with a courtesy", () => {
    const real = [
      "Quiero inscribirme en el RUT",
      "¿Dónde están los mapas agrícolas?",
      "Gracias, ahora mostrame el radar meteorológico",
      "Necesito información de ciruela",
      "Soy locatario, ¿qué papeles llevo?",
      "Mostrame el paso 4",
    ];
    for (const t of real) {
      expect(isLikelyNoiseTranscript(t), t).toBe(false);
    }
  });
});
