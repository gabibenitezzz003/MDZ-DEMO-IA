import { officialUrlFor } from "@/lib/page-knowledge";
import type { AgentAction } from "@/lib/types";

export type TourChoice = {
  id: string;
  label: string;
  match: RegExp;
};

export type TourBeat = {
  id: string;
  chapter: string;
  spoken: string;
  action?: AgentAction;
  target?: string;
  payload?: Record<string, unknown>;
  dwellMs: number;
  pause?: {
    prompt: string;
    choices: TourChoice[];
    timeoutMs: number;
    defaultChoiceId: string;
  };
  skipUnlessChoice?: string;
};

const SIA = "https://sia.mendoza.gov.ar/account/login";

const CROP_A = {
  id: "ciruela",
  title: "ciruela",
  why: "una de las cadenas frutícolas más fuertes de Mendoza",
} as const;

const CROP_B = {
  id: "ajo",
  title: "ajo",
  why: "un cultivo hortícola clave en la provincia",
} as const;

export function pickTourCrop(seed = Date.now()): typeof CROP_A | typeof CROP_B {
  return seed % 2 === 0 ? CROP_A : CROP_B;
}

export function buildDemoTourBeats(crop = pickTourCrop()): TourBeat[] {
  const cropOfficial = officialUrlFor(crop.id);
  const mapasOfficial = officialUrlFor("mapas-agricolas");
  const radarOfficial = officialUrlFor("radar");

  return [
    {
      id: "intro",
      chapter: "Bienvenida",
      spoken:
        "Buenas. Soy el asistente de la Dirección de Agricultura de Mendoza. Te acompaño por cultivo, herramientas, autoridades, precios, el QR de ODK y el RUT. En algunos momentos te pregunto cómo seguir.",
      action: "go_home",
      dwellMs: 400,
    },
    {
      id: "crop",
      chapter: `Cultivo · ${crop.title}`,
      spoken: `Primero, el productor. Te llevo a ${crop.title}: ${crop.why}. Acá están informes y datos productivos.`,
      action: "navigate",
      target: crop.id,
      payload: { openLink: false, click: true },
      dwellMs: 300,
      pause: {
        prompt:
          "¿Abrimos el recurso oficial de este cultivo, o seguimos a las herramientas?",
        timeoutMs: 12000,
        defaultChoiceId: "continue",
        choices: [
          {
            id: "official",
            label: "Abrir oficial",
            match: /(oficial|abri|abr[ií]|si|dale|portal|seguimos con eso|eso)/i,
          },
          {
            id: "continue",
            label: "Seguir",
            match: /(segui|seguir|continua|mapas|herramient|no|despues)/i,
          },
        ],
      },
    },
    {
      id: "crop-official",
      chapter: "Recurso oficial",
      spoken:
        "Te abro el recurso oficial de este cultivo en otra pestaña. Yo me quedo acá; si el navegador bloqueó la ventana, tocá Abrir sitio oficial.",
      action: "open_external",
      target: cropOfficial,
      payload: {
        sectionId: crop.id,
        url: cropOfficial,
        forceTab: true,
        title: `Oficial · ${crop.title}`,
      },
      dwellMs: 700,
      skipUnlessChoice: "official",
    },
    {
      id: "mapas",
      chapter: "Herramientas",
      spoken:
        "Segundo: herramientas. Te marco Mapas agrícolas para mirar la provincia. Al lado tenés visor, estaciones y radar.",
      action: "navigate",
      target: "mapas-agricolas",
      payload: { openLink: false, click: true, url: mapasOfficial },
      dwellMs: 300,
      pause: {
        prompt: "¿Querés que te muestre el radar, o seguimos a autoridades?",
        timeoutMs: 10000,
        defaultChoiceId: "continue",
        choices: [
          {
            id: "radar",
            label: "Ver radar",
            match: /(radar|clima|tormenta|granizo|dale|seguimos)/i,
          },
          {
            id: "continue",
            label: "Seguir",
            match: /(segui|autoridad|director|no|despues)/i,
          },
        ],
      },
    },
    {
      id: "radar",
      chapter: "Radar",
      spoken:
        "Te marco el radar meteorológico y te abro el oficial en otra pestaña si hace falta.",
      action: "navigate",
      target: "radar",
      payload: { openLink: true, click: true, url: radarOfficial },
      dwellMs: 700,
      skipUnlessChoice: "radar",
    },
    {
      id: "autoridades",
      chapter: "Institucional",
      spoken:
        "Tercero: institucional. El director es el Ingeniero Agrónomo Magíster Alfredo Draque. Mail direcciondeagricultura arroba mendoza punto gov punto ar.",
      action: "navigate",
      target: "autoridades",
      payload: { openLink: false, click: true },
      dwellMs: 500,
    },
    {
      id: "precios",
      chapter: "Precios",
      spoken:
        "Cuarto: relevamiento de precios al consumidor. Informes semanales de frutas, verduras y huevos.",
      action: "navigate",
      target: "precios",
      payload: { openLink: false, click: true },
      dwellMs: 400,
    },
    {
      id: "odk",
      chapter: "ODK Collect",
      spoken:
        "Quinto: el código QR de ODK Collect. No es un link web: en el celular abrís Agregar proyecto y lo escaneás.",
      action: "navigate",
      target: "odk-collect",
      payload: { openLink: false, click: true },
      dwellMs: 400,
      pause: {
        prompt: "¿Seguimos al RUT, o querés que te explique otra vez el QR?",
        timeoutMs: 10000,
        defaultChoiceId: "rut",
        choices: [
          {
            id: "rut",
            label: "Ir al RUT",
            match: /(rut|registro|inscrip|dale|segui|seguimos)/i,
          },
          {
            id: "odk-again",
            label: "Explicar QR",
            match: /(qr|odk|explica|otra vez|repet)/i,
          },
        ],
      },
    },
    {
      id: "odk-again",
      chapter: "ODK · detalle",
      spoken:
        "En ODK Collect: Agregar proyecto, escanear el código QR, y queda el servidor listo. En la demo hay un facsímil educativo.",
      action: "navigate",
      target: "odk-collect",
      payload: { openLink: false, click: true },
      dwellMs: 500,
      skipUnlessChoice: "odk-again",
    },
    {
      id: "rut",
      chapter: "RUT",
      spoken:
        "Cierre: el RUT, Registro Único de Tierras. Te abro el wizard demo. Podés dictarme CUIT, mail y razón social.",
      action: "open_rut",
      payload: { openExternal: false },
      dwellMs: 500,
      pause: {
        prompt: "¿Arrancamos a cargar datos por voz, o abrimos el SIA oficial?",
        timeoutMs: 10000,
        defaultChoiceId: "voice",
        choices: [
          {
            id: "voice",
            label: "Cargar por voz",
            match: /(voz|cargar|dict|cuit|mail|dale|segui|seguimos)/i,
          },
          {
            id: "sia",
            label: "Abrir SIA",
            match: /(sia|oficial|login|web)/i,
          },
        ],
      },
    },
    {
      id: "rut-sia",
      chapter: "SIA oficial",
      spoken:
        "Te abro el login del SIA oficial. La declaración real se hace ahí; esta demo solo simula el recorrido.",
      action: "open_external",
      target: SIA,
      payload: {
        sectionId: "rut",
        url: SIA,
        forceTab: true,
        title: "SIA · RUT oficial",
      },
      dwellMs: 700,
      skipUnlessChoice: "sia",
    },
  ];
}

export function matchTourChoice(
  text: string,
  choices: TourChoice[]
): string | null {
  const t = text.trim();
  if (!t) return null;
  if (/(dale|seguimos|seguimos con eso|eso|continua|ok|va|de una)/i.test(t)) {
    const preferred =
      choices.find((c) => c.id === "official") ||
      choices.find((c) => c.id === "voice") ||
      choices.find((c) => c.id === "rut") ||
      choices[0];
    if (preferred) return preferred.id;
  }
  for (const c of choices) {
    if (c.match.test(t)) return c.id;
  }
  return null;
}

export function wantsGuidedTour(raw: string) {
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /(demo guiada|recorrido|tour|demo 3|tres minutos|viaje del productor)/.test(
    t
  );
}

export function wantsStopTour(raw: string) {
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /(parar demo|corta(r)? (la )?demo|frena(r)? (la )?demo|stop demo|salir del recorrido)/.test(
    t
  );
}
