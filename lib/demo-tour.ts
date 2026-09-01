import type { AgentAction } from "@/lib/types";

/** Professional interactive ~3 min demo — producer journey + choice pauses. */

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
  /** After speech, wait for user (voice/button) or timeout. */
  pause?: {
    prompt: string;
    choices: TourChoice[];
    timeoutMs: number;
    defaultChoiceId: string;
  };
  /** Only play this beat if the previous pause chose this id. */
  skipUnlessChoice?: string;
};

const OFFICIAL =
  "https://sitios.mendoza.gob.ar/produccion/direccion-de-agricultura/";
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
  return [
    {
      id: "intro",
      chapter: "Bienvenida",
      spoken:
        "Buenas. Soy el asistente de la Dirección de Agricultura de Mendoza. Te voy a acompañar como si estuviéramos juntos frente a la pantalla: cultivo, herramientas, autoridades, precios, el QR de ODK y el RUT. En algunos momentos te pregunto cómo seguir. Arrancamos.",
      action: "go_home",
      dwellMs: 900,
    },
    {
      id: "crop",
      chapter: `Cultivo · ${crop.title}`,
      spoken: `Primero, el productor. Te llevo a ${crop.title}: ${crop.why}. Miro la ficha… acá están informes y datos productivos.`,
      action: "navigate",
      target: crop.id,
      payload: { openLink: false, click: true },
      dwellMs: 800,
      pause: {
        prompt:
          "¿Abrimos el portal oficial en otra pestaña, o seguimos a las herramientas?",
        timeoutMs: 12000,
        defaultChoiceId: "continue",
        choices: [
          {
            id: "official",
            label: "Abrir oficial",
            match: /(oficial|abri|abr[ií]|si|dale|portal)/i,
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
      chapter: "Portal oficial",
      spoken:
        "Te abro el sitio oficial de la Dirección en otra pestaña. Yo me quedo acá; si el navegador bloqueó la ventana, tocá Abrir sitio oficial en el aviso.",
      action: "open_external",
      target: OFFICIAL,
      payload: {
        sectionId: crop.id,
        url: OFFICIAL,
        forceTab: true,
        title: `Portal oficial · ${crop.title}`,
      },
      dwellMs: 1400,
      skipUnlessChoice: "official",
    },
    {
      id: "mapas",
      chapter: "Herramientas",
      spoken:
        "Segundo: herramientas para decidir. Te marco Mapas agrícolas. Sirven para mirar la provincia y planificar. Al lado tenés visor, estaciones y radar.",
      action: "navigate",
      target: "mapas-agricolas",
      payload: { openLink: false, click: true },
      dwellMs: 900,
      pause: {
        prompt: "¿Querés que te muestre el radar, o seguimos a autoridades?",
        timeoutMs: 10000,
        defaultChoiceId: "continue",
        choices: [
          {
            id: "radar",
            label: "Ver radar",
            match: /(radar|clima|tormenta|granizo)/i,
          },
          {
            id: "continue",
            label: "Seguir",
            match: /(segui|seguir|continua|autoridad|director|dale)/i,
          },
        ],
      },
    },
    {
      id: "radar-detour",
      chapter: "Radar",
      spoken:
        "Te marco el radar meteorológico. En Mendoza se usa mucho para tormentas y granizo. Ahora volvemos al hilo del recorrido.",
      action: "navigate",
      target: "radar",
      payload: { openLink: false, click: true },
      dwellMs: 1200,
      skipUnlessChoice: "radar",
    },
    {
      id: "autoridades",
      chapter: "Institucional",
      spoken:
        "Tercero, la cara institucional. El director es el ingeniero Alfredo Draque. Contacto: direcciondeagricultura arroba mendoza punto gov punto ar, Casa de Gobierno, sexto piso.",
      action: "navigate",
      target: "autoridades",
      payload: { openLink: false, click: true },
      dwellMs: 1600,
    },
    {
      id: "precios",
      chapter: "Precios",
      spoken:
        "Cuarto: relevamiento de precios al consumidor — hortalizas, frutas y huevos — con informes semanales.",
      action: "navigate",
      target: "precios",
      payload: { openLink: false, click: true },
      dwellMs: 1200,
    },
    {
      id: "odk",
      chapter: "ODK · QR",
      spoken:
        "El código QR no es un link web: es para ODK Collect en el celular. Se instala la app, se toca Agregar proyecto, y se escanea. Adentro lleva la URL del servidor y el proyecto. Acá ves un facsímil educativo embebido; en el oficial a veces el QR falla o no está.",
      action: "navigate",
      target: "odk-collect",
      payload: { openLink: false, click: true },
      dwellMs: 1000,
      pause: {
        prompt: "¿Seguimos al RUT, el trámite más pedido?",
        timeoutMs: 10000,
        defaultChoiceId: "continue",
        choices: [
          {
            id: "continue",
            label: "Ir al RUT",
            match: /(rut|si|dale|segui|seguir|tramite)/i,
          },
          {
            id: "stay",
            label: "Quedarme acá",
            match: /(qued|odk|qr|despues|no)/i,
          },
        ],
      },
    },
    {
      id: "rut",
      chapter: "RUT",
      spoken:
        "Te abro el wizard del RUT. Podés dictarme CUIT, mail, nombre, teléfono, finca… yo los entiendo y te pregunto si los cargo. También te dejo el SIA oficial en otra pestaña.",
      action: "open_rut",
      payload: { openExternal: true },
      dwellMs: 1800,
      skipUnlessChoice: "continue",
    },
    {
      id: "close",
      chapter: "Cierre",
      spoken:
        "Listo el recorrido. Podés volver a un cultivo, preguntarme por el QR, o dictarme datos del RUT. Decime cómo seguimos.",
      action: "go_home",
      dwellMs: 800,
    },
  ];
}

export const DEMO_TOUR_BEATS = buildDemoTourBeats(pickTourCrop(1));

export function wantsGuidedTour(raw: string) {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /(demo guiada|recorrido (de )?demo|empez[aá] la demo|tour guiado|mostrame la demo|hac[eé] la demo|^demo 3|^demo tres|recorrido completo)/.test(
    text
  );
}

export function wantsStopTour(raw: string) {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /(parar demo|cort[aá] la demo|stop demo|frena(r)? la demo)/.test(text);
}

export function matchTourChoice(
  raw: string,
  choices: TourChoice[]
): string | null {
  const text = raw.trim();
  if (!text) return null;
  for (const c of choices) {
    if (c.match.test(text)) return c.id;
  }
  return null;
}

export { OFFICIAL, SIA };
