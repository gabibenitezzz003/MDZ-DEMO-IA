import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type AgentBundle = {
  contextEngine: (input: Record<string, unknown>) => Record<string, unknown>;
  guardrail: (raw: string, ctx: Record<string, unknown>) => Record<string, unknown>;
  execActions: (
    actions: unknown[],
    ctx: Record<string, unknown>
  ) => Record<string, unknown>;
};

function loadModule(path: string) {
  return require(path);
}

export function loadCampoAgentRuntime(): AgentBundle {
  const base = join(process.cwd(), "n8n/agent");
  const { buildContextPayload } = loadModule(join(base, "context-engine.js"));
  const { guardrailPipeline } = loadModule(join(base, "guardrail.js"));
  const { execActions } = loadModule(join(base, "action-executor.js"));
  return {
    contextEngine: buildContextPayload,
    guardrail: guardrailPipeline,
    execActions,
  };
}

export function loadCampoAgentSystemPrompt() {
  return readFileSync(
    join(process.cwd(), "n8n/prompts/campo-agent-system.txt"),
    "utf8"
  );
}
