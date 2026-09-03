import { NextRequest, NextResponse } from "next/server";
import { publish } from "@/lib/agent-bus";
import {
  appendTurn,
  bumpAckSalt,
  clearPendingFill,
  clearSession,
  getMemory,
  mergePendingFields,
  mergePendingFieldsDetailed,
  mergeSessionFacts,
  popPreviousSection,
  setAwaitingFill,
  setLastSection,
  setRutProgress,
} from "@/lib/chat-memory";
import { interpretUtterance } from "@/lib/demo-assistant";
import { wantsGuidedTour } from "@/lib/demo-tour";
import {
  isEngineeringPath,
  resolveEngineeringQuestion,
  wantsEngineeringTour,
} from "@/lib/engineering-qa";
import { synthesizeSpeech } from "@/lib/elevenlabs";
import {
  detectFillPreference,
  extractFormFields,
} from "@/lib/form-extract";
import { interpretWithGemini } from "@/lib/gemini-brain";
import { interpretFast } from "@/lib/n8n-brain";
import { catalog, findBestSections, officialUrlFor } from "@/lib/page-knowledge";
import type { ClientPageContext } from "@/lib/page-context";
import {
  ackAndAskNext,
  askConfirmReady,
  askFirstField,
  completeRutSpoken,
  extractMentionedDocs,
  isAffirmativeRut,
  normalizeRutFields,
  recallConflictSpoken,
  wantsRecallPriorFields,
  wantsRutChecklist,
  wantsToPassRutData,
} from "@/lib/rut-conversation";
import { buildSectionGuide } from "@/lib/section-guide";
import { ApiSecurityError, secureApiRequest } from "@/lib/api-security";
import {
  classifyConversationMode,
  resolveLocalIntent,
  shouldPreferLocalRules,
} from "@/lib/local-intent-first";
import { wantsListeningCheck, wantsSimpleGreeting } from "@/lib/intent-guards";
import { wantsOdkHelp } from "@/lib/spoken-fields";
import { greetingReply } from "@/lib/greeting-reply";
import { displaySpoken, humanizeSpoken, prepareTourNarration } from "@/lib/spoken-style";
import { conflictSpoken } from "@/lib/field-merge";
import { wantsOpenResource } from "@/lib/open-resource";
import {
  wantsExplainCurrentPage,
  wantsPageLocation,
} from "@/lib/page-question";
import { correctSpeechTranscript } from "@/lib/stt-correct";
import type { AgentEvent } from "@/lib/types";
import {
  campoSpoken,
  wantsCampoCollector,
  wantsOdkWhatsApp,
} from "@/lib/whatsapp-odk";
import {
  buildWhatsAppRutUrl,
  wantsRutDemoWizard,
  wantsRutExplainOnly,
  wantsRutWhatsAppHandoff,
  whatsAppRutSpoken,
} from "@/lib/whatsapp-rut";

const RUT_ASK_ORDER = [
  "cuit",
  "email",
  "razonSocial",
  "telefono",
  "condicionTierra",
  "nombreEstablecimiento",
  "departamento",
  "localidad",
] as const;
const RUT_ASK_HINT: Record<(typeof RUT_ASK_ORDER)[number], string> = {
  cuit: "el CUIT",
  email: "el mail (correo electrónico)",
  razonSocial: "la razón social o tu nombre",
  telefono: "un teléfono de contacto",
  condicionTierra: "si sos titular, locatario u otra condición frente a la tierra",
  nombreEstablecimiento: "el nombre de la finca o establecimiento",
  departamento: "el departamento",
  localidad: "la localidad",
};

const RUT_STEP_FOR_FIELD: Record<string, number> = {
  cuit: 1,
  email: 1,
  razonSocial: 1,
  telefono: 1,
  condicionTierra: 1,
  nombreEstablecimiento: 2,
  departamento: 2,
  localidad: 2,
  catastro: 2,
  superficie: 2,
  especie: 3,
  variedad: 3,
};

function nextRutField(pending: Record<string, string>) {
  return RUT_ASK_ORDER.find((key) => !pending[key]);
}

function wantsChecklist(raw: string) {
  return wantsRutChecklist(raw);
}

const RELATED_NEXT: Record<string, string> = {
  ciruela: "durazno",
  ajo: "tomate",
  "mapas-agricolas": "visor-agricola",
  agrometeorologia: "estaciones",
  tramites: "rut",
  rut: "odk-collect",
  "odk-collect": "rut",
  precios: "horticultura",
  herramientas: "agrometeorologia",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildEvent(
  sessionId: string,
  action: AgentEvent["action"],
  target?: string,
  payload?: Record<string, unknown>
): AgentEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    action,
    target,
    payload,
    createdAt: Date.now(),
  };
}

async function withVoice(spoken: string, extra: Record<string, unknown>) {
  const isTour = extra.via === "tour-tts";
  const isLocal = extra.via === "local" || extra.via === "local-context";
  const display = displaySpoken(spoken);
  const ttsText = isTour ? prepareTourNarration(spoken) : humanizeSpoken(spoken);
  let audioBase64: string | undefined;
  let audioMime: string | undefined;
  // Saludo y tour: el audio va en la misma respuesta. Si no, el cliente
  // pide /api/agent/tts y el navegador suele bloquear el playback.
  if (isTour || isLocal) {
    try {
      const audio = await synthesizeSpeech(ttsText, {
        quality: isTour ? "narration" : "chat",
      });
      if (audio) {
        audioBase64 = audio.toString("base64");
        audioMime = "audio/mpeg";
      }
    } catch (err) {
      console.error("TTS error", err);
    }
  }
  return NextResponse.json({
    ok: true,
    spoken: display,
    reply: display,
    audioBase64,
    audioMime,
    needsTts: !audioBase64,
    voice: process.env.ELEVENLABS_VOICE_ID || "h60rOzgfLmYsntfqgGu2",
    ...extra,
  });
}

function withNavigationDefaults(
  intent: ReturnType<typeof interpretUtterance>
): ReturnType<typeof interpretUtterance> {
  const payload = { ...(intent.payload ?? {}) };
  const isMove =
    intent.action === "navigate" || intent.action === "highlight";

  if ((isMove || intent.action === "describe") && intent.target) {
    if (payload.click === undefined) payload.click = true;
    payload.url = officialUrlFor(intent.target);
  }
  if (intent.action === "open_external") {
    const sectionGuess =
      (typeof payload.sectionId === "string" && payload.sectionId) ||
      (intent.target && catalog.sections.some((s) => s.id === intent.target)
        ? intent.target
        : undefined);
    const catalogUrl = officialUrlFor(sectionGuess);
    const current = String(intent.target || payload.url || "");
    const home = catalog.sourceUrl.replace(/\/$/, "");
    if (
      !current ||
      current.replace(/\/$/, "") === home ||
      current.includes("direccion-de-agricultura")
    ) {
      intent = { ...intent, target: catalogUrl };
      payload.url = catalogUrl;
    } else if (!payload.url) {
      payload.url = current;
    }
  }
  const section = catalog.sections.find((s) => s.id === intent.target);
  const isCard =
    Boolean(section && ("summary" in section || "externalUrl" in section)) &&
    !["autoridades", "mision", "vision", "funcion", "normativa"].includes(
      String(intent.target)
    );
  if (isMove && isCard && payload.openLink !== false) {
    // Mark on the demo AND leave to the official resource (popup is often blocked).
    payload.openLink = true;
    payload.redirect = true;
  }
  if (intent.action === "describe" && payload.openLink === undefined) {
    payload.openLink = false;
  }
  if (intent.action === "open_external") {
    try {
      const url = new URL(String(intent.target || payload.url || ""));
      const allowed =
        url.protocol === "https:" &&
        (url.hostname === "mendoza.gov.ar" ||
          url.hostname.endsWith(".mendoza.gov.ar") ||
          url.hostname === "wa.me" ||
          url.hostname === "whatsapp.com" ||
          url.hostname.endsWith(".whatsapp.com"));
      if (!allowed) {
        return {
          action: "describe",
          target: "tramites",
          reply:
            "Ese enlace no está dentro de los sitios oficiales permitidos. Puedo ayudarte desde la demo o abrir un portal oficial de Mendoza.",
          payload: { openLink: false },
          understood: true,
          useGuide: false,
        };
      }
    } catch {
      return {
        action: "describe",
        target: "tramites",
        reply:
          "No pude validar ese enlace. Puedo ayudarte desde la demo o abrir un portal oficial de Mendoza.",
        payload: { openLink: false },
        understood: true,
        useGuide: false,
      };
    }
    payload.redirect = true;
  }

  if (intent.action === "open_rut" && payload.openExternal === undefined) {
    payload.openExternal = false;
  }

  if (intent.action === "open_whatsapp") {
    const whatsappUrl = buildWhatsAppRutUrl();
    if (!whatsappUrl) {
      return {
        action: "describe",
        target: "rut",
        reply:
          "WhatsApp todavía no está configurado en el servidor. Puedo explicarte el trámite o abrir el SIA oficial.",
        payload: { openLink: false },
        understood: true,
        useGuide: false,
      };
    }
    return {
      ...intent,
      target: whatsappUrl,
      payload: { ...payload, whatsappUrl, alsoNavigate: true },
    };
  }

  return { ...intent, payload };
}

function extractPassiveContext(raw: string) {
  const facts: Record<string, string> = {};
  const name = raw.match(
    /\b(?:me llamo|soy)\s+([\p{L}][\p{L}\s'-]{1,50}?)(?=\s+(?:y|tengo|cultivo|trabajo)\b|[,.]|$)/iu
  )?.[1];
  const farm = raw.match(
    /\b(?:finca|establecimiento)\s+(?:se llama\s+)?([\p{L}\d][\p{L}\d\s'-]{1,60}?)(?=\s+en\b|[,.]|$)/iu
  )?.[1];
  const crop = raw.match(
    /\b(ciruela|ciruelo|durazno|duraznero|vid|uva|ajo|tomate|olivo|cereza)\b/iu
  )?.[1];
  const department = raw.match(
    /\b(Tunuy[aá]n|San Rafael|General Alvear|Lavalle|Maip[uú]|Luj[aá]n(?: de Cuyo)?|San Mart[ií]n|Rivadavia|Jun[ií]n|San Carlos|Tupungato|Malarg[uü]e|Santa Rosa|La Paz|Las Heras|Guaymall[eé]n|Godoy Cruz)\b/iu
  )?.[1];
  if (name) facts.name = name.trim();
  if (farm) facts.farm = farm.trim();
  if (crop) facts.crop = crop.trim();
  if (department) facts.department = department.trim();
  return facts;
}

/** Respuesta hablada: guía cálida + aviso de sitio oficial cuando corresponde. */
function resolveSpokenReply(
  intent: ReturnType<typeof interpretUtterance>
): string {
  let spoken = intent.reply;
  if (intent.useGuide === false && spoken.trim()) return spoken;
  const target = intent.target;
  if (
    !target ||
    intent.action === "describe" ||
    !["navigate", "highlight"].includes(intent.action)
  ) {
    return spoken;
  }

  const guide = buildSectionGuide(target);
  if (!guide) return spoken;

  const openOfficial = Boolean(intent.payload?.openLink);
  const dry =
    spoken.length < 28 ||
    /^(ok|de acuerdo|listo|perfecto|entendido)\b/i.test(spoken.trim());

  if (dry) spoken = guide.spoken;
  if (openOfficial && !/oficial|otra pestaña|sigo acá/i.test(spoken)) {
    spoken = `${spoken.replace(/[.…]\s*$/, "")}. Te abrí el oficial en otra pestaña; yo sigo acá.`;
  }

  return spoken;
}

export async function POST(req: NextRequest) {
  try {
    return await handleChat(req);
  } catch (err) {
    console.error("chat route failed", err);
    const message =
      err instanceof Error ? err.message.slice(0, 200) : "chat failed";
    const status = err instanceof ApiSecurityError ? err.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

async function handleChat(req: NextRequest) {
  const authenticatedSession = secureApiRequest(req, {
    requireSession: true,
    maxBytes: 32_000,
    rateLimit: 40,
  });
  let body: {
    sessionId?: string;
    text?: string;
    context?: ClientPageContext;
    narration?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const originalText = body.text?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId)) {
    return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
  }
  if (authenticatedSession && sessionId !== authenticatedSession) {
    throw new ApiSecurityError(401, "La sesión no coincide");
  }
  if (!originalText) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (originalText.length > 4_000 || (body.narration?.length || 0) > 2_000) {
    return NextResponse.json({ error: "text too large" }, { status: 413 });
  }

  if (originalText.startsWith("__tour_narrate__:")) {
    const spoken = body.narration?.trim();
    if (!spoken) {
      return NextResponse.json({ error: "narration required" }, { status: 400 });
    }
    return withVoice(spoken, { via: "tour-tts" });
  }

  const corrected = correctSpeechTranscript(originalText);
  const text = corrected.text;
  const mem = getMemory(sessionId);
  appendTurn(sessionId, "user", text);
  const passiveFacts = extractPassiveContext(originalText);
  if (Object.keys(passiveFacts).length) {
    mergeSessionFacts(sessionId, passiveFacts);
    if (
      classifyConversationMode(originalText) === "command" &&
      !wantsRutWhatsAppHandoff(text) &&
      !wantsRutDemoWizard(text)
    ) {
      const details = [
        passiveFacts.name,
        passiveFacts.farm && `finca ${passiveFacts.farm}`,
        passiveFacts.crop && `cultivo ${passiveFacts.crop}`,
        passiveFacts.department && `departamento ${passiveFacts.department}`,
      ].filter(Boolean);
      const spoken = `Perfecto, guardé este contexto: ${details.join(
        ", "
      )}. ¿Qué querés consultar?`;
      appendTurn(sessionId, "assistant", spoken);
      return withVoice(spoken, { via: "local-context" });
    }
  }
  const fresh = getMemory(sessionId);
  const engineeringMode = isEngineeringPath(body.context?.pathname);
  const explicitRutOrWa =
    wantsRutWhatsAppHandoff(text) ||
    wantsRutDemoWizard(text) ||
    wantsRutExplainOnly(text);

  if (wantsSimpleGreeting(text) || wantsSimpleGreeting(originalText)) {
    const spoken = greetingReply(originalText || text, fresh.turns.length, {
      mode: engineeringMode ? "engineering" : "producer",
    });
    appendTurn(sessionId, "assistant", spoken);
    return withVoice(spoken, { via: "local", understood: true });
  }

  if (
    wantsEngineeringTour(text) ||
    (wantsGuidedTour(text) && engineeringMode)
  ) {
    const spoken =
      "Dale, te recorro ingeniería: el tablero, el QR de Collect, el flujo de campo y los cinco formularios. Si querés frenarlo, decime parar demo.";
    appendTurn(sessionId, "assistant", spoken);
    return withVoice(spoken, { via: "local", startTour: "engineering" });
  }

  if (wantsOdkWhatsApp(text) || (engineeringMode && wantsCampoCollector(text))) {
    const spoken = campoSpoken(false);
    appendTurn(sessionId, "assistant", spoken);
    const event = buildEvent(sessionId, "navigate", "odk-whatsapp", {
      openLink: false,
      click: true,
    });
    return withVoice(spoken, { via: "local", event, action: "navigate" });
  }

  if (wantsGuidedTour(text)) {
    const spoken =
      "Dale, arranco el recorrido del productor: un cultivo, herramientas, autoridades, precios, el QR de ODK y el RUT. Si querés frenarlo, decime parar demo.";
    appendTurn(sessionId, "assistant", spoken);
    return withVoice(spoken, { via: "local", startTour: "producer" });
  }

  const brainInput = {
    text,
    originalText,
    history: fresh.turns,
    lastSectionId: fresh.lastSectionId,
    pageContext: body.context,
    pendingFields: fresh.pendingFields,
    rutMode: fresh.rutMode,
    facts: fresh.facts,
  };

  const isPageQuestion =
    wantsPageLocation(text) || wantsExplainCurrentPage(text);
  let intent = isPageQuestion
    ? {
        action: "describe" as const,
        understood: true,
        useGuide: false,
        reply: "Reviso la sección actual.",
      }
    : resolveLocalIntent(text, originalText, fresh.turns);

  if (!intent) {
    intent =
      (await interpretFast({
        sessionId,
        ...brainInput,
        local: () => interpretWithGemini(brainInput),
      })) ?? interpretUtterance(text);

    if (shouldPreferLocalRules(text, originalText, intent)) {
      intent = interpretUtterance(text);
    }
  }

  // Meta mic / coherencia: nunca dejar que un falso "continuar" abra otra sección.
  if (wantsListeningCheck(text)) {
    const heard = text.length > 90 ? `${text.slice(0, 87)}…` : text;
    intent = {
      action: "describe",
      understood: true,
      useGuide: false,
      reply: `Sí, te escucho. Recibí: “${heard}”. Decime qué necesitás y lo vemos.`,
    };
  }

  if (
    engineeringMode &&
    !explicitRutOrWa &&
    (intent.action === "open_whatsapp" || intent.action === "open_rut")
  ) {
    intent = {
      action: "describe",
      target: "ingenieria",
      understood: true,
      useGuide: false,
      reply:
        "Acá estamos en ingeniería, no en el trámite del productor. Pedime el QR, un formulario o el recorrido y te lo marco.",
    };
  }

  // Solo explicación del RUT (sin registro ni wizard de carga).
  if (wantsRutExplainOnly(text)) {
    const spoken =
      "El RUT es el Registro Único de Tierras de Mendoza. Para registrarte lo derivamos a WhatsApp: un agente valida datos, pide fotos y documentación (texto o audio). ¿Querés que te abra WhatsApp ahora?";
    appendTurn(sessionId, "assistant", spoken);
    const event = buildEvent(sessionId, "navigate", "rut", {
      openLink: false,
      click: true,
    });
    return withVoice(spoken, { via: "local", event, action: "navigate" });
  }

  // RUT registro → WhatsApp (agente OpenWA). El wizard web queda solo si piden "wizard demo".
  if (
    !wantsListeningCheck(text) &&
    !wantsRutDemoWizard(text) &&
    (wantsRutWhatsAppHandoff(text) ||
      intent.action === "open_whatsapp" ||
      intent.action === "open_rut")
  ) {
    const wa = buildWhatsAppRutUrl();
    const spoken = whatsAppRutSpoken(Boolean(wa));
    appendTurn(sessionId, "assistant", spoken);
    const event = buildEvent(sessionId, "open_whatsapp", wa || undefined, {
      alsoNavigate: true,
      sectionId: "rut",
      whatsappUrl: wa || undefined,
    });
    return withVoice(spoken, {
      via: "local",
      event,
      action: "open_whatsapp",
    });
  }

  const remember = intent.payload?.remember;
  if (remember && typeof remember === "object") {
    mergeSessionFacts(sessionId, remember as Record<string, string>);
  }

  intent = withNavigationDefaults(intent);

  // Page awareness: "dónde estoy" / "explicame esto"
  if (isPageQuestion) {
    const sectionId =
      body.context?.sectionId ||
      mem.lastSectionId ||
      (body.context?.pathname?.startsWith("/rut") ? "rut" : undefined) ||
      (engineeringMode ? "ingenieria" : undefined);
    const guide = sectionId ? buildSectionGuide(sectionId) : null;
    const title =
      body.context?.sectionTitle || guide?.title || sectionId || "el inicio";
    const blurb = body.context?.sectionBlurb;
    const rutBit = body.context?.rutStep
      ? ` Estás en el paso ${body.context.rutStep} del wizard RUT.`
      : "";
    intent = withNavigationDefaults({
      action: sectionId ? "describe" : "go_home",
      target: sectionId,
      understood: true,
      useGuide: false,
      payload: { openLink: false, click: Boolean(sectionId) },
      reply: sectionId
        ? `Estás en ${title}.${rutBit} ${
            blurb || guide?.spoken || "Es una sección del portal de Agricultura."
          } ¿Querés profundizar en esta sección o ir a otra?`
        : "Estás en el inicio de la demo. Pedime un cultivo, mapas o el RUT y te llevo. Si sos del equipo técnico, pedime la vista de ingeniería.",
    });
  }

  const engineeringQ = resolveEngineeringQuestion(text, {
    inEngineeringView: engineeringMode,
  });
  if (engineeringQ && !explicitRutOrWa) {
    intent = withNavigationDefaults({
      action: engineeringQ.action,
      target: engineeringQ.target,
      understood: true,
      useGuide: false,
      payload: {
        openLink: false,
        click: engineeringQ.action === "navigate",
      },
      reply: engineeringQ.reply,
    });
  }

  // ODK / QR: always land on the dedicated card with a clear human explanation.
  if (!engineeringQ && wantsOdkHelp(text)) {
    const guide = buildSectionGuide("odk-collect");
    intent = withNavigationDefaults({
      action: "navigate",
      target: "odk-collect",
      understood: true,
      useGuide: false,
      payload: { openLink: false, click: true },
      reply:
        guide?.spoken ??
        "El QR de ODK es para ingeniería, no para el trámite del productor. Te abro esa vista: Collect, formularios reales y el tablero técnico.",
    });
  }

  const rutWebActive =
    wantsRutDemoWizard(text) ||
    mem.rutMode === "collecting" ||
    mem.rutMode === "confirm" ||
    Boolean(body.context?.pathname?.startsWith("/rut"));
  // Mencionar nombre, finca o departamento fuera del wizard es contexto,
  // no una solicitud implícita de registro.
  let localFields = rutWebActive
    ? normalizeRutFields(extractFormFields(originalText))
    : {};
  if (
    (mem.rutMode === "collecting" || mem.rutMode === "confirm") &&
    !localFields.razonSocial
  ) {
    const named = originalText.match(
      /(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .'-]{3,60})/i
    );
    if (named) {
      localFields.razonSocial = named[1]
        .replace(/\s+(y|con|de)\s+(cuit|correo|mail|tel|cuil).*$/i, "")
        .trim();
    }
  }
  if (rutWebActive && intent.extractedFields) {
    localFields = normalizeRutFields({
      ...normalizeRutFields(intent.extractedFields),
      ...localFields,
    });
  }

  const recallPrior = wantsRecallPriorFields(text);
  if (recallPrior) {
    for (const turn of mem.turns) {
      if (turn.role !== "user") continue;
      Object.assign(
        localFields,
        normalizeRutFields(extractFormFields(turn.text))
      );
    }
    Object.assign(localFields, normalizeRutFields(mem.pendingFields));
  }

  const strongRutKeys = [
    "cuit",
    "email",
    "telefono",
    "razonSocial",
    "condicionTierra",
    "nombreEstablecimiento",
    "departamento",
    "localidad",
  ];
  const hasStrongRutFields = strongRutKeys.some((k) => localFields[k]);
  const intentIsRut =
    intent.action === "open_rut" ||
    intent.action === "fill_form" ||
    intent.action === "ask_confirm" ||
    intent.action === "rut_focus_field" ||
    intent.action === "rut_set_step" ||
    intent.action === "show_checklist" ||
    mem.rutMode === "collecting" ||
    mem.rutMode === "confirm";

  let fieldConflictNote = "";
  if (
    Object.keys(localFields).length &&
    (intentIsRut || hasStrongRutFields || recallPrior)
  ) {
    const merged = mergePendingFieldsDetailed(sessionId, localFields);
    if (merged.conflicts.length) {
      fieldConflictNote = conflictSpoken(merged.conflicts);
    }
    intent.extractedFields = {
      ...normalizeRutFields(intent.extractedFields ?? {}),
      ...localFields,
    };
    setRutProgress(sessionId, { rutMode: "collecting" });
    if ((hasStrongRutFields || recallPrior) && !intentIsRut) {
      intent = {
        ...intent,
        action: "open_rut",
        understood: true,
        useGuide: false,
      };
    }
  }

  // Local fill preference wins over Gemini (often omits fillMode).
  // "seguimos" suelto NO dispara auto-fill (solo en confirm / checklist).
  const localFill = detectFillPreference(originalText);
  if (
    localFill &&
    !intent.fillMode &&
    (localFill !== "auto" ||
      mem.awaitingFillConfirm ||
      mem.rutMode === "confirm" ||
      /checklist|completalo|cargalo|confirm/i.test(originalText))
  ) {
    intent = { ...intent, fillMode: localFill };
  }
  if (
    (mem.awaitingFillConfirm || mem.rutMode === "confirm") &&
    isAffirmativeRut(originalText) &&
    !intent.fillMode
  ) {
    intent = { ...intent, fillMode: "auto" };
  }

  const mentionedDocs = extractMentionedDocs(originalText);

  if (
    wantsOpenResource(text) &&
    intent.action !== "open_rut" &&
    intent.action !== "fill_form" &&
    intent.action !== "ask_confirm" &&
    mem.rutMode !== "collecting" &&
    mem.rutMode !== "confirm"
  ) {
    const hit = findBestSections(text, 1)[0];
    const intentTarget = intent.target;
    const sectionId =
      (intentTarget &&
      catalog.sections.some((s) => s.id === intentTarget) &&
      intent.action !== "open_external" &&
      intent.action !== "scroll"
        ? intentTarget
        : undefined) ||
      hit?.id ||
      (intent.payload?.sectionId
        ? String(intent.payload.sectionId)
        : undefined) ||
      mem.lastSectionId;
    const catalogUrl = officialUrlFor(sectionId);
    const candidate =
      (typeof intent.payload?.url === "string" && intent.payload.url) ||
      (intent.action === "open_external" && intent.target
        ? String(intent.target)
        : undefined) ||
      "";
    const home = catalog.sourceUrl.replace(/\/$/, "");
    const candidateNorm = candidate.replace(/\/$/, "");
    const isGenericHome =
      !candidate ||
      candidateNorm === home ||
      candidateNorm === `${home}/` ||
      candidate.includes("direccion-de-agricultura");
    const url = (!isGenericHome && candidate) || catalogUrl || catalog.sourceUrl;
    intent = {
      action: "open_external",
      target: String(url),
      understood: true,
      useGuide: false,
      payload: {
        ...(intent.payload ?? {}),
        sectionId,
        url: String(url),
        openLink: true,
        redirect: true,
      },
      reply: /(no se abrio|no se abrió|no abrio|no abrió|no aparecio|no apareció)/.test(
        text
      )
        ? "Perdón: a veces el navegador bloquea la ventana. Tocá el botón azul «Abrir sitio oficial» abajo a la izquierda; con ese toque sí abre. Yo sigo acá."
        : `Dale, te abro el recurso oficial${sectionId ? ` de ${sectionId.replace(/-/g, " ")}` : ""} en otra pestaña. Si no aparece, tocá «Abrir sitio oficial». Yo sigo acá.`,
    };
  }

  // Document checklist for RUT step 4 (explicit ask only — not "tengo constancia…")
  if (wantsChecklist(text) && intent.fillMode !== "auto") {
    const condicion =
      getMemory(sessionId).pendingFields.condicionTierra || "Titular";
    intent = {
      action: "show_checklist",
      understood: true,
      useGuide: false,
      payload: {
        condicion_tierra: condicion,
        has_vid: /vid|uva|vino/.test(text),
      },
      reply: `Te muestro el checklist de documentos para condición ${condicion}. En la demo es una guía; en el oficial se presenta según tu caso.`,
    };
  }

  if (intent.payload?.continueTour && mem.lastSectionId) {
    const nextId =
      RELATED_NEXT[mem.lastSectionId] ||
      buildSectionGuide(mem.lastSectionId)?.related[0]?.id;
    if (nextId) {
      const guide = buildSectionGuide(nextId);
      intent = withNavigationDefaults({
        action: "navigate",
        target: nextId,
        understood: true,
        useGuide: false,
        payload: { openLink: true, click: true },
        reply:
          guide?.spoken ??
          `Seguimos por ${nextId}. ¿Tenés alguna duda, o vamos a otra cosa?`,
      });
    }
  }

  if (intent.payload?.explainLast && mem.lastSectionId) {
    const guide = buildSectionGuide(mem.lastSectionId);
    intent = withNavigationDefaults({
      action: "describe",
      target: mem.lastSectionId,
      understood: true,
      useGuide: false,
      payload: { openLink: false, click: true },
      reply:
        guide?.spoken ??
        "Te vuelvo a marcar la sección. ¿Qué parte querés que te aclare?",
    });
  }

  if (intent.endSession) {
    clearSession(sessionId);
    const event = buildEvent(sessionId, "go_home");
    return withVoice(intent.reply, { via: "gemini", event, endSession: true });
  }

  if (
    rutWebActive &&
    intent.extractedFields &&
    Object.keys(intent.extractedFields).length
  ) {
    mergePendingFields(sessionId, normalizeRutFields(intent.extractedFields));
    setRutProgress(sessionId, { rutMode: "collecting" });
  }

  const pending = normalizeRutFields(getMemory(sessionId).pendingFields);
  const hasPending = Object.keys(pending).length > 0;
  const justGotFields = Object.keys(localFields).length > 0;
  const missingNow = nextRutField(pending);
  const rutLive =
    mem.rutMode === "collecting" ||
    mem.rutMode === "confirm" ||
    getMemory(sessionId).rutMode === "collecting" ||
    getMemory(sessionId).rutMode === "confirm";

  // Docs mentioned while form is complete → finish (fill + checklist), don't loop.
  if (
    rutLive &&
    hasPending &&
    !missingNow &&
    mentionedDocs.length > 0 &&
    intent.fillMode !== "manual"
  ) {
    intent = { ...intent, fillMode: "auto" };
  }

  // After a successful RUT close, don't re-enter the collect loop.
  // Use fresh memory (field harvest may have moved mode back to collecting).
  if (getMemory(sessionId).rutMode === "done" && intent.action !== "open_rut") {
    if (
      wantsChecklist(text) ||
      mentionedDocs.length > 0 ||
      isAffirmativeRut(originalText) ||
      intent.fillMode === "auto"
    ) {
      const condicion = pending.condicionTierra || "Titular";
      const spoken =
        "Ya te dejé los datos cargados y el checklist en el paso 4. Si querés corregir algún campo, decime cuál; si no, seguimos con otra consulta del portal.";
      publish(
        buildEvent(sessionId, "show_checklist", undefined, {
          condicion_tierra: condicion,
        })
      );
      appendTurn(sessionId, "assistant", spoken);
      return withVoice(spoken, {
        via: "local",
        event: buildEvent(sessionId, "show_checklist", undefined, {
          condicion_tierra: condicion,
        }),
      });
    }
  }

  if (intent.action === "open_rut" && !justGotFields) {
    setRutProgress(sessionId, { rutMode: "collecting", rutStep: 1 });
    if (missingNow) {
      const guided = wantsToPassRutData(originalText) || mem.rutMode === "collecting"
        ? askFirstField(RUT_ASK_HINT[missingNow])
        : `${intent.reply.replace(/\s+$/, "")} ${askFirstField(
            RUT_ASK_HINT[missingNow]
          )}`;
      intent = { ...intent, reply: guided };
    }
  } else if (
    wantsToPassRutData(originalText) &&
    !justGotFields &&
    (rutLive || /rut|registro|declaracion/.test(text))
  ) {
    setRutProgress(sessionId, { rutMode: "collecting", rutStep: 1 });
    const missing = nextRutField(pending) || "cuit";
    intent = {
      action: "open_rut",
      understood: true,
      useGuide: false,
      fillMode: undefined,
      reply: askFirstField(RUT_ASK_HINT[missing as keyof typeof RUT_ASK_HINT]),
    };
    publish(buildEvent(sessionId, "open_rut"));
    publish(buildEvent(sessionId, "rut_focus_field", missing));
  } else if (
    (rutLive || justGotFields || intent.action === "open_rut") &&
    intent.fillMode !== "auto" &&
    intent.action !== "show_checklist" &&
    intent.action !== "open_external"
  ) {
    const missing = missingNow;
    const stepFor =
      (missing && RUT_STEP_FOR_FIELD[missing]) ||
      Math.max(
        1,
        ...Object.keys(pending).map((k) => RUT_STEP_FOR_FIELD[k] || 1),
        1
      );

    if (justGotFields && missing) {
      const salt = bumpAckSalt(sessionId);
      publish(buildEvent(sessionId, "open_rut"));
      intent = {
        action: "fill_form",
        target: "rut",
        understood: true,
        useGuide: false,
        fillMode: undefined,
        payload: { fields: pending, mode: "auto", step: stepFor },
        reply: [
          fieldConflictNote,
          recallPrior
            ? recallConflictSpoken(RUT_ASK_HINT[missing], pending)
            : ackAndAskNext(localFields, RUT_ASK_HINT[missing], salt),
        ]
          .filter(Boolean)
          .join(" "),
      };
      publish(
        buildEvent(sessionId, "fill_form", "rut", {
          fields: pending,
          mode: "auto",
          step: stepFor,
        })
      );
      publish(buildEvent(sessionId, "rut_focus_field", missing));
      setRutProgress(sessionId, { rutMode: "collecting", rutStep: stepFor });
    } else if (recallPrior && missing) {
      publish(buildEvent(sessionId, "open_rut"));
      publish(buildEvent(sessionId, "rut_focus_field", missing));
      intent = {
        action: "rut_focus_field",
        target: missing,
        understood: true,
        useGuide: false,
        reply: recallConflictSpoken(RUT_ASK_HINT[missing], pending),
      };
    } else if (justGotFields && !missing) {
      setRutProgress(sessionId, { rutMode: "confirm", rutStep: 4 });
      setAwaitingFill(sessionId, true);
      const spoken = askConfirmReady(pending);
      intent = {
        action: "ask_confirm",
        understood: true,
        useGuide: false,
        fillMode: "ask",
        confirm: {
          type: "fill",
          fields: pending,
          question: spoken,
        },
        reply: spoken,
      };
    } else if (
      hasPending &&
      missing &&
      !mem.awaitingFillConfirm &&
      mem.rutMode !== "confirm"
    ) {
      intent = {
        action: "rut_focus_field",
        target: missing,
        understood: true,
        useGuide: false,
        payload: { field: missing, step: stepFor },
        reply: hasPending
          ? `Continuamos. Páseme ${RUT_ASK_HINT[missing]}.`
          : askFirstField(RUT_ASK_HINT[missing]),
      };
      publish(
        buildEvent(sessionId, "rut_set_step", String(stepFor), { step: stepFor })
      );
      publish(buildEvent(sessionId, "rut_focus_field", missing));
    } else if (hasPending && !missing) {
      setRutProgress(sessionId, { rutMode: "confirm", rutStep: 4 });
      setAwaitingFill(sessionId, true);
      const spoken = askConfirmReady(pending);
      intent = {
        action: "ask_confirm",
        understood: true,
        useGuide: false,
        fillMode: "ask",
        confirm: {
          type: "fill",
          fields: pending,
          question: spoken,
        },
        reply: spoken,
      };
    }
  }

  // Confirm / "completalo vos" / docs → fill wizard + show checklist (no loops).
  if (intent.fillMode === "auto" && hasPending) {
    const missingBeforeFill = nextRutField(pending);
    const userAskedFill =
      isAffirmativeRut(originalText) ||
      Boolean(detectFillPreference(originalText) === "auto") ||
      mentionedDocs.length > 0;

    if (missingBeforeFill && Object.keys(pending).length < 2 && !userAskedFill) {
      const event = buildEvent(sessionId, "open_rut");
      const spoken = ackAndAskNext(
        pending,
        RUT_ASK_HINT[missingBeforeFill],
        bumpAckSalt(sessionId)
      );
      appendTurn(sessionId, "assistant", spoken);
      return withVoice(spoken, { via: "gemini", event });
    }

    // Still missing fields → keep collecting (acknowledge docs if they listed any).
    if (missingBeforeFill) {
      setRutProgress(sessionId, { rutMode: "collecting" });
      setAwaitingFill(sessionId, false);
      const docsBit = mentionedDocs.length
        ? ` Bien por ${mentionedDocs.join(" y ")}.`
        : "";
      const spoken = `${docsBit} Todavía me falta ${RUT_ASK_HINT[missingBeforeFill]} para cargarlo completo. ¿Me lo pasás?`.trim();
      publish(buildEvent(sessionId, "rut_focus_field", missingBeforeFill));
      appendTurn(sessionId, "assistant", spoken);
      return withVoice(spoken, {
        via: "local",
        event: buildEvent(sessionId, "open_rut"),
      });
    }

    const condicion = pending.condicionTierra || "Titular";
    const spoken = completeRutSpoken(pending, condicion, mentionedDocs);
    publish(
      buildEvent(sessionId, "fill_form", "rut", {
        fields: pending,
        mode: "auto",
        step: 1,
      })
    );
    publish(
      buildEvent(sessionId, "show_checklist", undefined, {
        condicion_tierra: condicion,
        has_vid: false,
      })
    );
    setRutProgress(sessionId, { rutMode: "done", rutStep: 4 });
    setAwaitingFill(sessionId, false);
    clearPendingFill(sessionId);
    appendTurn(sessionId, "assistant", spoken);
    return withVoice(spoken, {
      via: "local",
      event: buildEvent(sessionId, "show_checklist", undefined, {
        condicion_tierra: condicion,
      }),
      confirm: null,
    });
  }

  if (intent.fillMode === "manual" && (hasPending || mem.awaitingFillConfirm)) {
    const event = buildEvent(sessionId, "open_rut", undefined, {
      fields: pending,
      mode: "manual",
    });
    setAwaitingFill(sessionId, false);
    appendTurn(sessionId, "assistant", intent.reply);
    return withVoice(intent.reply, { via: "gemini", event });
  }

  if (intent.action === "ask_confirm" && hasPending) {
    setAwaitingFill(sessionId, true);
    setRutProgress(sessionId, { rutMode: "confirm" });
    const event = buildEvent(sessionId, "open_rut", undefined, {
      fields: pending,
      mode: "ask",
    });
    const question =
      intent.confirm?.question ??
      intent.reply ??
      askConfirmReady(pending);
    appendTurn(sessionId, "assistant", question);
    return withVoice(question, {
      via: "gemini",
      event,
      confirm: { type: "fill", fields: pending, question },
    });
  }

  if (intent.action === "open_external" && intent.payload?.alsoOpenRut) {
    publish(buildEvent(sessionId, "open_rut"));
  }
  if (
    intent.action === "open_external" &&
    intent.payload?.alsoNavigate &&
    intent.payload?.sectionId
  ) {
    publish(
      buildEvent(sessionId, "navigate", String(intent.payload.sectionId), {
        openLink: false,
        click: true,
      })
    );
  }

  // Smart back: return to previous section in memory when possible
  if (intent.action === "go_back") {
    const prev = popPreviousSection(sessionId);
    if (prev) {
      intent = {
        action: "navigate",
        target: prev,
        understood: true,
        useGuide: false,
        payload: { openLink: false, click: true },
        reply:
          intent.reply ||
          `Volvemos a ${prev.replace(/-/g, " ")}. ¿Seguimos desde acá?`,
      };
    }
  }

  const spoken = humanizeSpoken(resolveSpokenReply(intent));
  const event = buildEvent(
    sessionId,
    intent.action,
    intent.target,
    intent.payload
  );
  if (
    intent.target &&
    (intent.action === "navigate" ||
      intent.action === "describe" ||
      intent.action === "highlight" ||
      intent.action === "open_rut")
  ) {
    setLastSection(
      sessionId,
      intent.action === "open_rut" ? "rut" : intent.target
    );
  }

  appendTurn(sessionId, "assistant", spoken);

  const via =
    process.env.USE_N8N_AS_BRAIN === "true" && process.env.N8N_WEBHOOK_URL
      ? "n8n-gemini"
      : process.env.GEMINI_API_KEY
        ? "gemini"
        : "local";

  return withVoice(spoken, {
    via,
    event,
    understood: intent.understood !== false,
    heardAs: intent.payload?.heardAs ?? undefined,
    corrected: corrected.changed ? text : undefined,
  });
}
