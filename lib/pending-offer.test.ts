import { describe, expect, it } from "vitest";
import { isOfferConfirmation, isOfferRejection } from "@/lib/pending-offer";
import { wantsOpenResource } from "@/lib/open-resource";
import { wantsRutExplainOnly, wantsRutWhatsAppHandoff } from "@/lib/whatsapp-rut";
import { classifyConversationMode } from "@/lib/local-intent-first";
import { findBestSections } from "@/lib/page-knowledge";

describe("isOfferConfirmation", () => {
  it("accepts the ways a Rioplatense speaker says yes", () => {
    for (const t of [
      "sí",
      "dale",
      "ok",
      "vale",
      "de una",
      "obvio",
      "claro",
      "listo",
      "abrilo",
      "abrímelo",
      "vale, abrímelo por favor",
      "dale abrilo",
      "sí, abrímelo",
      "dale, por favor",
    ]) {
      expect(isOfferConfirmation(t), t).toBe(true);
    }
  });

  it("rejects a no", () => {
    for (const t of ["no", "no gracias", "mejor no", "ahora no", "dejalo"]) {
      expect(isOfferConfirmation(t), t).toBe(false);
      expect(isOfferRejection(t), t).toBe(true);
    }
  });

  it("does not swallow a new request that happens to be polite", () => {
    for (const t of [
      "llevame a mapas agrícolas",
      "dame lo que es manejo hídrico por favor",
      "quiero ver ciruela",
      "abrime el sitio oficial de fenología",
    ]) {
      expect(isOfferConfirmation(t), t).toBe(false);
    }
  });
});

describe("regresiones de la conversación reportada", () => {
  it('trata "lo que es el RUT" como pedido, no como la pregunta "qué es el RUT"', () => {
    // Muletilla rioplatense: "lo que es X" == "X".
    expect(wantsRutExplainOnly("llevame a lo que es el RUT por WhatsApp")).toBe(
      false
    );
    expect(wantsRutWhatsAppHandoff("llevame a lo que es el RUT por WhatsApp")).toBe(
      true
    );
    // La pregunta real sigue funcionando.
    expect(wantsRutExplainOnly("¿qué es el RUT?")).toBe(true);
    expect(wantsRutExplainOnly("explicame el RUT")).toBe(true);
  });

  it("no confunde una confirmación pelada con abrir el portal oficial", () => {
    // "abrímelo" contiene "abrime": antes esto abría la última sección visitada.
    expect(wantsOpenResource("vale, abrímelo por favor")).toBe(false);
    expect(wantsOpenResource("dale, abrilo")).toBe(false);
    // Pedir el recurso por su nombre sí abre.
    expect(wantsOpenResource("abrí el sitio oficial")).toBe(true);
    expect(wantsOpenResource("mandame el link")).toBe(true);
    expect(wantsOpenResource("no se abrió")).toBe(true);
  });
});

describe("una sección nombrada gana sobre el contexto viejo", () => {
  it("clasifica 'mandame a X' como navegación", () => {
    for (const t of [
      "me podrias mandar a fruticultura",
      "mandame a horticultura",
      "pasame a frutos secos",
    ]) {
      expect(classifyConversationMode(t), t).toBe("navigate");
    }
  });

  it("puntúa alto las secciones que el usuario nombra literalmente", () => {
    // El umbral del override en la ruta es 8: estas tienen que superarlo.
    for (const [t, id] of [
      ["Me podrias mandar a fruticultura y explicarme que es lo que es", "fruticultura"],
      ["Perdon, me equivoque. Era durazno-industria", "durazno"],
      ["Perdon, era Horticultura", "horticultura"],
    ] as const) {
      const best = findBestSections(t, 1)[0];
      expect(best?.id, t).toBe(id);
      expect(best?.score, t).toBeGreaterThanOrEqual(8);
    }
  });

  it("no confunde una mención de cultivo con contexto biográfico navegable", () => {
    // "Era durazno-industria" nombra sección; "tengo durazno" es contexto.
    expect(findBestSections("Perdon, me equivoque. Era durazno-industria", 1)[0]?.score)
      .toBeGreaterThanOrEqual(8);
  });
});
