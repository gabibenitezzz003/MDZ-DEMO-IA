function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prueba de micrófono / meta-conversación: no navegar. */
export function wantsListeningCheck(raw: string) {
  const t = normalize(raw);
  if (!t) return false;
  return (
    /me escuch/.test(t) ||
    /me o[iy]s\b/.test(t) ||
    /me oye\b/.test(t) ||
    /escuch(a|as|ame).{0,24}(mi|mio|a mi|otra)/.test(t) ||
    /estas? (ahi|aqui|escuch)/.test(t) ||
    /funciona (el )?micro/.test(t) ||
    /hay alguien/.test(t) ||
    /me esta[sn]? oyendo/.test(t)
  );
}

/** Continuación explícita del recorrido (no "otra cosa" dentro de una pregunta). */
export function wantsContinueTour(raw: string) {
  const t = normalize(raw);
  if (!t) return false;
  if (wantsListeningCheck(raw)) return false;
  if (
    /^(si|ok|va|de una|seguimos|segui|continua|continuar|siguiente|avance|avanzar)$/.test(
      t
    )
  ) {
    return true;
  }
  return (
    /^(dale|de acuerdo)$/.test(t) ||
    /\b(seguimos|avancemos|continua(mos)?|siguiente)\b/.test(t) ||
    /\b(mostrame|muestreme|vamos a|quiero)\s+otra(\s+seccion|\s+cosa)?\b/.test(
      t
    ) ||
    /\botra seccion\b/.test(t)
  );
}
