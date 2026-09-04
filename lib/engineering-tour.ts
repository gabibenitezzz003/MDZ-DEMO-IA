import type { TourBeat } from "@/lib/demo-tour";
import { ODK_OFFICIAL_FORMS } from "@/lib/odk-engineering";

export function buildEngineeringTourBeats(): TourBeat[] {
  const names = ODK_OFFICIAL_FORMS.map((form) => form.name).join(", ");
  return [
    {
      id: "eng-intro",
      chapter: "Ingeniería",
      spoken:
        "Buenas. Esta es la vista de ingeniería. No es el RUT ni la landing del productor. Acá te muestro Central, el código Q R de Collect, el flujo de campo y los formularios publicados.",
      action: "navigate",
      target: "ingenieria",
      payload: { openLink: false, click: true },
      dwellMs: 280,
    },
    {
      id: "eng-whatsapp",
      chapter: "WhatsApp de campo",
      spoken:
        "Acá el ingeniero no rellena casilleros. Habla por WhatsApp como en la finca: encontré un olivo, hice una visita. El sistema arma una ficha simulada y la bandeja la muestra. No usamos los formularios reales de Central.",
      action: "navigate",
      target: "odk-whatsapp",
      payload: { openLink: false, click: true },
      dwellMs: 340,
    },
    {
      id: "eng-board",
      chapter: "Tablero",
      spoken:
        "Este tablero está simulado, estilo Power BI, para mostrar el pulso: visitas, fincas, olivos y equipos. No son envíos en vivo de Central. Sirve para explicar el tablero, no para operar el servidor.",
      action: "navigate",
      target: "odk-tablero",
      payload: { openLink: false, click: true },
      dwellMs: 320,
      pause: {
        prompt: "¿Seguimos al código Q R, o te quedás un segundo en el tablero?",
        timeoutMs: 0,
        defaultChoiceId: "qr",
        choices: [
          {
            id: "qr",
            label: "Ver el QR",
            match: /(qr|codigo|collect|segui|dale|si)/i,
          },
          {
            id: "board",
            label: "Quedarme acá",
            match: /(tablero|aca|aqui|numeros|kpi)/i,
          },
        ],
      },
    },
    {
      id: "eng-qr",
      chapter: "QR Collect",
      spoken:
        "Este es el Q R real de app user. Collect lo descomprime y crea el proyecto Agricultura Mendoza, proyecto 4, en agriencuestas. No lo escanees con la cámara ni con WhatsApp.",
      action: "navigate",
      target: "odk-collect",
      payload: { openLink: false, click: true },
      dwellMs: 320,
      skipUnlessChoice: "qr",
    },
    {
      id: "eng-flow",
      chapter: "Flujo",
      spoken:
        "El flujo de campo es: instalar Collect, agregar proyecto, escanear, obtener formularios en blanco, completar y enviar por wifi o datos. Autosend va por wifi y celular.",
      action: "navigate",
      target: "odk-flujo",
      payload: { openLink: false, click: true },
      dwellMs: 300,
    },
    {
      id: "eng-forms",
      chapter: "Formularios",
      spoken: `Hay cinco XForms publicados: ${names}. Fenología 2026, olivo y certificación de equipos. Pedime uno y te lo detallo.`,
      action: "navigate",
      target: "odk-forms",
      payload: { openLink: false, click: true },
      dwellMs: 360,
      pause: {
        prompt: "¿Cerramos acá o seguís con el micrófono para preguntar un formulario?",
        timeoutMs: 0,
        defaultChoiceId: "voice",
        choices: [
          {
            id: "voice",
            label: "Preguntar con voz",
            match: /(voz|micro|pregunta|formulario|segui|dale|si)/i,
          },
          {
            id: "end",
            label: "Cerrar recorrido",
            match: /(cerrar|listo|chau|no|fin)/i,
          },
        ],
      },
    },
  ];
}
