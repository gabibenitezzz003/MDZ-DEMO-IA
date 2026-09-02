import { withTimeout } from "@/lib/async-timeout";
import { buildAgentSystemPrompt } from "@/lib/agent-prompt";
import type { AssistantIntent } from "@/lib/demo-assistant";
import {
  formatPageContext,
  type ClientPageContext,
} from "@/lib/page-context";
import type { AgentAction } from "@/lib/types";

export type ChatTurn = { role: "user" | "assistant"; text: string };

const ACTIONS: AgentAction[] = [
  "navigate",
  "highlight",
  "open_external",
  "open_whatsapp",
  "open_rut",
  "rut_set_step",
  "rut_focus_field",
  "show_checklist",
  "fill_form",
  "ask_confirm",
  "scroll",
  "go_home",
  "go_back",
  "go_forward",
  "describe",
];

const MODELS = [
  ...new Set(
    [
      process.env.GEMINI_MODEL?.trim(),
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ].filter((m): m is string => Boolean(m))
  ),
].slice(0, 2);

function isGemini3Family(model: string) {
  return /^gemini-3(\.|-)/.test(model);
}

const STRING_FIELD = { type: "string" };

// Gemini responseSchema NO acepta additionalProperties (falla con 400).
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string" },
    target: { type: "string" },
    openLink: { type: "boolean" },
    openExternal: { type: "boolean" },
    url: { type: "string" },
    reply: { type: "string" },
    extractedFields: {
      type: "object",
      properties: {
        cuit: STRING_FIELD,
        email: STRING_FIELD,
        telefono: STRING_FIELD,
        razonSocial: STRING_FIELD,
        tipoPersona: STRING_FIELD,
        condicionTierra: STRING_FIELD,
        renspa: STRING_FIELD,
        nombreEstablecimiento: STRING_FIELD,
        catastro: STRING_FIELD,
        irrigacion: STRING_FIELD,
        departamento: STRING_FIELD,
        localidad: STRING_FIELD,
        superficie: STRING_FIELD,
        especie: STRING_FIELD,
        variedad: STRING_FIELD,
        superficieLote: STRING_FIELD,
        sistemaRiego: STRING_FIELD,
        anioImplantacion: STRING_FIELD,
      },
    },
    fillMode: {
      type: "string",
      nullable: true,
      enum: ["auto", "manual", "ask", null],
    },
    endSession: { type: "boolean" },
    heardAs: { type: "string" },
    remember: {
      type: "object",
      properties: {
        name: STRING_FIELD,
        crop: STRING_FIELD,
        note: STRING_FIELD,
      },
    },
  },
  required: ["action", "reply"],
};

export function parseGeminiIntent(raw: string): AssistantIntent | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }

  const action = ACTIONS.includes(data.action as AgentAction)
    ? (data.action as AgentAction)
    : "describe";
  const reply = String(data.reply ?? "").trim();
  if (!reply) return null;

  const target = data.target ? String(data.target) : undefined;
  const url = data.url ? String(data.url) : undefined;
  const openLink = data.openLink === true;
  const openExternal = data.openExternal === true;
  const extracted =
    data.extractedFields && typeof data.extractedFields === "object"
      ? (data.extractedFields as Record<string, string>)
      : undefined;
  const fillMode =
    data.fillMode === "auto" ||
    data.fillMode === "manual" ||
    data.fillMode === "ask"
      ? data.fillMode
      : undefined;

  const payload: Record<string, unknown> = {
    openLink,
    click: true,
    heardAs: data.heardAs ? String(data.heardAs) : undefined,
  };
  if (url) payload.url = url;
  if (openExternal) payload.openExternal = true;
  if (extracted && Object.keys(extracted).length) {
    payload.fields = extracted;
  }
  if (data.remember && typeof data.remember === "object") {
    payload.remember = data.remember;
  }

  return {
    action: action === "open_external" && url ? "open_external" : action,
    target: action === "open_external" ? url || target : target,
    payload,
    reply,
    extractedFields: extracted,
    fillMode,
    endSession: data.endSession === true,
    understood: true,
    useGuide: false,
  };
}

async function callGemini(
  apiKey: string,
  model: string,
  userPrompt: string,
  history: ChatTurn[],
  repair = false
): Promise<string | null> {
  const contents = [
    ...history.slice(-8).map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.text }],
    })),
    {
      role: "user",
      parts: [
        {
          text: repair
            ? `${userPrompt}\n\nTu respuesta anterior no era JSON válido. Devolvé SOLO el JSON del contrato, sin markdown.`
            : userPrompt,
        },
      ],
    },
  ];

  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 6_000);
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildAgentSystemPrompt() }] },
          contents,
          generationConfig: isGemini3Family(model)
            ? {
                maxOutputTokens: repair ? 512 : 420,
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
              }
            : {
                temperature: repair ? 0.2 : 0.55,
                topP: 0.9,
                maxOutputTokens: 360,
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
              },
        }),
      }
    );
  } catch (err) {
    console.error("Gemini fetch failed", model, err);
    return null;
  } finally {
    clearTimeout(kill);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("Gemini error", model, res.status, err.slice(0, 400));
    return null;
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

export async function interpretWithGemini(input: {
  text: string;
  originalText: string;
  history: ChatTurn[];
  lastSectionId?: string;
  pageContext?: ClientPageContext | null;
  pendingFields?: Record<string, string>;
  rutMode?: string;
  facts?: Record<string, string>;
}): Promise<AssistantIntent | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const pending = Object.keys(input.pendingFields || {}).length
    ? JSON.stringify(input.pendingFields)
    : "{}";
  const facts = Object.keys(input.facts || {}).length
    ? JSON.stringify(input.facts)
    : "{}";

  const userPrompt = [
    `Última sección visitada: ${input.lastSectionId || "ninguna"}.`,
    `CONTEXTO DE PÁGINA: ${formatPageContext(input.pageContext)}.`,
    `RUT mode=${input.rutMode || "idle"} | campos pendientes=${pending}.`,
    `MEMORIA DE SESIÓN (hechos): ${facts}.`,
    `Texto original del dictado: "${input.originalText}".`,
    `Texto corregido (si cambió, priorizalo): "${input.text}".`,
    "PRIORIDAD: respondé exactamente a lo que preguntó. Saludo suelto (hola/hola cómo estás/buenas) → describe, sin target, sin navegar, sin RUT. Mic check → describe, sin navegar.",
    "Si pide cultivo/herramienta/recurso: navigate + openLink=true + URL oficial, y explicá qué hay en esa página. Tono cercano argentino. No repitas la misma coletilla.",
    "STT: root/ruth/rod = RUT solo si piden el registro, nunca si saludan. abajo = ajo. No respondas solo saludo si el mensaje incluye un pedido concreto.",
    "No seas seco ni rígido. Una respuesta útil y humana.",
  ].join("\n");

  for (const model of MODELS) {
    try {
      let raw = await withTimeout(
        callGemini(apiKey, model, userPrompt, input.history),
        4_000,
        null
      );
      if (!raw) continue;
      let intent = parseGeminiIntent(raw);
      if (!intent) {
        raw = await withTimeout(
          callGemini(apiKey, model, userPrompt, input.history, true),
          5_000,
          null
        );
        if (!raw) continue;
        intent = parseGeminiIntent(raw);
      }
      if (intent) return intent;
    } catch (err) {
      console.error("Gemini call failed", model, err);
    }
  }
  return null;
}
