import { ODK_OFFICIAL_FORMS, ODK_SIMULATED_BOARD } from "@/lib/odk-engineering";
import type { AgentAction } from "@/lib/types";

export type EngineeringAnswer = {
  action: AgentAction;
  target: string;
  reply: string;
};

function normalize(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEngineeringPath(pathname?: string) {
  return Boolean(pathname?.startsWith("/ingenieria"));
}

export function wantsEngineeringTour(raw: string) {
  const t = normalize(raw);
  return /(recorrido (tecnico|de ingenieria|odk)|demo (tecnica|ingenieria)|tour (tecnico|odk|ingenieria)|explicame (odk|ingenieria|el sistema|collect)|mostrame (el flujo|odk|ingenieria|collect)|como se usa collect)/.test(
    t
  );
}

const FORM_HINTS: Array<{ test: RegExp; id: string }> = [
  {
    test: /certific|equipo|teledetec|brujula|gps/,
    id: "CertificacionEquiposTeledeteccion",
  },
  {
    test: /finca|cuartel/,
    id: "Feno26-Fincas_y_Cuarteles",
  },
  {
    test: /visita tecnica|visitas/,
    id: "Feno26-Visitas_Tecnicas",
  },
  {
    test: /olivo encontrado|encontre un olivo|alta de olivo/,
    id: "identif_olivos_encontrados_2026",
  },
  {
    test: /olivo a verificar|verificar olivo|verificacion de olivo/,
    id: "identif_verificar_olivo_2026",
  },
];

function formReply(id: string) {
  const form = ODK_OFFICIAL_FORMS.find((item) => item.id === id);
  if (!form) return "";
  const extra =
    "steps" in form
      ? ` ${form.steps.join(" ")}`
      : "crops" in form
        ? ` Cubre ${form.crops.slice(0, 4).join(", ")} y más.`
        : "states" in form
          ? ` Estados: ${form.states.join(", ")}.`
          : "";
  return `${form.name}, versión ${form.version}. ${form.purpose}${extra}`;
}

export function resolveEngineeringQuestion(
  raw: string,
  opts: { inEngineeringView?: boolean } = {}
): EngineeringAnswer | null {
  const t = normalize(raw);
  if (!t) return null;
  const inView = Boolean(opts.inEngineeringView);

  const explicitOdk =
    /(odk|collect|qr|agriencuestas|central|xform|app user|ingenieria)/.test(t);
  if (!inView && !explicitOdk) return null;

  if (
    /(whatsapp|wsp|cargar olivo|encontre un olivo|visita por chat|sin collect|bandeja)/.test(
      t
    )
  ) {
    return {
      action: "navigate",
      target: "odk-whatsapp",
      reply:
        "Acá el ingeniero no rellena casilleros. Habla por WhatsApp o por este chat de campo y yo armo una ficha simulada. La bandeja muestra el paquete de demo. No usamos los XForms reales ni tocamos Central.",
    };
  }

  if (/(tablero|kpi|power bi|numeros|indicadores|envios)/.test(t)) {
    const visits = ODK_SIMULATED_BOARD.kpis.find((k) => k.id === "visitas");
    return {
      action: "navigate",
      target: "odk-tablero",
      reply: `Ese tablero es una simulación para mostrar el pulso de campo, no envíos en vivo. En el recorte demo hay ${visits?.value ?? 84} visitas técnicas y cinco formularios publicados. ¿Querés que te baje a un formulario puntual?`,
    };
  }

  if (/(flujo|pasos|como se usa|como se carga|enviar|autosend|obtener en blanco)/.test(t)) {
    return {
      action: "navigate",
      target: "odk-flujo",
      reply:
        "El flujo es este: instalás Collect, escaneás el QR de app user, bajás los formularios en blanco, los llenás en campo y se envían por wifi o datos a Central. Este tablero demo no escribe nada en el servidor.",
    };
  }

  if (/(qr|escanear|app user|codigo)/.test(t) && !/rued|rut\b/.test(t)) {
    return {
      action: "navigate",
      target: "odk-collect",
      reply:
        "El QR es de app user: Collect lo descomprime y crea el proyecto Agricultura Mendoza, proyecto 4, en agriencuestas. No lo abras con la cámara ni con WhatsApp. Si el escaneo sale bien, aparece ese nombre y después tocás obtener formulario en blanco.",
    };
  }

  if (/(servidor|central|agriencuestas|proyecto 4|que servidor)/.test(t)) {
    return {
      action: "navigate",
      target: "ingenieria",
      reply:
        "Central está en agriencuestas punto mendoza punto gov punto ar. El QR entra al proyecto 4, Agricultura Mendoza. Yo solo leí el listado de formularios; no toqué el servidor.",
    };
  }

  if (inView && /(feno|fenologia)/.test(t)) {
    const fincas = formReply("Feno26-Fincas_y_Cuarteles");
    const visitas = formReply("Feno26-Visitas_Tecnicas");
    return {
      action: "navigate",
      target: "odk-forms",
      reply: `Hay dos de fenología 2026. Primero ${fincas} Después ${visitas} ¿Cuál te muestro?`,
    };
  }

  for (const hint of FORM_HINTS) {
    if (hint.test.test(t)) {
      return {
        action: "navigate",
        target: "odk-forms",
        reply: `${formReply(hint.id)} ¿Querés el flujo de carga o el tablero?`,
      };
    }
  }

  if (inView && /(olivo|olivares)/.test(t)) {
    return {
      action: "navigate",
      target: "odk-forms",
      reply: `${formReply("identif_olivos_encontrados_2026")} El otro es de verificación: ${formReply("identif_verificar_olivo_2026")}`,
    };
  }

  if (/(que formularios|cuales son los form|lista de form|que hay publicado|xforms)/.test(t)) {
    const names = ODK_OFFICIAL_FORMS.map((form) => form.name).join(", ");
    return {
      action: "navigate",
      target: "odk-forms",
      reply: `Hay cinco publicados: ${names}. Decime cuál y te lo explico como se usa en campo.`,
    };
  }

  if (
    inView &&
    /(que es esto|para que sirve|que hay aca|explicame|como funciona)/.test(t)
  ) {
    return {
      action: "describe",
      target: "ingenieria",
      reply:
        "Esta vista es para el equipo técnico. Arriba está el tablero simulado, después el QR real de Collect, el flujo de campo y los cinco formularios de Central. Pedime el recorrido o un formulario y te lo marco.",
    };
  }

  if (!inView && explicitOdk) {
    return {
      action: "navigate",
      target: "odk-collect",
      reply:
        "Eso es de ingeniería, no del trámite del productor. Te abro la vista técnica: QR de Collect, formularios reales y el tablero. ¿Arrancamos por el QR o por un recorrido?",
    };
  }

  return null;
}
