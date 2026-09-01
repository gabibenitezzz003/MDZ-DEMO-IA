/**
 * Convierte giros rioplatenses/mendocinos frecuentes a español neutro
 * profesional con tratamiento de usted (para TTS y respuestas locales).
 */
export function neutralizeToUsted(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;

  const pairs: Array<[RegExp, string]> = [
    [/\b¿cómo andás\b/gi, "¿cómo está"],
    [/\bcómo andás\b/gi, "cómo está"],
    [/\bBuenas\b/g, "Hola"],
    [/\btenés\b/gi, "tiene"],
    [/\bquerés\b/gi, "quiere"],
    [/\bpodés\b/gi, "puede"],
    [/\bsabés\b/gi, "sabe"],
    [/\bnecesitás\b/gi, "necesita"],
    [/\bpreferís\b/gi, "prefiere"],
    [/\bdecime\b/gi, "dígame"],
    [/\bpasame\b/gi, "páseme"],
    [/\bpasámelo\b/gi, "pásemelo"],
    [/\bmostrame\b/gi, "muéstreme"],
    [/\bllevame\b/gi, "lléveme"],
    [/\bexplicame\b/gi, "explíqueme"],
    [/\bcontame\b/gi, "cuénteme"],
    [/\bdejame\b/gi, "déjeme"],
    [/\bavisame\b/gi, "avíseme"],
    [/\bconfirmá\b/gi, "confirme"],
    [/\bcompletalo\b/gi, "complételo"],
    [/\bcargalo\b/gi, "cárguelo"],
    [/\bhacelo\b/gi, "hágalo"],
    [/\barrancá\b/gi, "comience"],
    [/\bseguí\b/gi, "continúe"],
    [/\bmirá\b/gi, "mire"],
    [/\btocá\b/gi, "toque"],
    [/\babrí\b/gi, "abra"],
    [/\babrime\b/gi, "abra"],
    [/\bandá\b/gi, "vaya"],
    [/\bvení\b/gi, "venga"],
    [/\besperá\b/gi, "espere"],
    [/\bprobá\b/gi, "pruebe"],
    [/\bfrené\b/gi, "detuve"],
    [/\bApagué\b/g, "Desactivé"],
    [/\bapagué\b/gi, "desactivé"],
    [/\bsos\b/gi, "es"],
    [/\bestás\b/gi, "está"],
    [/\bacá\b/gi, "aquí"],
    [/\ballá\b/gi, "allí"],
    [/\bDale\b/g, "De acuerdo"],
    [/\bdale\b/g, "de acuerdo"],
    [/\bUy,?\s*/gi, ""],
    [/\bche\b/gi, ""],
    [/\bTe llevo\b/g, "Le llevo"],
    [/\bte llevo\b/gi, "le llevo"],
    [/\bTe marco\b/g, "Le indico"],
    [/\bte marco\b/gi, "le indico"],
    [/\bTe abro\b/g, "Le abro"],
    [/\bte abro\b/gi, "le abro"],
    [/\bTe muestro\b/g, "Le muestro"],
    [/\bte muestro\b/gi, "le muestro"],
    [/\bTe cargo\b/g, "Le cargo"],
    [/\bte cargo\b/gi, "le cargo"],
    [/\bTe dejo\b/g, "Le dejo"],
    [/\bte dejo\b/gi, "le dejo"],
    [/\bYo me quedo acá\b/gi, "Yo continúo aquí"],
    [/\byo sigo acá\b/gi, "yo continúo aquí"],
    [/\bTenés razón\b/gi, "Tiene razón"],
    [/\bDisculpá\b/gi, "Disculpe"],
    [/\bpasame el\b/gi, "páseme el"],
    [/\bCuando quieras\b/gi, "Cuando desee"],
    [/\bcuando quieras\b/gi, "cuando desee"],
  ];

  for (const [re, to] of pairs) {
    t = t.replace(re, to);
  }

  t = t.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  return t;
}
