function normalizePageQuestion(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wantsPageLocation(raw: string) {
  const text = normalizePageQuestion(raw);
  return /(donde estoy|en que (pagina|seccion)|que estoy viendo|donde me dejaste|en que seccion me dejaste)/.test(
    text
  );
}

export function wantsExplainCurrentPage(raw: string) {
  const text = normalizePageQuestion(raw);
  return /(explicame (esto|esta|aca|aqui)|que es (esto|esta seccion)|contame (de )?esto|que hay aca|que hay aqui)/.test(
    text
  );
}
