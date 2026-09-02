import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type WorkflowNode = {
  name: string;
  parameters: Record<string, unknown>;
};

const workflow = JSON.parse(
  readFileSync(join(process.cwd(), "n8n/openwa-rut-agente.json"), "utf8")
) as {
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
};

const getNode = (name: string) => {
  const found = workflow.nodes.find((node) => node.name === name);
  if (!found) throw new Error(`Missing workflow node ${name}`);
  return found;
};

describe("OpenWA hybrid RUT workflow", () => {
  it("persists state and deduplication in Redis", () => {
    expect(getNode("Redis - Deduplicar webhook")).toBeTruthy();
    expect(getNode("Redis - Recuperar estado RUT")).toBeTruthy();
    expect(getNode("Redis - Guardar estado RUT")).toMatchObject({
      parameters: { operation: "set", expire: true },
    });
    expect(workflow.connections["Redis - Guardar estado RUT"]).toBeTruthy();
  });

  it("normalizes images and documents and blocks outgoing media echoes", () => {
    const source = String(getNode("Normalizar entrada").parameters.jsCode);
    expect(source).toContain("isImage");
    expect(source).toContain("isDocument");
    expect(source).toContain("if (!isText || botPrefix.test(body)) return []");
  });

  it("keeps deterministic text when the conversational layer fails", () => {
    const selector = String(
      getNode("Seleccionar respuesta híbrida").parameters.jsCode
    );
    expect(selector).toContain("safe.deterministicReply");
    expect(workflow.connections["Seleccionar respuesta híbrida"]).toBeTruthy();
    expect(workflow.connections["Agente IA conversacional"]).toBeTruthy();
  });
});
