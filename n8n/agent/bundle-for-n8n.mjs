#!/usr/bin/env node
/** Empaqueta módulos agent/*.js para nodos Code de n8n (sin require). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const agentDir = path.join(path.dirname(fileURLToPath(import.meta.url)));

function read(name) {
  return fs.readFileSync(path.join(agentDir, name), "utf8");
}

function stripN8nTail(source) {
  return source
    .replace(/if \(typeof \$json !== 'undefined'\)[\s\S]*$/m, "")
    .replace(/module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/m, "");
}

function schemasIife() {
  let body = read("schemas.js").replace(/if \(typeof \$json !== 'undefined'\)[\s\S]*$/m, "");
  body = body.replace(/module\.exports\s*=\s*\{/, "return {");
  return `(function(){ ${body} })()`;
}

function wrapWithSchemas(file, invokeLines) {
  const body = stripN8nTail(read(file)).replace(
    /const \{[^}]+\} = require\('\.\/schemas'\);\s*/g,
    ""
  );
  return `
const __schemas = ${schemasIife()};
const { BOT_MARK, REDIS, FORMS, ALLOWED_ACTIONS, EMPTY_SESSION, EMPTY_MEMORY, EMPTY_PROFILE, EMPTY_NOTES, EMPTY_RELEVAMIENTO, defaultJson, buildPacket, submissionFromRelevamiento } = __schemas;
${body}
${invokeLines}
`.trim();
}

export function bundleAgentRuntime() {
  return {
    contextEngine: wrapWithSchemas(
      "context-engine.js",
      "return buildContextPayload($json);"
    ),
    guardrail: wrapWithSchemas(
      "guardrail.js",
      `
const ctx = { input: $json.input, relevamiento: $json.relevamiento || JSON.parse($json.stateJson || '{}') };
return guardrailPipeline($json.agentRaw || $json.output || '', ctx);
`.trim()
    ),
    actionExecutor: wrapWithSchemas(
      "action-executor.js",
      `
const g = $json.guardrail || {};
if (!g.ok) {
  return { ...$json, reply: BOT_MARK + g.safeReply, needInbox: false, needHandoff: false };
}
const result = execActions(g.actions, {
  chatId: $json.chatId,
  sessionJson: $json.sessionJson,
  memoryJson: $json.memoryJson,
  profileJson: $json.profileJson,
  notesJson: $json.notesJson,
  stateJson: $json.stateJson,
  reply: g.reply,
  memoryPatch: g.agent?.memory_patch,
});
return {
  ...$json,
  ...result,
  reply: BOT_MARK + g.reply,
  responseMode: g.responseMode,
  typingMs: g.typingMs,
  voiceReply: g.reply,
  needHandoff: Boolean(result.handoff),
};
`.trim()
    ),
    responseEngine: wrapWithSchemas(
      "response-engine.js",
      `
const profile = JSON.parse($json.profileJson || '{}');
return {
  ...$json,
  ...composeResponse({
    chatId: $json.chatId,
    reply: $json.reply,
    input: $json.input,
    profile,
    responseMode: $json.responseMode,
    typingMs: $json.typingMs,
  }),
};
`.trim()
    ),
  };
}
