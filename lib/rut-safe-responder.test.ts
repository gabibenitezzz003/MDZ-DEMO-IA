import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Json = Record<string, unknown>;

function responder() {
  const source = readFileSync(
    join(process.cwd(), "n8n/rut-safe-responder.js"),
    "utf8"
  );
  const execute = new Function("$json", source) as (
    json: Json
  ) => Array<{ json: Json }>;
  const states = new Map<string, string>();
  return (
    input: string,
    chatId = "demo@c.us",
    inputType = "text",
    extra: Json = {}
  ) => {
    const result = execute({
      input,
      chatId,
      inputType,
      state_raw: states.get(chatId) || "",
      ...extra,
    })[0].json;
    states.set(chatId, String(result.stateJson || ""));
    return result;
  };
}

describe("OpenWA RUT safe responder", () => {
  it("collects one registration field at a time without Gemini", () => {
    const send = responder();
    expect(String(send("Quiero registrarme").reply)).toMatch(/CUIT/i);
    expect(String(send("20-12345678-6").reply)).toMatch(/correo|mail/i);
    expect(String(send("productor@mendoza.test").reply)).toMatch(
      /razón social|nombre/i
    );
    expect(String(send("Finca Demo").reply)).toMatch(/teléfono/i);
  });

  it("keeps invalid data on the same step", () => {
    const send = responder();
    send("Quiero registrarme");
    expect(String(send("123").reply)).toMatch(/11 dígitos/i);
    expect(String(send("20-12345678-6").reply)).toMatch(/correo|mail/i);
  });

  it("stores separate progress for each WhatsApp chat", () => {
    const send = responder();
    send("Quiero registrarme", "uno@c.us");
    expect(String(send("20-12345678-6", "uno@c.us").reply)).toMatch(/correo|mail/i);
    expect(String(send("hola", "dos@c.us").reply)).toMatch(/CUIT/i);
  });

  it("validates CUIT check digit and accepts corrections", () => {
    const send = responder();
    send("Quiero registrarme");
    expect(String(send("20-12345678-3").reply)).toMatch(/no es válido/i);
    send("20-12345678-6");
    send("viejo@mendoza.test");
    expect(String(send("corregir correo a nuevo@mendoza.test").reply)).toMatch(
      /corregido/i
    );
  });

  it("tracks documents without claiming official validation", () => {
    const send = responder();
    send("Quiero registrarme");
    const result = send("", "demo@c.us", "image", {
      messageId: "img-1",
      mediaMimeType: "image/jpeg",
      mediaFileName: "constancia.jpg",
      mediaBase64: "ZmFrZS1pbWFnZQ==",
    });
    expect(String(result.reply)).toMatch(/recibí la foto/i);
    expect(String(result.reply)).toMatch(/no implica validación oficial/i);
    expect((result.state as { documents: unknown[] }).documents).toHaveLength(1);
  });

  it("keeps the text flow alive when media download fails", () => {
    const send = responder();
    send("Quiero registrarme");
    const result = send("", "demo@c.us", "document", {
      messageId: "doc-omitted",
      mediaOmitted: true,
    });
    expect(String(result.reply)).toMatch(/no pude descargar/i);
    expect(result.mediaReceived).toBe(false);
  });

  it("asks for the map landing after the last text field", () => {
    const send = responder();
    send("Quiero registrarme");
    send("20-12345678-6");
    send("productor@mendoza.test");
    send("Cooperativa Los Andes");
    send("2615551234");
    send("titular");
    send("Finca Los Andes");
    send("Maipu");
    const last = send("Russell");
    expect(last.needLanding).toBe(true);
    expect(String(last.reply)).toMatch(/enlace|GPS|perímetro/i);
  });

  it("marks the location when the producer confirms the map", () => {
    const send = responder();
    send("Quiero registrarme");
    send("20-12345678-6");
    send("productor@mendoza.test");
    send("Cooperativa Los Andes");
    send("2615551234");
    send("titular");
    send("Finca Los Andes");
    send("Maipu");
    send("Russell");
    const mapped = send("ya cargué el mapa");
    expect((mapped.state as { locationSaved: boolean }).locationSaved).toBe(
      true
    );
    expect(mapped.needLanding).toBeUndefined();
    expect(String(mapped.reply)).toMatch(/confirmo/i);
  });

  it("answers a greeting instead of dumping the confirm script", () => {
    const send = responder();
    send("Quiero registrarme");
    send("20-12345678-6");
    send("productor@mendoza.test");
    send("Cooperativa Los Andes");
    send("2615551234");
    send("titular");
    send("Finca Los Andes");
    send("Maipu");
    send("Russell");
    send("ya cargué el mapa");
    const hi = send("hola como estas");
    expect(String(hi.reply)).toMatch(/bien|hola|andamos/i);
    expect(String(hi.reply)).toMatch(/Finca Los Andes/i);
    expect(String(hi.reply)).not.toMatch(/Tengo los datos principales/i);
    expect(String(hi.reply)).not.toMatch(/indicame “corregir”/i);
  });

  it("sends a new landing link when the producer asks for the map", () => {
    const send = responder();
    send("Quiero registrarme");
    const asked = send("mandame el mapa");
    expect(asked.needLanding).toBe(true);
    expect(String(asked.reply)).toMatch(/enlace seguro/i);
  });

  it("harvests CUIT and email from a single message", () => {
    const send = responder();
    send("Quiero registrarme");
    const bundled = send("CUIT 20-12345678-6 mail productor@mendoza.test");
    expect(String(bundled.reply)).toMatch(/razón social|nombre/i);
    expect((bundled.state as { data: { cuit: string; email: string } }).data.cuit).toBe(
      "20123456786"
    );
    expect((bundled.state as { data: { email: string } }).data.email).toBe(
      "productor@mendoza.test"
    );
  });

  it("asks official files after confirm and stores demo validations", () => {
    const send = responder();
    send("Quiero registrarme");
    send("20-12345678-6");
    send("productor@mendoza.test");
    send("Cooperativa Los Andes");
    send("2615551234");
    send("titular");
    send("Finca Los Andes");
    send("Maipu");
    send("Russell");
    send("ya cargué el mapa");
    const confirmed = send("confirmo");
    expect(String(confirmed.reply)).toMatch(/archivos|vid|RENSPA/i);
    expect((confirmed.state as { siaStep: string }).siaStep).toBe("ARCHIVOS");

    const none = send("ninguno");
    expect(String(none.reply)).toMatch(/constancia de CUIT/i);

    const requisitos = send("qué documentos faltan");
    expect(String(requisitos.reply)).toMatch(/constancia de CUIT/i);
    expect(String(requisitos.reply)).toMatch(/escritura|boleto/i);
    expect(String(requisitos.reply)).toMatch(/Inmobiliario/i);
    expect(String(requisitos.reply)).toMatch(/riego/i);

    const photo = send("", "demo@c.us", "image", {
      messageId: "cuit-constancia",
      mediaMimeType: "image/jpeg",
      mediaFileName: "constancia-cuit.jpg",
      mediaBase64: "ZmFrZS1pbWFnZQ==",
    });
    const state = photo.state as {
      documents: Array<{ officialType?: string }>;
      validations: Array<{ provider: string; check: string; status: string }>;
    };
    expect(String(photo.reply)).toMatch(/no implica validación oficial/i);
    expect(state.documents.some((doc) => doc.officialType === "constancia_cuit")).toBe(
      true
    );
    expect(
      state.validations.some(
        (item) => item.provider === "ARCA" && item.check === "cuit_dv"
      )
    ).toBe(true);
    expect(
      state.validations.some(
        (item) => item.provider === "ARCA" && item.status === "RECIBIDO_DEMO"
      )
    ).toBe(true);
    expect(
      state.validations.some(
        (item) => item.provider === "ANSES" && item.status === "NO_CONECTADO"
      )
    ).toBe(true);
    expect(String(photo.reply)).toMatch(/escritura|boleto|legal/i);
  });

  it("accepts ambos and los dos instead of looping on vineyard flags", () => {
    const reachFlags = () => {
      const send = responder();
      send("Quiero registrarme");
      send("20-12345678-6");
      send("productor@mendoza.test");
      send("Cooperativa Los Andes");
      send("2615551234");
      send("titular");
      send("Finca Los Andes");
      send("Maipu");
      send("Russell");
      send("ya cargué el mapa");
      return send;
    };

    const ambosSend = reachFlags();
    const asked = ambosSend("confirmo");
    expect(String(asked.reply)).not.toMatch(/Para registrarte \(demo RUT\)/i);
    expect(String(asked.reply)).toMatch(/ambos|ninguno|viñedo|RENSPA/i);

    const ambos = ambosSend("ambos");
    expect(String(ambos.reply)).not.toMatch(/Decime una de estas|Necesito definirlo/i);
    expect(String(ambos.reply)).toMatch(/constancia de CUIT/i);
    expect(
      (ambos.state as { data: { hasVid?: boolean; hasRenspa?: boolean } }).data
        .hasVid
    ).toBe(true);
    expect(
      (ambos.state as { data: { hasVid?: boolean; hasRenspa?: boolean } }).data
        .hasRenspa
    ).toBe(true);

    const dosSend = reachFlags();
    dosSend("confirmo");
    const losDos = dosSend("los dos");
    expect(String(losDos.reply)).toMatch(/constancia de CUIT/i);
    expect(
      (losDos.state as { data: { hasVid?: boolean; hasRenspa?: boolean } }).data
        .hasRenspa
    ).toBe(true);
  });

  it("lets the producer skip a missing file instead of looping", () => {
    const send = responder();
    send("Quiero registrarme");
    send("20-12345678-6");
    send("productor@mendoza.test");
    send("Cooperativa Los Andes");
    send("2615551234");
    send("titular");
    send("Finca Los Andes");
    send("Maipu");
    send("Russell");
    send("ya cargué el mapa");
    send("confirmo");
    send("ambos");
    const skip = send("no la tengo actualmente, podemos seguir con otra cosa?");
    expect(String(skip.reply)).not.toMatch(/Mandame la constancia de CUIT/i);
    expect(String(skip.reply)).toMatch(/después|pendiente|otro|legal|escritura/i);
    const hi = send("hola");
    expect(String(hi.reply)).not.toMatch(/^[\u200B]*Mandame la constancia/i);
    expect(String(hi.reply)).toMatch(/expediente|después|papel|hola|bien/i);
  });
});
