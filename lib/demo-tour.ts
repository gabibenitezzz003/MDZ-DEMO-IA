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
  const mapasOfficial = officialUrlFor("mapas-agricolas");
  const radarOfficial = officialUrlFor("radar");

  return [
    {
      id: "intro",
      chapter: "Bienvenida",
      spoken:
        "Buenas. Soy el asistente de la Dirección de Agricultura de Mendoza. En este recorrido te muestro un cultivo, las herramientas, las autoridades, los precios, el código Q R de O D K, y el RUT. En las pausas, tocá un botón para seguir.",
      action: "go_home",
      dwellMs: 350,
    },
    {
      id: "crop",
      chapter: `Cultivo · ${crop.title}`,
      spoken: `Empezamos por el productor. Te llevo a ${crop.title}: ${crop.why}. Acá están los informes y los datos productivos.`,
      action: "navigate",
      target: crop.id,
      payload: { openLink: false, click: true },
      dwellMs: 300,
      pause: {
        prompt:
          "Elegí con un botón: abrimos el sitio oficial de este cultivo, o seguimos a las herramientas.",
        timeoutMs: 0,
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
        "Listo. El recurso oficial quedó en otra pestaña. Yo me quedo acá para seguir el recorrido.",
      dwellMs: 350,
      skipUnlessChoice: "official",
    },
    {
      id: "mapas",
      chapter: "Herramientas",
      spoken:
        "Ahora, las herramientas. Te marco Mapas agrícolas, para mirar la provincia. Al lado tenés el visor, las estaciones y el radar.",
      action: "navigate",
      target: "mapas-agricolas",
      payload: { openLink: false, click: true, url: mapasOfficial },
      dwellMs: 300,
      pause: {
        prompt:
          "Elegí con un botón: te muestro el radar, o seguimos a autoridades.",
        timeoutMs: 0,
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
        "Te marco el radar meteorológico en la demo. El sitio oficial ya quedó abierto en la otra pestaña.",
      action: "navigate",
      target: "radar",
      payload: { openLink: false, click: true, url: radarOfficial },
      dwellMs: 350,
      skipUnlessChoice: "radar",
    },
    {
      id: "autoridades",
      chapter: "Institucional",
      spoken:
        "Pasamos a lo institucional. El director es el ingeniero agrónomo magíster Alfredo Draque. El correo es dirección de agricultura arroba mendoza punto gov punto a erre.",
      action: "navigate",
      target: "autoridades",
      payload: { openLink: false, click: true },
      dwellMs: 350,
    },
    {
      id: "precios",
      chapter: "Precios",
      spoken:
        "Ahora, el relevamiento de precios al consumidor. Hay informes semanales de frutas, verduras y huevos.",
      action: "navigate",
      target: "precios",
      payload: { openLink: false, click: true },
      dwellMs: 300,
    },
    {
      id: "odk",
      chapter: "ODK Collect",
      spoken:
        "Este es el código Q R de O D K Collect. No es un link web. En el celular abrís Agregar proyecto, y lo escaneás.",
      action: "navigate",
      target: "odk-collect",
      payload: { openLink: false, click: true },
      dwellMs: 300,
      pause: {
        prompt:
          "Elegí con un botón: seguimos al RUT, o te explico otra vez el código Q R.",
        timeoutMs: 0,
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
        "En O D K Collect: Agregar proyecto, escanear el código Q R, y queda el servidor listo. En esta demo hay un facsímil educativo.",
      action: "navigate",
      target: "odk-collect",
      payload: { openLink: false, click: true },
      dwellMs: 350,
      skipUnlessChoice: "odk-again",
    },
    {
      id: "rut",
      chapter: "RUT",
      spoken:
        "Cerramos con el RUT, el Registro Único de Tierras. Te abro el asistente de carga. Después podés dictarme cuit, mail y razón social.",
      action: "open_rut",
      payload: { openExternal: false },
      dwellMs: 350,
      pause: {
        prompt:
          "Elegí con un botón: arrancamos a cargar datos por voz, o abrimos el S I A oficial.",
        timeoutMs: 0,
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
        "El ingreso al S I A oficial quedó en otra pestaña. La declaración real se hace ahí. Esta demo solo simula el recorrido.",
      dwellMs: 350,
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
      choices.find((c) => c.id === "continue") ||
      choices.find((c) => c.id === "rut") ||
      choices.find((c) => c.id === "voice") ||
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
