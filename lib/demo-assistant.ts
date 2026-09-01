import {
  detectFillPreference,
  extractFormFields,
  fieldLabels,
  wantsEndSession,
} from "@/lib/form-extract";
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
      action: "navigate",
      target: "tramites",
      understood: false,
      reply:
        "Decime qué necesitás... un cultivo, mapas, precios, capacitaciones o el RUT.",
    };
  }

  if (wantsEndSession(raw)) {
    return {
      action: "go_home",
      endSession: true,
      understood: true,
      reply:
        "Listo, cierro la sesión y apago el micrófono. Cuando quieras, arrancamos de nuevo.",
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
        reply: `Dale, te abro el RUT y te cargo ${fieldLabels(
          extractedFields
        )}. Si hay que corregir algo, me lo decís.`,
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
          "Bueno, te dejo el wizard abierto para que lo cargues vos. Yo te voy marcando los campos.",
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
        question: `Atrapé ${fieldLabels(
          extractedFields
        )}. ¿Los cargo yo en el RUT, o los cargás a mano?`,
      },
      reply: `Atrapé ${fieldLabels(
        extractedFields
      )}... ¿Los cargo yo en el formulario, o preferís cargarlos a mano?`,
    };
  }

  if (fillMode === "auto") {
    return {
      action: "fill_form",
      fillMode: "auto",
      understood: true,
      reply: "Dale, los cargo yo en el formulario.",
    };
  }
  if (fillMode === "manual") {
    return {
      action: "open_rut",
      fillMode: "manual",
      understood: true,
      reply: "Perfecto, lo dejamos para que lo cargues vos.",
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
        "Dale, te llevo a ajo... Acá está el bloque del cultivo, con informes y datos productivos. Te abro la ficha oficial. ¿Querés que después sigamos por tomate industria o por precios?",
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
        "Dale, te abro el wizard del RUT... Acá vas a cargar la declaración paso a paso. Si me pasás CUIT o mail, te pregunto si los cargo yo. ¿Tenés alguna duda, o arrancamos por el paso 1?",
    };
  }

  if (/hola|buen dia|buenas|ayuda|que podes|que haces|como andas/.test(text)) {
    return {
      action: "navigate",
      target: "tramites",
      understood: true,
      useGuide: false,
      reply:
        "Hola, ¿cómo andás? Soy el asistente de Agricultura Mendoza. Puedo llevarte por toda la página: RUT, mapas, cultivos, clima, precios... Decime qué querés ver y te guío. ¿Por dónde arrancamos?",
    };
  }

  if (
    /^(si|dale|ok|va|de una|seguimos|segui|continua|continuar|siguiente|avance|avanzar|mostrame otra|otra seccion)$/.test(
      text
    ) ||
    /segui|continua|siguiente|avancemos|mostrame otra|otra cosa/.test(text)
  ) {
    return {
      action: "scroll",
      target: "down",
      understood: true,
      useGuide: false,
      payload: { continueTour: true },
      reply:
        "Dale, seguimos... Si querés ir a algo puntual, decime el nombre: RUT, mapas, ajo, agrometeorología...",
    };
  }

  if (/duda|no entendi|explica|mas info|contame mas|que significa/.test(text)) {
    return {
      action: "describe",
      understood: true,
      useGuide: false,
      payload: { explainLast: true },
      reply:
        "Claro. Decime qué parte no te cerró, o pedime que te lleve de nuevo a esa sección y te la explico despacio.",
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
    action: "navigate",
    target: "herramientas",
    understood: false,
    reply:
      "No te seguí del todo... Probá con ajo, ciruela, tomate, agrometeorología, mapas, radar, precios, capacitaciones o RUT. También puedo abrir el sitio oficial o el SIA.",
  };
}
