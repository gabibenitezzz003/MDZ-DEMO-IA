import { catalog, getSection } from "@/lib/section-ids";

export interface SectionGuide {
  sectionId: string;
  title: string;
  spoken: string;
  related: Array<{ id: string; title: string }>;
}

const RELATED: Record<string, string[]> = {
  ciruela: ["durazno", "cereza", "fenologia", "fruticultura"],
  durazno: ["ciruela", "tomate", "fenologia"],
  cereza: ["ciruela", "durazno", "fenologia"],
  vid: ["fenologia", "monitoreo-heladas", "agrometeorologia"],
  fenologia: ["ciruela", "durazno", "vid", "ajo"],
  ajo: ["tomate", "cinturon-verde", "horticultura"],
  tomate: ["ajo", "durazno", "horticultura"],
  "cinturon-verde": ["horticultura", "precios", "ajo"],
  rut: ["tramites", "odk-collect", "normativa"],
  tramites: ["rut", "odk-collect", "normativa"],
  "odk-collect": ["rut", "precios", "capacitaciones"],
  "monitoreo-heladas": ["agrometeorologia", "estaciones", "radar"],
  agrometeorologia: ["estaciones", "radar", "eventos-meteo"],
  precios: ["horticultura", "fruticultura", "cinturon-verde"],
  "capacitacion-bpa": ["encargado-finca", "bpa-herramienta", "capacitaciones"],
  "encargado-finca": ["capacitacion-bpa", "capacitaciones"],
};

const SPOKEN: Record<string, string> = {
  autoridades:
    "Acá te muestro autoridades. El director es el ingeniero agrónomo Alfredo Draque, magíster en vitivinicultura, con más de veinte años en el sector. El mail de contacto es direcciondeagricultura arroba mendoza punto gov punto ar, en Casa de Gobierno, sexto piso.",
  mision:
    "Esta es la misión: impulsar el desarrollo agrícola de Mendoza con asistencia técnica, capacitación e innovación, fortaleciendo a los productores y cuidando la sostenibilidad.",
  vision:
    "La visión es ser referente en una agricultura innovadora, sostenible y competitiva, que potencie las zonas rurales y el bienestar de la comunidad.",
  funcion:
    "Acá están las funciones: políticas públicas, asistencia técnica, innovación, sanidad vegetal, estadísticas productivas, desarrollo rural y articulación con municipios y el sector privado.",
  normativa:
    "Esta es la normativa. Entre otras, el RUT está en la ley cuatro mil cuatrocientos treinta y ocho y el decreto doscientos veintinueve. También hay normas de BPA, orgánicos, forestales y vitivinicultura.",
  tramites:
    "Esta es la zona de trámites... El que más piden es el RUT, el Registro Único de Tierras, que en la provincia se hace por el S I A. Si querés te abro el wizard y lo vemos paso a paso.",
  rut: "El RUT es el Registro Único de Tierras. En el oficial se hace por el S I A. Acá te abro el wizard de la demo y te voy guiando: cuenta, mail, la declaración y los papeles. Si me pasás tus datos por el chat, te pregunto si los cargo yo o los cargás vos.",
  "publicaciones-ia":
    "Acá están las publicaciones oficiales. Desde este bloque podés ir a economía regional, manejo hídrico, fruticultura, horticultura o frutos secos.",
  "economia-regional":
    "Esta es economía regional: informes y análisis agropecuarios de Mendoza. Si querés después te llevo a un cultivo puntual o a precios.",
  "manejo-hidrico":
    "Acá está manejo hídrico: información sobre el uso del agua en los sistemas productivos. En Mendoza esto es clave por el riego.",
  fruticultura:
    "Esta es fruticultura. Desde acá se despliegan los cultivos frutícolas: durazno industria, ciruela, cereza, vid y fenología.",
  horticultura:
    "Esta es horticultura. Los bloques más pedidos son ajo, tomate industria y cinturón verde.",
  "frutos-secos":
    "Acá está frutos secos: nuez, almendra y el resto de la cadena en Mendoza.",
  "cultivos-fruticolas":
    "Esta es la zona de cultivos frutícolas. Decime si querés ciruela, durazno, cereza, vid o el calendario fenológico y te llevo.",
  durazno:
    "Acá está durazno industria. En el portal oficial hay informes, tableros e índices tecnológicos. Si te sirve, después te muestro ciruela o tomate industria, que también son cadenas fuertes.",
  ciruela:
    "Ciruela: acá tiene el bloque del cultivo. En el oficial están informes, pronóstico de cosecha y reportes. ¿Quiere el link oficial o seguimos por durazno?",
  cereza:
    "Acá está cereza: información productiva y reportes del cultivo. Puedo llevarte también a ciruela o al calendario fenológico.",
  vid: "Esta es vid. Hay información de viticultura y se cruza mucho con heladas, agrometeorología y fenología. Decime si querés ir a alguna de esas.",
  fenologia:
    "Esta es fenología: los estadios del cultivo a lo largo del año. Sirve para ciruela, durazno, vid y también para hortalizas.",
  "cultivos-horticolas":
    "Esta es la zona hortícola. Los más pedidos son ajo, tomate industria y cinturón verde.",
  ajo: "Ajo: acá están informes y datos productivos. ¿Abro la ficha oficial o prefiere tomate industria / precios?",
  tomate:
    "Acá está tomate industria. En el portal hay informes y datos de esa cadena. También te puedo mostrar durazno industria, que se parece en la lógica de procesamiento.",
  "cinturon-verde":
    "Este es el cinturón verde mendocino: la horticultura periurbana. Si te interesa el mercado, después te llevo al relevamiento de precios.",
  "monitoreo-heladas":
    "Acá está el monitoreo de heladas. En Mendoza es de las herramientas más pedidas. Puedo seguirte a estaciones, radar o agrometeorología.",
  "monitoreo-catas":
    "Este es monitoreo de catas: control sugerido y la legislación asociada.",
  herramientas:
    "Estas son las herramientas digitales: agrometeorología, mapas, estaciones, visor, radar y análisis de eventos. Decime cuál querés ver.",
  agrometeorologia:
    "Esto es agrometeorología: clima aplicado a la producción. Desde aquí puede pasar a estaciones o al radar si lo necesita.",
  "mapas-agricolas":
    "Estos son los mapas agrícolas de Mendoza... El visor está al lado, por si querés verlo en el mapa.",
  estaciones:
    "Esta es la red de estaciones meteorológicas agrícolas. Sirve para seguir el clima finca por finca, a nivel provincial.",
  "visor-agricola":
    "Este es el visor agrícola: el mapa geoespacial. Si querés después te muestro mapas o estaciones.",
  radar:
    "Acá está el radar meteorológico. En Mendoza se usa mucho para tormentas y granizo.",
  "eventos-meteo":
    "Este bloque analiza eventos meteorológicos relevantes para la producción: heladas, granizo, lluvias fuertes.",
  "bpa-herramienta":
    "Acá están las herramientas de Buenas Prácticas Agrícolas. Si te interesa formarte, también hay una capacitación de BPA.",
  precios:
    "Este es el relevamiento de precios: hortalizas, frutas y huevos al consumidor en Mendoza, con informes semanales.",
  "odk-collect":
    "Este es el bloque de ODK Collect. El código QR no es un link de internet: configura la app en el celular. Se instala ODK Collect, se toca Agregar proyecto, y se escanea. El QR lleva la URL del servidor y el proyecto. Acá mostramos un facsímil educativo embebido; en el oficial a veces el QR falla o no está. El uso es ese.",
  capacitaciones:
    "Esta es la zona de capacitaciones. Hay BPA y Encargado de Finca. La inscripción en el oficial se hace por mail a direcciondeagricultura arroba mendoza punto gov punto ar.",
  "capacitacion-bpa":
    "Esta es la capacitación de Buenas Prácticas Agrícolas: producción más sostenible y responsable. En el oficial te anotas por mail a la Dirección.",
  "encargado-finca":
    "Este es el programa de Encargado de Finca: formación para quienes llevan cultivos frutícolas, hortícolas y vitícolas. Misma vía de inscripción por mail.",
};

function relatedFor(id: string) {
  const ids = RELATED[id] ?? [];
  return ids
    .map((relatedId) => {
      const section = getSection(relatedId);
      return section ? { id: section.id, title: section.title } : null;
    })
    .filter((item): item is { id: string; title: string } => item !== null);
}

export function buildSectionGuide(sectionId: string): SectionGuide | null {
  const section = getSection(sectionId);
  if (!section) return null;

  const related = relatedFor(sectionId);
  const base =
    SPOKEN[sectionId] ??
    `Te traje a ${section.title}. ${"summary" in section && section.summary ? section.summary : "Es una sección del portal de la Dirección de Agricultura."}`;

  const nextHint = related[0]
    ? ` ¿Tenés alguna duda, o seguimos por ${related[0].title}?`
    : " ¿Tenés alguna duda, o querés que avance a otra sección?";

  const spoken = `${base}${nextHint}`;

  return {
    sectionId,
    title: section.title,
    spoken,
    related,
  };
}

export function listSectionIds() {
  return catalog.sections.map((s) => s.id);
}
