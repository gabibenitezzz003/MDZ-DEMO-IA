function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Preguntó cómo estamos, no solo “hola”. */
export function askedHowAreYou(raw: string) {
  const t = normalize(raw);
  return /como (estas|andas|te va)|que tal|todo bien/.test(t);
}

const HOW_ARE_YOU = [
  "Bien, gracias. ¿En qué puedo ayudarte?",
  "Todo bien. ¿Qué necesitás?",
  "Bien, gracias por preguntar. Contame qué estás buscando.",
];

const HELLO = [
  "Hola, ¿cómo estás? Decime en qué puedo ayudarte.",
  "Buenas. ¿Qué necesitás?",
  "Hola. Estoy para asistirte, pedime lo que necesites.",
];

const ENGINEERING_HOW = [
  "Bien, gracias. Estás en ingeniería: Collect, formularios y el tablero. ¿Por dónde empezamos?",
  "Todo bien. Esta es la vista técnica. ¿Querés el QR, un formulario o que te recorra todo?",
];

const ENGINEERING_HELLO = [
  "Hola. Esta es la parte de ingeniería. Pedime el QR, un formulario o el recorrido y te lo marco.",
  "Buenas. Estamos en la vista técnica de ODK. ¿Qué necesitás ver?",
];

export function greetingReply(
  raw: string,
  salt = 0,
  opts: { mode?: "producer" | "engineering" } = {}
) {
  const engineering = opts.mode === "engineering";
  const pool = askedHowAreYou(raw)
    ? engineering
      ? ENGINEERING_HOW
      : HOW_ARE_YOU
    : engineering
      ? ENGINEERING_HELLO
      : HELLO;
  return pool[Math.abs(salt) % pool.length];
}
