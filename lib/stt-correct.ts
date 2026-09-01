/** Fix frequent Chrome STT mistakes in Río de la Plata Spanish. */

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
  [/\bel ruth\b/gi, "el RUT"],
  [/\bel root\b/gi, "el RUT"],
  [/\bel rued\b/gi, "el RUT"],
  [/\bel ru\b/gi, "el RUT"],
  [/\bregistro \w+nico\b/gi, "registro único"],
  [/\bagro\s*meteorolog[ií]a\b/gi, "agrometeorología"],
  [/\bagro meteo\b/gi, "agrometeorología"],
  [/\bhelada s\b/gi, "heladas"],
  [/\bcinturon verde\b/gi, "cinturón verde"],
  [/\bmapas agr[ií]colas\b/gi, "mapas agrícolas"],
  [/\bel mapa agr[ií]cola\b/gi, "mapas agrícolas"],
  [/\bvis or\b/gi, "visor"],
  [/\bdemo gui ada\b/gi, "demo guiada"],
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
