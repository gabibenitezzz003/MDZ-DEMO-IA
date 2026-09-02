import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type WorkflowNode = {
  name: string;
  webhookId?: string;
  parameters: Record<string, unknown>;
};

const workflow = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "../RUT-Premium-Bundle/n8n/OpenWA-RUT-Premium-Integrado.json"
    ),
    "utf8"
  )
) as {
  nodes: WorkflowNode[];
  connections: Record<string, { main?: Array<Array<{ node: string }>> }>;
};

const getNode = (name: string) => {
  const found = workflow.nodes.find((node) => node.name === name);
  if (!found) throw new Error(`Missing workflow node ${name}`);
  return found;
};

describe("OpenWA premium RUT workflow", () => {
  it("keeps the live OpenWA webhook and reconnects it", () => {
    const webhook = getNode("Webhook OpenWA");
    expect(webhook.parameters.path).toBe("pruebas");
    expect(webhook.webhookId).toBe("dd482bf0-4892-4b0d-a161-e8b1dbcef50c");
    expect(
      webhook.parameters.responseMode ||
        (webhook.parameters.options as { responseMode?: string } | undefined)
          ?.responseMode
    ).toBe("onReceived");
    expect(
      workflow.connections["Webhook OpenWA"].main?.[0].map((item) => item.node)
    ).toContain("Normalizar entrada");
  });

  it("replies with text or voice, never both, and can attach a landing URL", () => {
    const normalizer = String(getNode("Normalizar entrada").parameters.jsCode);
    expect(normalizer).toContain("isImage");
    expect(normalizer).toContain("isDocument");
    expect(String(getNode("RUT Web · Persistir ubicación + foto").parameters.query)).toContain(
      "ESTABLECIMIENTO"
    );
    expect(workflow.connections["Seleccionar respuesta híbrida"]).toBeTruthy();
    expect(workflow.connections["¿Pide landing?"].main?.[0][0].node).toBe(
      "Preparar sesión landing"
    );
    expect(workflow.connections["Conservar respuesta"].main?.[0][0].node).toBe(
      "¿Audio o texto?"
    );
    expect(workflow.connections["¿Audio o texto?"].main?.[0][0].node).toBe(
      "ElevenLabs - Generar respuesta de voz"
    );
    expect(workflow.connections["¿Audio o texto?"].main?.[1][0].node).toBe(
      "OpenWA - Enviar texto"
    );
    expect(
      (workflow.connections["OpenWA - Enviar texto"].main?.[0] || []).map(
        (item) => item.node
      )
    ).not.toContain("ElevenLabs - Generar respuesta de voz");
    expect(
      String(getNode("RUT Web · URL").parameters.responseBody)
    ).toContain("n8n.followfreight.online");
  });

  it("accepts vineyard flags like ambos without a robotic prefix", () => {
    const responder = String(getNode("Respuesta RUT segura").parameters.jsCode);
    expect(responder).toContain("parseVidRenspaFlags");
    expect(responder).toContain("ambos");
    expect(responder).not.toContain("Para registrarte (demo RUT): ");
    const agent = getNode("Agente IA conversacional").parameters as {
      options?: { systemMessage?: string };
    };
    expect(agent.options?.systemMessage).not.toMatch(
      /Empezá exactamente con: Para registrarte/
    );
  });
});
