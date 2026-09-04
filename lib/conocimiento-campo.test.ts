import { describe, expect, it } from "vitest";
// @ts-expect-error — módulo .mjs sin tipos, se consume tal cual desde n8n.
import * as KB from "../n8n/conocimiento-campo.mjs";

describe("detección de dominio", () => {
  it("reconoce el cultivo por como se lo nombra en campo", () => {
    const casos: Array<[string, string]> = [
      ["encontré un olivo abandonado", "olivo"],
      ["tengo un parral de malbec", "vid"],
      ["la viña está en brotación", "vid"],
      ["pavía Ross en el cuartel 3", "durazno industria"],
      ["ciruela D'Agen para desecado", "ciruela"],
      ["nuez Chandler", "nogal"],
      ["ajo colorado", "ajo"],
      ["almendro Guara", "almendro"],
    ];
    for (const [texto, esperado] of casos) {
      expect(KB.detectarCultivo(texto), texto).toBe(esperado);
    }
  });

  it("no inventa cultivo cuando no lo hay", () => {
    expect(KB.detectarCultivo("hola, cómo andás")).toBeNull();
  });

  it("cuando hay dos cultivos, gana el que se nombra primero", () => {
    // El sujeto de la frase es el primero; el segundo suele ser el vecino.
    expect(
      KB.detectarCultivo("encontré un olivo abandonado en Rivadavia, al lado de vid")
    ).toBe("olivo");
    expect(KB.detectarCultivo("vid con un olivo en la cabecera")).toBe("vid");
    expect(KB.detectarCultivo("durazno consociado con ajo")).toBe("durazno industria");
  });

  it("ubica departamento y zona", () => {
    expect(KB.detectarDepartamento("un lote en Tunuyán")).toEqual({
      departamento: "Tunuyán",
      zona: "Valle de Uco",
    });
    expect(KB.detectarDepartamento("por Rivadavia")?.zona).toBe("Este");
    expect(KB.detectarDepartamento("en Maipu")?.zona).toBe("Norte");
  });

  it("reconoce estadios fenológicos como los dice un técnico", () => {
    expect(KB.detectarEstadio("está en plena flor")).toBe("plena floración");
    expect(KB.detectarEstadio("recién brotando")).toBe("punta verde");
    expect(KB.detectarEstadio("ya está en envero")).toBe("envero");
  });
});

describe("alerta de helada", () => {
  it("avisa en floración dentro de la ventana de riesgo", () => {
    const septiembre = new Date(2026, 8, 15);
    const r = KB.riesgoHelada("plena floración", septiembre.getMonth());
    expect(r).not.toBeNull();
    expect(r.dañoLeveDesde).toBe("-2.8 °C");
  });

  it("no alerta fuera de la ventana", () => {
    const febrero = 1;
    expect(KB.riesgoHelada("plena floración", febrero)).toBeNull();
  });

  it("la temperatura crítica sube a medida que avanza el estadio", () => {
    // Cuanto más avanzado el estadio, menos frío tolera.
    const orden = ["yema hinchada", "botón rosado", "plena floración", "fruto recién cuajado"];
    const t10 = orden.map(
      (e) => KB.HELADA_CRITICA.find((h: { estadio: string }) => h.estadio === e).t10
    );
    for (let i = 1; i < t10.length; i += 1) {
      expect(t10[i], orden[i]).toBeGreaterThan(t10[i - 1]);
    }
  });
});

describe("dossier para el modelo", () => {
  it("arma contexto completo desde una frase de campo", () => {
    const d = KB.construirDossier(
      "visita de ciruela en floración en Tunuyán",
      new Date(2026, 8, 10)
    );
    expect(d.cultivo.clave).toBe("ciruela");
    expect(d.ubicacion.zona).toBe("Valle de Uco");
    expect(d.estadioDetectado).toBe("plena floración");
    expect(d.alertaHelada).toBeTruthy();
    // Ciruela tiene mosca del Mediterráneo: debe traer el marco cuarentenario.
    expect(d.cuarentenarias).toContain(
      "Mosca del Mediterráneo (Ceratitis capitata)"
    );
  });

  it("no manda el catálogo entero cuando no hay cultivo detectado", () => {
    const d = KB.construirDossier("hola, buenas", new Date(2026, 8, 10));
    expect(d.cultivo).toBeUndefined();
    expect(JSON.stringify(d).length).toBeLessThan(500);
  });

  it("mantiene el dossier acotado incluso con cultivo", () => {
    const d = KB.construirDossier("vid malbec en Luján de Cuyo", new Date(2026, 8, 10));
    // El catálogo completo son varios kB: el recorte es lo que hace viable
    // mandar esto en cada turno.
    const completo = JSON.stringify(KB.CONOCIMIENTO).length;
    const recorte = JSON.stringify(d).length;
    expect(recorte).toBeLessThan(completo / 2);
  });
});

describe("integridad de la base", () => {
  it("todo cultivo tiene fenología con meses", () => {
    for (const [clave, c] of Object.entries<Record<string, unknown>>(KB.CULTIVOS)) {
      const fen = c.fenologia as Array<{ nombre: string; meses: string }>;
      expect(Array.isArray(fen), clave).toBe(true);
      expect(fen.length, clave).toBeGreaterThan(2);
      for (const paso of fen) {
        expect(paso.nombre, clave).toBeTruthy();
        expect(paso.meses, `${clave}/${paso.nombre}`).toBeTruthy();
      }
    }
  });

  it("cada departamento pertenece a una sola zona", () => {
    const vistos = new Set<string>();
    for (const info of Object.values<{ departamentos: string[] }>(KB.ZONAS)) {
      for (const d of info.departamentos) {
        expect(vistos.has(d), `${d} duplicado`).toBe(false);
        vistos.add(d);
      }
    }
    // Mendoza tiene 18 departamentos.
    expect(vistos.size).toBe(18);
  });

  it("las plagas cuarentenarias declaran su marco normativo", () => {
    for (const p of KB.PLAGAS_CUARENTENARIAS) {
      expect(p.marco).toBeTruthy();
      expect(p.accion).toBeTruthy();
    }
  });

  it("toda plaga marcada cuarentenaria existe en el marco normativo", () => {
    // Los nombres tienen que coincidir exactamente entre el cultivo y el marco:
    // si no, el dossier referencia una plaga sin decir qué hacer con ella.
    const conMarco = new Set(
      KB.PLAGAS_CUARENTENARIAS.map((p: { nombre: string }) => p.nombre)
    );
    for (const [clave, c] of Object.entries<Record<string, unknown>>(KB.CULTIVOS)) {
      const plagas = (c.plagas ?? []) as Array<{ nombre: string; cuarentenaria?: boolean }>;
      for (const p of plagas.filter((x) => x.cuarentenaria)) {
        expect(conMarco.has(p.nombre), `${clave}: "${p.nombre}" sin marco`).toBe(true);
      }
    }
  });
});
