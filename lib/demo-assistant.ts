import {
  detectFillPreference,
  extractFormFields,
  fieldLabels,
  wantsEndSession,
} from "@/lib/form-extract";
import { wantsContinueTour, wantsListeningCheck } from "@/lib/intent-guards";
import {
  answerFact,
  findBestSections,
  officialUrlFor,
  wantsOpenLink,
  wantsScroll,
} from "@/lib/page-knowledge";
import { buildSectionGuide } from "@/lib/section-guide";
import type { AgentAction } from "@/lib/types";

export type AssistantIntent = {
  action: AgentAction;
  target?: string;
  payload?: Record<string, unknown>;
  reply: string;
  extractedFields?: Record<string, string>;
  fillMode?: "auto" | "manual" | "ask";
  confirm?: {
    type: "fill";
    fields: Record<string, string>;
    question: string;
  };
  endSession?: boolean;
  understood?: boolean;
  /** When false, chat uses reply as-is (no section-guide override). */
  useGuide?: boolean;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function interpretUtterance(raw: string): AssistantIntent {
  const text = normalize(raw);
  const extractedFields = extractFormFields(raw);
  const fillMode = detectFillPreference(raw);
  const hasFields = Object.keys(extractedFields).length > 0;
  const openLink = wantsOpenLink(raw);

  if (!text) {
    return {
      action: "describe",
      understood: false,
      useGuide: false,
      reply:
        "Dígame qué necesita: un cultivo, mapas, precios, capacitaciones o el RUT, y lo resolvemos.",
    };
  }

  if (wantsListeningCheck(raw)) {
    return {
      action: "describe",
      understood: true,
      useGuide: false,
      reply:
        "Sí, la escucho a usted. Acabo de recibir su mensaje. ¿En qué la puedo ayudar: RUT, un cultivo, mapas o clima?",
    };
  }

  if (wantsEndSession(raw)) {
    return {
      action: "go_home",
      endSession: true,
      understood: true,
      reply:
        "Listo, cierro la sesión y apago el micrófono. Cuando quiera, arrancamos de nuevo.",
    };
  }

  if (hasFields) {
    if (fillMode === "auto") {
      return {
        action: "fill_form",
        target: "rut",
        extractedFields,
        fillMode: "auto",
        understood: true,
        payload: { fields: extractedFields, mode: "auto", step: 1 },
        reply: `Le abro el RUT y cargo ${fieldLabels(
          extractedFields
        )}. Si hay que corregir algo, me lo dice.`,
      };
    }
    if (fillMode === "manual") {
      return {
        action: "open_rut",
        extractedFields,
        fillMode: "manual",
        understood: true,
        payload: { fields: extractedFields, mode: "manual" },
        reply:
          "Dejo el wizard abierto para que lo complete usted. Voy marcando los campos.",
      };
    }
    return {
      action: "ask_confirm",
      target: "rut",
      extractedFields,
      fillMode: "ask",
      understood: true,
      payload: { fields: extractedFields },
      confirm: {
        type: "fill",
        fields: extractedFields,
        question: `Registré ${fieldLabels(
          extractedFields
        )}. ¿Los cargo yo en el RUT, o los carga usted?`,
      },
      reply: `Registré ${fieldLabels(
        extractedFields
      )}. ¿Los cargo yo en el formulario, o prefiere cargarlos usted?`,
    };
  }

  if (fillMode === "auto") {
    return {
      action: "fill_form",
      fillMode: "auto",
      understood: true,
      reply: "De acuerdo, los cargo yo en el formulario.",
    };
  }
  if (fillMode === "manual") {
    return {
      action: "open_rut",
      fillMode: "manual",
      understood: true,
      reply: "Queda para que lo complete usted en el wizard.",
    };
  }

  if (
    /\bajo\b/.test(text) ||
    /(llevame|mostrame|andate|anda|ir)\s+(a\s+)?(abajo|a bajo)\b/.test(text)
  ) {
    return {
      action: "navigate",
      target: "ajo",
      understood: true,
      useGuide: false,
      payload: { openLink: true, click: true },
      reply:
        "Lo llevo a ajo: informes y datos productivos del cultivo. Le abro la ficha oficial. ¿Después seguimos por tomate industria o por precios?",
    };
  }

  const scroll = wantsScroll(raw);
  if (scroll) {
    return {
      action: "scroll",
      target: scroll,
      understood: true,
      reply:
        scroll === "down"
          ? "Bajo un poco para que veas lo que sigue."
          : scroll === "up"
            ? "Subo un poco."
            : scroll === "top"
              ? "Te llevo arriba de todo."
              : "Te llevo hasta el final.",
    };
  }

  if (
    /adelante|siguiente recurso|avanza(r)? en el visor|forward/.test(text)
  ) {
    return {
      action: "go_forward",
      understood: true,
      useGuide: false,
      reply: "Dale, avanzo al siguiente recurso del visor.",
    };
  }

  if (
    /volver|atras|para atras|retrocede|cerra|cerrar|sali del recurso|volve a la demo|volvé a la demo/.test(
      text
    )
  ) {
    return {
      action: "go_back",
      understood: true,
      useGuide: false,
      reply:
        "Listo, cierro el recurso y volvemos a la demo. Seguí hablándome cuando quieras.",
    };
  }

  if (/inicio|home|portada|arriba del portal/.test(text) && !/helada/.test(text)) {
    return {
      action: "go_home",
      understood: true,
      reply: "Te llevo al inicio del portal. Decime qué querés ver.",
    };
  }

  if (
    /(inscrib|registrar|llevar.*rut|llevame.*rut|\brut\b|registro unico|wizard)/.test(
      text
    )
  ) {
    if (/(paso\s*)?4|archivo|documentac|papel/.test(text)) {
      const locatario = /locatario|arrendatario|alquiler/.test(text);
      return {
        action: "show_checklist",
        understood: true,
        payload: {
          condicion_tierra: locatario ? "Locatario/Arrendatario" : "Titular",
        },
        reply: locatario
          ? "Te llevo al paso 4, con la documentación de locatario o arrendatario."
          : "Te llevo al paso 4 del RUT, al checklist de papeles.",
      };
    }
    const stepMatch = text.match(/paso\s*([1-5])/);
    if (stepMatch) {
      return {
        action: "rut_set_step",
        target: stepMatch[1],
        understood: true,
        reply: `Te abro el paso ${stepMatch[1]} del wizard.`,
      };
    }
    if (openLink || /\bsia\b|oficial/.test(text)) {
      return {
        action: "open_external",
        target: officialUrlFor("rut"),
        understood: true,
        payload: { alsoOpenRut: true },
        reply:
          "Te abro el SIA oficial y también el wizard DEMO del RUT, para que veas el recorrido.",
      };
    }
    return {
      action: "open_rut",
      understood: true,
      useGuide: false,
      reply:
        "Le abro el wizard del RUT para cargar la declaración paso a paso. Si me pasa CUIT o mail, le pregunto si los cargo yo. ¿Arrancamos por el paso 1?",
    };
  }

  if (/hola|buen dia|buenas|ayuda|que podes|que haces|como andas|como esta/.test(text)) {
    return {
      action: "describe",
      understood: true,
      useGuide: false,
      reply:
        "Hola, soy el asistente de Agricultura Mendoza. Puedo resolverle el RUT, llevarlo a un cultivo, mapas o clima. ¿Qué necesita ahora?",
    };
  }

  if (wantsContinueTour(raw)) {
    return {
      action: "scroll",
      target: "down",
      understood: true,
      useGuide: false,
      payload: { continueTour: true },
      reply:
        "Seguimos. Si quiere ir a algo puntual, diga el nombre: RUT, mapas, ajo o agrometeorología.",
    };
  }

  if (/duda|no entendi|explica|mas info|contame mas|que significa/.test(text)) {
    return {
      action: "describe",
      understood: true,
      useGuide: false,
      payload: { explainLast: true },
      reply:
        "Claro. Dígame qué parte no le cerró y se la explico, o pedime que vuelva a marcar esa sección.",
    };
  }

  const fact = answerFact(raw);
  if (fact) {
    if (fact.externalUrl && openLink) {
      return {
        action: "open_external",
        target: fact.externalUrl,
        understood: true,
        payload: { sectionId: fact.id },
        reply: fact.spoken,
      };
    }
    return {
      action: "describe",
      target: fact.id,
      understood: true,
      payload: fact.externalUrl
        ? { openLink: openLink, url: fact.externalUrl }
        : {},
      reply: fact.spoken,
    };
  }

  const hits = findBestSections(raw, 3);
  const best = hits[0];
  if (best && best.score >= 3) {
    const guide = buildSectionGuide(best.id);
    const spoken =
      guide?.spoken ??
      best.spoken ??
      `Dale, te llevo a ${best.title}.`;

    if (openLink) {
      const url = best.externalUrl || officialUrlFor(best.id);
      return {
        action: "open_external",
        target: url,
        understood: true,
        payload: { sectionId: best.id, alsoNavigate: true },
        reply: `${spoken} Además te abro el recurso oficial.`,
      };
    }

    return {
      action: "navigate",
      target: best.id,
      understood: true,
      payload: {
        openLink: false,
        related: hits.slice(1).map((h) => h.title),
      },
      reply: spoken,
    };
  }

  return {
    action: "describe",
    understood: false,
    useGuide: false,
    reply:
      "No lo seguí del todo. ¿Busca el RUT, un cultivo (ajo, ciruela…), mapas o clima? Dígamelo en una frase y lo resuelvo.",
  };
}
