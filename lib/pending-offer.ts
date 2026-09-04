/**
 * El asistente ofrece algo ("¿Querés que te abra WhatsApp ahora?") y el usuario
 * contesta con una frase que sola no significa nada: "dale", "vale, abrímelo".
 * Sin atarla a la oferta, esas frases caen en cualquier regla por palabra
 * suelta y terminan haciendo otra cosa.
 */

function normalize(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cierres de cortesía que no cambian el sentido de la respuesta. */
const CORTESIA = /\b(por favor|porfa|porfis|gracias|dale|ahora|ya|si|claro)\b/g;

const AFIRMA =
  /^(si|sip|sisi|dale|ok|oka|okay|okey|vale|bueno|listo|va|de una|obvio|claro|perfecto|genial|adelante|correcto|confirmo|hagamoslo|abrilo|abrime|abrimelo|abrelo|abremelo|abril|abri|abre|abrir|mostramelo|mostrame|hacelo|seguimos|continuemos)$/;

/** Verbos de apertura con pronombre pegado: "abrímelo", "abrilo", "mostrámelo". */
const ABRIR_PRONOMBRE =
  /\b(abri|abre|abrir|mostra|muestra|manda|pasa)(me|te|se)?(lo|la|me)?\b/;

const NIEGA =
  /\b(no|nop|nah|todavia no|ahora no|mejor no|despues|luego|cancela|cancelar|olvidalo|dejalo)\b/;

/**
 * ¿La frase es un "sí" a lo que se acaba de ofrecer?
 * Se aplica SOLO cuando hay una oferta pendiente: fuera de ese contexto,
 * "abrilo" es ambiguo y lo debe resolver el modelo.
 */
export function isOfferConfirmation(raw: string): boolean {
  const t = normalize(raw);
  if (!t) return false;
  if (isOfferRejection(t)) return false;
  if (AFIRMA.test(t)) return true;

  // Frases cortas de confirmación: "vale abrimelo por favor", "dale abrilo".
  const sinCortesia = t.replace(CORTESIA, " ").replace(/\s+/g, " ").trim();
  if (!sinCortesia) return true;
  if (sinCortesia.split(" ").length <= 3 && ABRIR_PRONOMBRE.test(sinCortesia)) {
    return true;
  }
  return false;
}

export function isOfferRejection(raw: string): boolean {
  const t = normalize(raw);
  if (!t) return false;
  return /^(no|nop|nah)$/.test(t) || NIEGA.test(t);
}
