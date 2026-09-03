import { describe, expect, it } from "vitest";
import {
  displayCampoReply,
  runOdkCampoResponder,
} from "@/lib/odk-campo-responder";

function session() {
  let stateJson = "";
  return (
    input: string,
    extra: { inputType?: string; lat?: number; lon?: number } = {}
  ) => {
    const result = runOdkCampoResponder({
      chatId: "campo-test",
      input,
      state_raw: stateJson,
      inputType: extra.inputType || "text",
      lat: extra.lat,
      lon: extra.lon,
    });
    stateJson = result.stateJson;
    return result;
  };
}

describe("ODK campo conversational responder", () => {
  it("harvests an olive find from one human sentence", () => {
    const send = session();
    const first = send(
      "Encontré un olivo abandonado en Rivadavia, al lado de vid"
    );
    expect(first.formId).toBe("demo-olivo");
    expect(first.data.departamento).toBe("Rivadavia");
    expect(first.data.estado).toBe("Abandonado");
    expect(first.data.cultivosVecinos).toMatch(/Vid/i);
    expect(displayCampoReply(first.reply)).toMatch(/confirm|ficha|anot/i);
  });

  it("builds a simulated packet, not a real Central XForm", () => {
    const send = session();
    send("Encontré un olivo abandonado en Rivadavia, al lado de vid");
    send("foto del sitio", { inputType: "image" });
    send("ubicación", { inputType: "location", lat: -33.19, lon: -68.47 });
    const done = send("confirmo");
    expect(done.submission?.formId).toBe("demo-olivo");
    expect(done.submission?.channel).toBe("whatsapp-demo");
    expect(done.submission?.xml).toMatch(/"simulada":\s*true/);
    expect(done.submission?.xml).toMatch(/Rivadavia/);
    expect(done.submission?.xml).not.toMatch(/identif_olivos/);
    expect(done.submission?.hasPhoto).toBe(true);
    expect(done.submission?.geo?.lat).toBeCloseTo(-33.19);
    expect(done.submission?.note).toMatch(/simulada/i);
  });

  it("fills a technical visit from spoken field language", () => {
    const send = session();
    const first = send(
      "Visita de ciruela industria en floración, Tunuyán"
    );
    expect(first.formId).toBe("demo-visita");
    expect(first.data.cultivo).toMatch(/Ciruela/i);
    expect(first.data.departamento).toBe("Tunuyán");
    expect(first.data.estadio).toMatch(/Floraci/i);
  });

  it("does not pretend compass certification can run on WhatsApp", () => {
    const send = session();
    const reply = displayCampoReply(
      send("quiero certificar el equipo y la brújula").reply
    );
    expect(reply).toMatch(/Collect|sensor/i);
    expect(reply).toMatch(/olivo|visita|simulad/i);
  });
});
