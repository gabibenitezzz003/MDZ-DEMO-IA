/** Catálogo de referencia (nombres leídos del formList de Central). La carga conversacional usa fichas simuladas. */
export const ODK_ENGINEERING_SERVER_HOST = "agriencuestas.mendoza.gov.ar";
export const ODK_ENGINEERING_PROJECT_ID = 4;
export const ODK_ENGINEERING_PROJECT_NAME = "Agricultura Mendoza";

export const ODK_ENGINEERING_SECTIONS = [
  "ingenieria",
  "odk-collect",
  "odk-forms",
  "odk-flujo",
  "odk-tablero",
  "odk-whatsapp",
] as const;

export type OdkEngineeringSection = (typeof ODK_ENGINEERING_SECTIONS)[number];

export function isEngineeringSection(id: string): boolean {
  return (ODK_ENGINEERING_SECTIONS as readonly string[]).includes(id);
}

export const ODK_OFFICIAL_FORMS = [
  {
    id: "CertificacionEquiposTeledeteccion",
    name: "Certificación de Equipos",
    version: "1.6",
    area: "Teledetección",
    purpose:
      "Valida que el celular del relevador tenga GPS, cámara con coordenadas y brújula antes de salir a campo.",
    steps: [
      "Paso 1/3: prueba de GPS a cielo abierto, precisión menor a 5 m.",
      "Paso 2/3: foto con coordenadas (hace falta permiso de ubicación en la cámara).",
      "Paso 3/3: brújula: apuntar hacia la foto y registrar orientación.",
    ],
  },
  {
    id: "Feno26-Fincas_y_Cuarteles",
    name: "Fenología 2026: Fincas y Cuarteles",
    version: "2.3",
    area: "Fenología",
    purpose:
      "Carga la finca y los cuarteles de la campaña 2026: cultivo, orientación y departamento.",
    crops: [
      "Duraznero industria",
      "Duraznero en fresco",
      "Ciruela industria",
      "Ciruelo japonés",
      "Almendro",
      "Nogal",
      "Cerezo",
      "Olivo",
      "Vid",
      "Pistacho",
    ],
  },
  {
    id: "Feno26-Visitas_Tecnicas",
    name: "Fenología 2026: Visitas Técnicas",
    version: "2.3",
    area: "Fenología",
    purpose:
      "Registra cada visita técnica a un cuartel ya cargado: cultivo, variedad y observación de estadio.",
    crops: [
      "Almendro",
      "Cerezo",
      "Ciruela industria",
      "Ciruelo japonés",
      "Duraznero en fresco",
      "Duraznero industria",
      "Nogal",
      "Olivo",
      "Pistacho",
      "Vid",
    ],
  },
  {
    id: "identif_olivos_encontrados_2026",
    name: "Olivo Encontrado 2026",
    version: "0.8e",
    area: "Olivo",
    purpose:
      "Alta de un olivar detectado en campo: estado productivo, consociación y cultivos vecinos.",
    states: ["Productivo", "Abandonado", "Puro", "Consociado", "Trinchera"],
  },
  {
    id: "identif_verificar_olivo_2026",
    name: "Olivo a Verificar 2026",
    version: "0.8f",
    area: "Olivo",
    purpose:
      "Verificación de un olivar ya señalado: confirma o corrige estado, consociación e inculto.",
    states: ["Productivo", "Abandonado", "Inculto", "Puro", "Consociado", "Trinchera"],
  },
] as const;

export const ODK_SIMULATED_CAMPO_FORMS = [
  {
    id: "demo-olivo",
    name: "Ficha demo · Olivo en campo",
    version: "sim-1",
    area: "Olivo",
    purpose: "Alta conversacional simulada: estado, consociación y cultivos vecinos.",
  },
  {
    id: "demo-visita",
    name: "Ficha demo · Visita técnica",
    version: "sim-1",
    area: "Fenología",
    purpose: "Visita simulada: cultivo, variedad, estadio fenológico.",
  },
  {
    id: "demo-finca",
    name: "Ficha demo · Finca y cuartel",
    version: "sim-1",
    area: "Fenología",
    purpose: "Alta simulada de finca, cuartel, cultivo y orientación.",
  },
] as const;

/** Tablero simulado para la demo. No son envíos vivos de Central. */
export const ODK_SIMULATED_BOARD = {
  note: "Simulación de tablero para la demo de ingeniería. No consulta envíos en vivo.",
  period: "Campaña 2026 · recorte demo",
  kpis: [
    { id: "forms", label: "Formularios publicados", value: 5, unit: "XForms", hint: "Proyecto 4" },
    { id: "fincas", label: "Fincas / cuarteles", value: 31, unit: "registros", hint: "Feno26" },
    { id: "visitas", label: "Visitas técnicas", value: 84, unit: "visitas", hint: "Feno26" },
    { id: "olivos", label: "Olivos encontrados", value: 19, unit: "sitios", hint: "2026" },
    { id: "verificar", label: "Olivos a verificar", value: 12, unit: "sitios", hint: "2026" },
    { id: "equipos", label: "Equipos certificados", value: 7, unit: "celulares", hint: "GPS + brújula" },
  ],
  weeklySends: [
    { day: "Lun", value: 4 },
    { day: "Mar", value: 9 },
    { day: "Mié", value: 6 },
    { day: "Jue", value: 11 },
    { day: "Vie", value: 8 },
    { day: "Sáb", value: 14 },
    { day: "Dom", value: 10 },
  ],
  byArea: [
    { area: "Fenología", value: 115 },
    { area: "Olivo", value: 31 },
    { area: "Teledetección", value: 7 },
  ],
} as const;
