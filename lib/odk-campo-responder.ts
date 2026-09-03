import { readFileSync } from "node:fs";
import { join } from "node:path";

export type OdkCampoGeo = { lat: number; lon: number; source?: string };

export type OdkCampoSubmission = {
  id: string;
  formId: string;
  formName: string;
  version: string;
  channel: string;
  data: Record<string, string>;
  xml: string;
  hasPhoto: boolean;
  geo: OdkCampoGeo | null;
  createdAt: number;
  note: string;
};

export type OdkCampoResult = {
  ok: boolean;
  reply: string;
  deterministicReply?: string;
  stateJson: string;
  formKey: string;
  formId: string;
  status: string;
  data: Record<string, string>;
  hasPhoto: boolean;
  geo: OdkCampoGeo | null;
  submission: OdkCampoSubmission | null;
  needInbox?: boolean;
};

export type OdkCampoInput = {
  chatId?: string;
  input?: string;
  messageText?: string;
  inputType?: string;
  state_raw?: string;
  stateJson?: string;
  lat?: number;
  lon?: number;
};

type Execute = (json: OdkCampoInput) => Array<{ json: OdkCampoResult }>;

let execute: Execute | null = null;

function loadResponder(): Execute {
  if (!execute) {
    const source = readFileSync(
      join(process.cwd(), "n8n/odk-safe-responder.js"),
      "utf8"
    );
    execute = new Function("$json", source) as Execute;
  }
  return execute;
}

export function runOdkCampoResponder(input: OdkCampoInput): OdkCampoResult {
  const out = loadResponder()(input)[0]?.json;
  if (!out) {
    return {
      ok: false,
      reply: "No pude armar la ficha.",
      stateJson: input.state_raw || input.stateJson || "",
      formKey: "",
      formId: "",
      status: "idle",
      data: {},
      hasPhoto: false,
      geo: null,
      submission: null,
    };
  }
  return out;
}

export function displayCampoReply(reply: string) {
  return String(reply || "").replace(/^\u200B/, "").trim();
}
