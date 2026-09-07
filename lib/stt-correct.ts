/** Fix frequent Chrome STT mistakes in Río de la Plata Spanish. */

import { findBestSections } from "@/lib/page-knowledge";

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(llevame|llévame|lleva|mostrame|andá|anda|iré|ir)\s+(a\s+)?(abajo|a bajo|el abajo)\b/gi, "$1 a ajo"],
  [/\bparte de abajo\b/gi, "parte de ajo"],
  [/\bsecci[oó]n de abajo\b/gi, "sección de ajo"],
  [/\bdel abajo\b/gi, "del ajo"],
  [/\ba hajo\b/gi, "ajo"],
  [/\bel hajo\b/gi, "el ajo"],
  [/\baho\b/gi, "ajo"],
  [/\bciruelo\b/gi, "ciruela"],
  [/\bduraznos?\s+industrial\b/gi, "durazno industria"],
  [/\bduraznero\b/gi, "durazno industria"],
  [/\bel ruth\b/gi, "el RUT"],
  [/\bel root\b/gi, "el RUT"],
  [/\bdel root\b/gi, "del RUT"],
  [/\bdel ruth\b/gi, "del RUT"],
  [/\bdel rod\b/gi, "del RUT"],
  [/\bla root\b/gi, "la RUT"],
  [/\bparte del root\b/gi, "parte del RUT"],
  [/\bparte de root\b/gi, "parte del RUT"],
  [/\bseccion (del |de )?root\b/gi, "sección del RUT"],
  [/\bzona (del |de )?root\b/gi, "zona del RUT"],
  [/\b(llevame|lleveme|mostrame|muestrame|ir a|ir al|a|al)\s+(el |la )?root\b/gi, "$1 el RUT"],
  [/\b(llevame|lleveme|mostrame|muestrame|ir a|ir al|a|al)\s+(el |la )?ruth\b/gi, "$1 el RUT"],
  [/\b(llevame|lleveme|mostrame|muestrame|ir a|ir al|a|al)\s+(el |la )?rod\b/gi, "$1 el RUT"],
  [/\bel rued\b/gi, "el RUT"],
  [/\bel ru\b/gi, "el RUT"],
  [/\bel rod\b/gi, "el RUT"],
  [/\bquiero el rod\b/gi, "quiero el RUT"],
  [/\b^rod\b$/gi, "RUT"],
  [/\b^root\b$/gi, "RUT"],
  [/\b^ruth\b$/gi, "RUT"],
  [/\bregistro \w+nico\b/gi, "registro único"],
  [/\bagro\s*meteorolog[ií]a\b/gi, "agrometeorología"],
  [/\bagro meteo\b/gi, "agrometeorología"],
  [/\bhelada s\b/gi, "heladas"],
  [/\bhelada\b/gi, "heladas"],
  [/\bcinturon verde\b/gi, "cinturón verde"],
  [/\bmapas agr[ií]colas\b/gi, "mapas agrícolas"],
  [/\bmapa agr[ií]cola\b/gi, "mapas agrícolas"],
  [/\bel mapa agr[ií]cola\b/gi, "mapas agrícolas"],
  [/\bvis or\b/gi, "visor"],
  [/\bdemo gui ada\b/gi, "demo guiada"],
  [/\bfruta cultura\b/gi, "fruticultura"],
  [/\bfruto secos?\b/gi, "frutos secos"],
  [/\bfrutos secos?\b/gi, "frutos secos"],
  [/\bhortaliza\b/gi, "horticultura"],
  [/\bmeteorologia agricola\b/gi, "agrometeorología"],
  [/\bprecio de\b/gi, "precios de"],
  [/\b^precio\b/gi, "precios"],
  [/\bcapacitacion\b/gi, "capacitaciones"],
  [/\bestacion meteorologica\b/gi, "estaciones meteorológicas"],
  [/\bradar meteorologico\b/gi, "radar meteorológico"],
  [/\bmanejo hidrico\b/gi, "manejo hídrico"],
  [/\beconomia regional\b/gi, "economía regional"],
  [/\bpublicacion\b/gi, "publicaciones"],
  [/\bcodigo qr\b/gi, "código QR"],
  [/\bo d k\b/gi, "ODK"],
];

export function correctSpeechTranscript(raw: string): {
  text: string;
  changed: boolean;
} {
  let text = raw.trim();
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/\s+/g, " ").trim();
  return { text, changed: text.toLowerCase() !== raw.trim().toLowerCase() };
}

/** Alinea la transcripción con vocabulario del catálogo demo (post-STT). */
export function alignTranscriptToCatalog(
  raw: string,
  opts?: { lastSectionId?: string }
): { text: string; changed: boolean; heardAs?: string } {
  const corrected = correctSpeechTranscript(raw);
  let text = corrected.text;
  let changed = corrected.changed;
  const heardAs = corrected.changed ? raw.trim() : undefined;

  const hits = findBestSections(text, 1);
  const best = hits[0];

  // Frase corta + match fuerte al catálogo: priorizar el título canónico.
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (best && best.score >= 9 && wordCount <= 5) {
    const canonical = best.title.toLowerCase();
    const norm = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (!norm.includes(canonical.split(" ")[0]!) && best.score >= 10) {
      text = best.title;
      changed = true;
    }
  }

  if (
    opts?.lastSectionId &&
    wordCount <= 3 &&
    /^(si|no|dale|vale|eso|esta|esto|mas|explicame|contame)$/i.test(text)
  ) {
    return { text, changed, heardAs };
  }

  return { text, changed, heardAs };
}
