import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Estas pruebas leen el workflow YA GENERADO, no el generador: es el archivo
 * que se importa a n8n, así que es el que tiene que estar bien.
 *
 * Nacieron de la ejecución 592, donde el workflow quedó "success" en verde
 * mientras el técnico no recibía nada. Dos fallas mudas, las dos acá cubiertas.
 */
const wf = JSON.parse(
  readFileSync(join(process.cwd(), "n8n/agente-campo-v4.json"), "utf8")
) as {
  nodes: Array<{
    name: string;
    parameters: Record<string, unknown>;
    credentials?: unknown;
    retryOnFail?: boolean;
    disabled?: boolean;
  }>;
  connections: Record<string, Record<string, unknown>>;
};

const porNombre = (n: string) => {
  const nodo = wf.nodes.find((x) => x.name === n);
  if (!nodo) throw new Error(`falta el nodo ${n}`);
  return nodo;
};

describe("envío por OpenWA", () => {
  it("no usa $env en ninguna expresión", () => {
    // n8n corre con N8N_BLOCK_ENV_ACCESS_IN_NODE: un $env devuelve
    // "access to env vars denied" y, con onError: continueRegularOutput,
    // el nodo lo traga y la ejecución igual queda en verde.
    for (const nodo of wf.nodes) {
      const texto = JSON.stringify(nodo.parameters);
      expect(texto, `${nodo.name} usa $env`).not.toMatch(/\$env\./);
    }
  });

  it("saca la sesión del webhook y no la escribe a mano", () => {
    // OpenWA recrea las sesiones y el id cambia: `n8n-ingenieria` ya pasó de
    // 34f9e186… a 223ae269…. Contestar por body.sessionId es inmune a eso.
    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    for (const n of ["enviarTexto", "enviarVoz", "convertirAVoz"]) {
      const url = String(porNombre(n).parameters.url);
      expect(url, n).toContain("body.sessionId");
      expect(UUID.test(url), `${n} tiene un id de sesión literal`).toBe(false);
    }
  });

  it("usa las rutas que la API de OpenWA realmente expone", () => {
    // /messages/send-voice no existe en OpenWA 0.23.3: daba 404.
    const url = (n: string) => String(porNombre(n).parameters.url);
    expect(url("enviarTexto")).toContain("/messages/send-text");
    expect(url("enviarVoz")).toContain("/messages/send-audio");
    expect(url("enviarVoz")).not.toContain("send-voice");
    expect(url("convertirAVoz")).toContain("/media/convert/voice");
  });

  it("manda la voz como nota de voz, en JSON y convertida", () => {
    const voz = porNombre("enviarVoz").parameters;
    // multipart era lo que usaba antes; send-audio espera JSON con base64.
    expect(String(voz.contentType)).toBe("raw");
    const body = String(voz.body);
    expect(body).toContain("ptt: true");
    expect(body).toContain("base64");
    expect(body).toContain("mimetype");
  });

  it("la bandeja viene desactivada y con el sobre correcto", () => {
    const nodo = porNombre("publicarEnBandeja");
    // El n8n de producción no alcanza al demo: activo sólo sumaría un nodo que
    // falla mudo. Cuando se active, el endpoint lee body.submission — mandar la
    // ficha pelada devuelve 400.
    expect(nodo.disabled, "debe venir desactivada").toBe(true);
    expect(String(nodo.parameters.body)).toContain("submission:");
  });
});

describe("salida del agente", () => {
  it("no lleva output parser", () => {
    // Con parser, Gemini contesta con un function call y el texto queda vacío.
    expect(porNombre("agenteCampo").parameters.hasOutputParser).toBe(false);
    expect(wf.nodes.some((n) => n.name === "salidaEstructurada")).toBe(false);
    expect(JSON.stringify(wf.connections)).not.toContain("ai_outputParser");
  });

  it("el contrato JSON viaja en el systemMessage", () => {
    const sm = String(
      (porNombre("agenteCampo").parameters.options as { systemMessage: string }).systemMessage
    );
    expect(sm).toContain("FORMATO DE RESPUESTA");
    expect(sm).toContain('"reply"');
    expect(sm).toContain('"actions"');
  });

  it("reintenta el modelo: la API de Gemini devuelve 503 seguido", () => {
    expect(porNombre("modeloGemini").retryOnFail).toBe(true);
  });
});

describe("extraerJson del guardrail", () => {
  // Se saca la función del jsCode real que va a correr en n8n.
  const js = String(porNombre("guardrailYEjecutor").parameters.jsCode);
  const desde = js.indexOf("function extraerJson");
  const hasta = js.indexOf("const salida = extraerJson");
  const extraerJson = new Function(
    `${js.slice(desde, hasta)}; return extraerJson;`
  )() as (v: unknown) => unknown;

  it("se lleva bien con lo que suele devolver un modelo", () => {
    const esperado = { reply: "hola", actions: [] };
    const casos: Array<[string, unknown, unknown]> = [
      ["objeto ya parseado", { reply: "hola", actions: [] }, esperado],
      ["json pelado", '{"reply":"hola","actions":[]}', esperado],
      ["envuelto en fence", '```json\n{"reply":"hola","actions":[]}\n```', esperado],
      ["con prosa antes", 'Acá va:\n{"reply":"hola","actions":[]}', esperado],
      ["con prosa después", '{"reply":"hola","actions":[]}\nEspero que sirva.', esperado],
      [
        "llaves dentro de un string",
        '{"reply":"usá { y } así","actions":[]}',
        { reply: "usá { y } así", actions: [] },
      ],
      [
        "comillas escapadas",
        '{"reply":"dijo \\"dale\\"","actions":[]}',
        { reply: 'dijo "dale"', actions: [] },
      ],
      [
        "acciones anidadas",
        '{"reply":"ok","actions":[{"type":"save_note","data":{"a":"b"}}]}',
        { reply: "ok", actions: [{ type: "save_note", data: { a: "b" } }] },
      ],
    ];
    for (const [nombre, entrada, salida] of casos) {
      expect(extraerJson(entrada), nombre).toEqual(salida);
    }
  });

  it("devuelve null en vez de romperse cuando no hay JSON", () => {
    for (const basura of ["", null, undefined, "no tengo idea", '{"reply":"hola",']) {
      expect(extraerJson(basura), String(basura)).toBeNull();
    }
  });
});
