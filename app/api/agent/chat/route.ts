import { NextRequest, NextResponse } from "next/server";
import { publish } from "@/lib/agent-bus";
import {
  appendTurn,
  bumpAckSalt,
  clearPendingFill,
  clearSession,
  getMemory,
  mergePendingFields,
  mergeSessionFacts,
  popPreviousSection,
  setAwaitingFill,
  setLastSection,
  setRutProgress,
} from "@/lib/chat-memory";
import { interpretUtterance } from "@/lib/demo-assistant";
import { wantsGuidedTour } from "@/lib/demo-tour";
import { synthesizeSpeech } from "@/lib/elevenlabs";
import {
  detectFillPreference,
  extractFormFields,
} from "@/lib/form-extract";
import { interpretWithGemini } from "@/lib/gemini-brain";
import { interpretFast } from "@/lib/n8n-brain";
import { catalog, officialUrlFor } from "@/lib/page-knowledge";
import type { ClientPageContext } from "@/lib/page-context";
import {
  ackAndAskNext,
  askConfirmReady,
  askFirstField,
  completeRutSpoken,
  extractMentionedDocs,
  isAffirmativeRut,
  normalizeRutFields,
  wantsRutChecklist,
  wantsToPassRutData,
} from "@/lib/rut-conversation";
import { buildSectionGuide } from "@/lib/section-guide";
import { wantsOdkHelp } from "@/lib/spoken-fields";
import { humanizeSpoken } from "@/lib/spoken-style";
import { wantsOpenResource } from "@/lib/open-resource";
import { correctSpeechTranscript } from "@/lib/stt-correct";
import type { AgentEvent } from "@/lib/types";

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

function wantsWhereAmI(raw: string) {
  return /(donde estoy|en que (pagina|seccion)|que estoy viendo|donde me dejaste)/.test(
    raw
  );
}

function wantsExplainHere(raw: string) {
  return /(explicame (esto|esta|aca|aquí|aqui)|que es (esto|esta seccion)|contame (de )?esto|que hay aca|que hay aquí|que hay aqui)/.test(
    raw
  );
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
  const text = humanizeSpoken(spoken);
  let audioBase64: string | undefined;
  let audioMime: string | undefined;
  try {
    const audio = await synthesizeSpeech(text);
    if (audio) {
      audioBase64 = audio.toString("base64");
      audioMime = "audio/mpeg";
    }
  } catch (err) {
    console.error("TTS error", err);
  }
  return NextResponse.json({
    ok: true,
    spoken: text,
    reply: text,
    audioBase64,
    audioMime,
    voice: process.env.ELEVENLABS_VOICE_ID || "xDZJO6bbSnscJEAbhpRF",
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
    if (!payload.url) payload.url = officialUrlFor(intent.target);
  }
  const section = catalog.sections.find((s) => s.id === intent.target);
  const isCard =
    Boolean(section && ("summary" in section || "externalUrl" in section)) &&
    !["autoridades", "mision", "vision", "funcion", "normativa"].includes(
      String(intent.target)
    );
  if (isMove && isCard) {
    // Mark on the demo AND leave to the official resource (popup is often blocked).
    payload.openLink = true;
    payload.redirect = true;
  }
  if (intent.action === "describe" && payload.openLink === undefined) {
    payload.openLink = false;
  }
  if (intent.action === "open_external") {
    payload.redirect = true;
  }

  if (intent.action === "open_rut" && payload.openExternal === undefined) {
    payload.openExternal = false;
  }

  return { ...intent, payload, useGuide: false };
}

export async function POST(req: NextRequest) {
  try {
    return await handleChat(req);
  } catch (err) {
    console.error("chat route failed", err);
    const message =
      err instanceof Error ? err.message.slice(0, 200) : "chat failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function handleChat(req: NextRequest) {
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
  if (!originalText) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
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
  const fresh = getMemory(sessionId);

  if (wantsGuidedTour(text)) {
    const spoken =
      "Dale. Arranco el viaje del productor: un cultivo, herramientas, autoridades, precios, el QR de ODK y el RUT. Si querés parar, decime parar demo.";
    appendTurn(sessionId, "assistant", spoken);
    return withVoice(spoken, { via: "local", startTour: true });
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

  let intent =
    (await interpretFast({
      sessionId,
      ...brainInput,
      local: () => interpretWithGemini(brainInput),
    })) ?? interpretUtterance(text);

  const remember = intent.payload?.remember;
  if (remember && typeof remember === "object") {
    mergeSessionFacts(sessionId, remember as Record<string, string>);
  }

  intent = withNavigationDefaults(intent);

  // Page awareness: "dónde estoy" / "explicame esto"
  if (wantsWhereAmI(text) || wantsExplainHere(text)) {
    const sectionId =
      body.context?.sectionId ||
      mem.lastSectionId ||
      (body.context?.pathname?.startsWith("/rut") ? "rut" : undefined);
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
          } Si querés, te llevo a otra cosa o seguimos el RUT.`
        : "Estás en el inicio de la demo. Pedime un cultivo, mapas, el QR de ODK o el RUT y te llevo.",
    });
  }

  // ODK / QR: always land on the dedicated card with a clear human explanation.
  if (wantsOdkHelp(text)) {
    const guide = buildSectionGuide("odk-collect");
    intent = withNavigationDefaults({
      action: "navigate",
      target: "odk-collect",
      understood: true,
      useGuide: false,
      payload: { openLink: false, click: true },
      reply:
        guide?.spoken ??
        "El QR es para la app ODK Collect en el celular: Agregar proyecto y escanear. No es un link web: lleva la URL del servidor. Te marco la sección con el facsímil educativo.",
    });
  }

  let localFields = normalizeRutFields(extractFormFields(originalText));
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
  if (intent.extractedFields) {
    localFields = normalizeRutFields({
      ...normalizeRutFields(intent.extractedFields),
      ...localFields,
    });
  }

  // "ya te lo pasé" → re-scan recent user turns for fields we missed
  if (
    /(te lo pase|ya te (lo )?dije|ya te (lo )?pase|ahi te (lo )?di|ya te lo di|te lo dije)/.test(
      text
    )
  ) {
    for (const turn of [...mem.turns].reverse()) {
      if (turn.role !== "user") continue;
      Object.assign(
        localFields,
        normalizeRutFields(extractFormFields(turn.text))
      );
    }
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

  if (Object.keys(localFields).length && (intentIsRut || hasStrongRutFields)) {
    mergePendingFields(sessionId, localFields);
    intent.extractedFields = {
      ...normalizeRutFields(intent.extractedFields ?? {}),
      ...localFields,
    };
    if (intentIsRut || hasStrongRutFields) {
      setRutProgress(sessionId, { rutMode: "collecting" });
    }
  }

  // Local fill preference wins over Gemini (often omits fillMode).
  const localFill = detectFillPreference(originalText);
  if (localFill && !intent.fillMode) {
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

  // "abrime los informes / el link / el oficial" must hard-redirect, even if Gemini only described.
  if (
    wantsOpenResource(text) &&
    intent.action !== "open_rut" &&
    intent.action !== "fill_form" &&
    intent.action !== "ask_confirm"
  ) {
    const sectionId =
      (intent.target &&
      intent.action !== "open_external" &&
      intent.action !== "scroll"
        ? intent.target
        : undefined) || mem.lastSectionId;
    const url =
      (intent.action === "open_external" && intent.target
        ? String(intent.target)
        : undefined) ||
      (typeof intent.payload?.url === "string" ? intent.payload.url : undefined) ||
      officialUrlFor(sectionId) ||
      catalog.sourceUrl;
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
        ? "Uy, disculpá: a veces el navegador bloquea la ventana. Tocá el botón azul «Abrir sitio oficial» abajo a la izquierda — con ese toque sí abre. Yo sigo acá."
        : intent.reply ||
          "Dale, te abro el recurso oficial en otra pestaña... Si no aparece, tocá «Abrir sitio oficial» en el aviso. Yo sigo acá escuchándote.",
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
    publish(event);
    return withVoice(intent.reply, { via: "gemini", event, endSession: true });
  }

  if (intent.extractedFields && Object.keys(intent.extractedFields).length) {
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

  if (intent.action === "open_rut") {
    setRutProgress(sessionId, { rutMode: "collecting", rutStep: 1 });
    if (missingNow && !justGotFields) {
      // Prefer a clean guided opener (don't stack Gemini + local ask).
      const guided = wantsToPassRutData(originalText) || mem.rutMode === "collecting"
        ? askFirstField(RUT_ASK_HINT[missingNow])
        : `${intent.reply.replace(/\s+$/, "")} ${askFirstField(
            RUT_ASK_HINT[missingNow]
          )}`;
      intent = { ...intent, reply: guided };
    }
  } else if (
    wantsToPassRutData(originalText) &&
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
    rutLive &&
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
      intent = {
        action: "fill_form",
        target: "rut",
        understood: true,
        useGuide: false,
        fillMode: undefined,
        payload: { fields: pending, mode: "auto", step: stepFor },
        reply: ackAndAskNext(localFields, RUT_ASK_HINT[missing], salt),
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
          ? `Seguimos. Pasame ${RUT_ASK_HINT[missing]}.`
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
      publish(event);
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
    publish(event);
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
    publish(event);
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

  const spoken = intent.reply;
  const event = buildEvent(
    sessionId,
    intent.action,
    intent.target,
    intent.payload
  );
  publish(event);

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
