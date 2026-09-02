import catalog from "@/content/site-catalog.json";

export type KnowledgeHit = {
  id: string;
  title: string;
  group: string;
  summary?: string;
  externalUrl?: string;
  score: number;
  kind: "section" | "fact" | "normativa";
  spoken: string;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EXTRA_ALIASES: Record<string, string[]> = {
  ajo: ["ajo", "ajos", "parte de ajo", "seccion de ajo", "del ajo"],
  tomate: ["tomate", "tomates", "tomate industria"],
  ciruela: ["ciruela", "ciruelas", "parte de ciruela"],
  durazno: ["durazno", "duraznos", "durazno industria"],
  cereza: ["cereza", "cerezas"],
  vid: ["vid", "uva", "uvas", "viticultura", "vino"],
  fenologia: ["fenologia", "calendario de cultivo", "estadios"],
  "cinturon-verde": ["cinturon verde", "cinturon"],
  agrometeorologia: [
    "agrometeorologia",
    "agro meteorologia",
    "agrometeo",
    "clima",
    "meteorologia",
    "meteo",
  ],
  "mapas-agricolas": [
    "mapa",
    "mapas",
    "mapas agricolas",
    "mapas de cultivo",
    "mapa de cultivos",
    "mapas de cultivos",
    "cartografia",
  ],
  "cultivos-fruticolas": [
    "cultivos fruticolas",
    "fruticolas",
    "cultivos",
    "parte de cultivos",
  ],
  "visor-agricola": ["visor", "visor agricola", "gis"],
  estaciones: ["estaciones", "estacion meteorologica", "red de estaciones"],
  radar: ["radar", "radar meteorologico", "tormenta", "granizo"],
  "eventos-meteo": ["eventos meteorologicos", "analisis de eventos"],
  "monitoreo-heladas": ["helada", "heladas", "hielo", "frost"],
  "monitoreo-catas": ["cata", "catas"],
  precios: ["precio", "precios", "mercado", "relevamiento de precios"],
  "odk-collect": [
    "odk",
    "qr",
    "codigo qr",
    "collect",
    "agregar proyecto",
    "formulario celular",
    "formulario de campo",
    "relevamiento en campo",
    "ingenieria",
    "vista ingenieria",
  ],
  ingenieria: ["ingenieria", "odk central", "agriencuestas"],
  "odk-tablero": ["tablero odk", "power bi"],
  "odk-forms": ["formularios odk", "xform"],
  "manejo-hidrico": ["hidrico", "agua", "riego", "manejo hidrico"],
  "economia-regional": ["economia", "economia regional"],
  fruticultura: ["fruticultura", "fruta", "frutales"],
  horticultura: ["horticultura", "hortalizas"],
  "frutos-secos": ["frutos secos", "nuez", "almendra"],
  herramientas: ["herramientas", "herramientas digitales", "tableros"],
  capacitaciones: ["capacitaciones", "cursos", "formacion"],
  "capacitacion-bpa": ["capacitacion bpa", "buenas practicas", "bpa"],
  "encargado-finca": ["encargado de finca", "encargado"],
  autoridades: ["autoridades", "director", "draque", "alfredo"],
  mision: ["mision"],
  vision: ["vision"],
  funcion: ["funcion", "funciones"],
  normativa: ["normativa", "leyes", "decretos"],
  tramites: ["tramites", "tramite"],
  rut: ["rut", "registro unico", "declaracion jurada", "sia", "root", "ruth", "rod", "rued"],
  "bpa-herramienta": ["herramienta bpa", "buenas practicas agricolas"],
  "cultivos-horticolas": ["cultivos horticolas", "horticolas"],
  "publicaciones-ia": ["publicaciones", "informes oficiales"],
};

function keywordMatches(text: string, keyword: string): number {
  const k = normalize(keyword);
  if (!k) return 0;
  if (k.length <= 3) {
    return new RegExp(`(?:^|\\s)${k}(?:\\s|$)`).test(text) ? k.length + 8 : 0;
  }
  if (text.includes(k)) return k.length;
  // soft match for STT splits: "agro meteorologia"
  const compact = k.replace(/\s+/g, "");
  if (compact.length > 5 && text.replace(/\s+/g, "").includes(compact)) {
    return compact.length - 1;
  }
  return 0;
}

export function findBestSections(raw: string, limit = 5): KnowledgeHit[] {
  const text = normalize(raw);
  const hits: KnowledgeHit[] = [];

  for (const section of catalog.sections) {
    const aliases = EXTRA_ALIASES[section.id] ?? [];
    const keywords = [
      ...aliases,
      ...section.keywords,
      section.title,
      section.id.replace(/-/g, " "),
      "summary" in section && section.summary ? section.summary : "",
    ];
    let score = 0;
    for (const kw of keywords) {
      score = Math.max(score, keywordMatches(text, String(kw)));
    }
    if (score <= 0) continue;
    const summary =
      "summary" in section && section.summary ? section.summary : undefined;
    const externalUrl =
      "externalUrl" in section && section.externalUrl
        ? section.externalUrl
        : undefined;
    hits.push({
      id: section.id,
      title: section.title,
      group: section.group,
      summary,
      externalUrl,
      score,
      kind: "section",
      spoken: summary
        ? `Dale, te llevo a ${section.title}... ${summary}`
        : `Dale, te llevo a ${section.title}.`,
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function answerFact(raw: string): KnowledgeHit | null {
  const text = normalize(raw);
  const org = catalog.org;
  const director = catalog.director;

  if (/director|quien dirige|alfredo|draque/.test(text)) {
    return {
      id: "autoridades",
      title: "Autoridades",
      group: "institucional",
      score: 100,
      kind: "fact",
      spoken: `El director es ${director.name}, ${director.title}. ${director.bio} Te llevo a autoridades.`,
    };
  }

  if (/mail|correo|email|escribir|contact/.test(text)) {
    return {
      id: "autoridades",
      title: "Contacto",
      group: "institucional",
      score: 100,
      kind: "fact",
      spoken: `El mail de la Dirección es ${org.email.replace(
        "@",
        " arroba "
      ).replace(/\./g, " punto ")}. Están en ${org.address}.`,
    };
  }

  if (/donde queda|direccion|ubicacion|casa de gobierno|como llegar/.test(text)) {
    return {
      id: "autoridades",
      title: "Ubicación",
      group: "institucional",
      score: 100,
      kind: "fact",
      spoken: `La Dirección queda en ${org.address}. El pie de página marca ${org.footerAddress}.`,
    };
  }

  if (/que es el rut|para que sirve el rut|registro unico/.test(text)) {
    return {
      id: "rut",
      title: "RUT",
      group: "tramites",
      score: 100,
      kind: "fact",
      externalUrl: "https://sia.mendoza.gov.ar/account/login",
      spoken:
        "El RUT es el Registro Único de Tierras. En la provincia se gestiona por el S I A. En esta demo te abro el wizard y te guío paso a paso. Si querés, también te abro el SIA oficial.",
    };
  }

  if (/mision/.test(text) && !/capacitacion/.test(text)) {
    return {
      id: "mision",
      title: "Misión",
      group: "institucional",
      score: 100,
      kind: "fact",
      spoken: `La misión es: ${catalog.institucional.mision}`,
    };
  }

  if (/vision/.test(text)) {
    return {
      id: "vision",
      title: "Visión",
      group: "institucional",
      score: 100,
      kind: "fact",
      spoken: `La visión es: ${catalog.institucional.vision}`,
    };
  }

  if (/normativa|ley del rut|decreto/.test(text)) {
    const rutLaws = catalog.institucional.normativa.find((n) => n.grupo === "RUT");
    return {
      id: "normativa",
      title: "Normativa",
      group: "institucional",
      score: 100,
      kind: "normativa",
      spoken: rutLaws
        ? `En normativa del RUT tenés ${rutLaws.items.join(
            ", "
          )}. Te llevo a la sección de normativa.`
        : "Te llevo a la normativa de la Dirección.",
    };
  }

  if (/sitio oficial|pagina oficial|portal oficial/.test(text)) {
    return {
      id: "tramites",
      title: "Sitio oficial",
      group: "institucional",
      score: 100,
      kind: "fact",
      externalUrl: catalog.sourceUrl,
      spoken:
        "Te abro el sitio oficial de la Dirección de Agricultura de Mendoza.",
    };
  }

  return null;
}

export function wantsOpenLink(raw: string) {
  const text = normalize(raw);
  return /(abri|abrir|abrime|abre|link|enlace|oficial|sia|nueva pestana|otra pestana)/.test(
    text
  );
}

export function wantsScroll(raw: string): "up" | "down" | "top" | "bottom" | null {
  const text = normalize(raw);
  // "llevame a abajo" is almost always STT for ajo, not scroll
  if (
    /(llevame|llevame|mostrame|andate|anda|ir a)\b/.test(text) &&
    !/mas abajo|para abajo|un poco|de todo/.test(text)
  ) {
    return null;
  }
  if (/arriba de todo|al inicio de la pagina|principio de la pagina/.test(text)) {
    return "top";
  }
  if (/al final|abajo de todo|al fondo/.test(text)) return "bottom";
  if (/subi|para arriba|mas arriba|scroll up/.test(text)) return "up";
  if (
    /baja un poco|para abajo|mas abajo|scrollea|scroll down|baja la pagina/.test(
      text
    )
  ) {
    return "down";
  }
  return null;
}

export function officialUrlFor(sectionId?: string) {
  const section = catalog.sections.find((s) => s.id === sectionId);
  if (section && "externalUrl" in section && section.externalUrl) {
    return section.externalUrl;
  }
  if (sectionId === "rut") return "https://sia.mendoza.gov.ar/account/login";
  return catalog.sourceUrl;
}

export { catalog };
