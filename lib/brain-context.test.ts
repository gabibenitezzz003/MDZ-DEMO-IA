import { describe, expect, it } from "vitest";
import {
  buildBrainUserPrompt,
  buildKnowledgeFallback,
  loadSiteMapKnowledge,
} from "@/lib/brain-context";

describe("brain-context", () => {
  it("includes site map knowledge in the prompt", () => {
    const map = loadSiteMapKnowledge();
    expect(map).toMatch(/Mapa del sitio|Dirección de Agricultura/i);

    const prompt = buildBrainUserPrompt({
      text: "que puedo hacer aca",
      originalText: "¿Qué puedo hacer acá?",
      history: [],
      pageContext: { pathname: "/", sectionId: "fruticultura" },
    });
    expect(prompt).toMatch(/CONOCIMIENTO DEL PORTAL/);
    expect(prompt).toMatch(/fruticultura/i);
    expect(prompt).toMatch(/Preguntas abiertas|pregunta o pedido/i);
  });

  it("knowledge fallback avoids generic no entendi", () => {
    const reply = buildKnowledgeFallback({
      text: "algo raro que no existe",
      originalText: "algo raro",
      history: [],
    });
    expect(reply).toMatch(/demo|portal|cultivos/i);
    expect(reply).not.toMatch(/no lo segu[ií]/i);
  });
});
