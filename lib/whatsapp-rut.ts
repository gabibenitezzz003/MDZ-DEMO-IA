/**
 * Handoff del registro RUT a WhatsApp (agente OpenWA / n8n).
 * Número: NEXT_PUBLIC_WHATSAPP_RUT_NUMBER (solo dígitos, con código de país).
 */

const DEFAULT_PREFILL =
  "Hola, quiero registrarme en el RUT (Registro Único de Tierras) de Mendoza. Me derivaron desde la demo de la Dirección de Agricultura.";

export function normalizeWhatsAppNumber(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function getWhatsAppRutNumber(): string | null {
  return normalizeWhatsAppNumber(
    process.env.WHATSAPP_RUT_NUMBER?.trim() ||
      process.env.NEXT_PUBLIC_WHATSAPP_RUT_NUMBER?.trim()
  );
}

export function getWhatsAppRutPrefill(): string {
  return (
    process.env.WHATSAPP_RUT_TEXT?.trim() ||
    process.env.NEXT_PUBLIC_WHATSAPP_RUT_TEXT?.trim() ||
    DEFAULT_PREFILL
  );
}

export function buildWhatsAppRutUrl(prefill?: string): string | null {
  const number = getWhatsAppRutNumber();
  if (!number) return null;
  const text = (prefill || getWhatsAppRutPrefill()).trim();
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Solo quiere explicación del RUT, no registrarse. */
export function wantsRutExplainOnly(raw: string) {
  const t = normalize(raw);
  // "lo que es el RUT" es muletilla rioplatense por "el RUT", no una pregunta:
  // sin esta excepción, "llevame a lo que es el RUT por WhatsApp" se leía como
  // "¿qué es el RUT?" y el pedido de registro nunca llegaba al handoff.
  const preguntaQueEs = /\bque es (el )?rut\b/.test(t) && !/\blo que es\b/.test(t);
  return (
    preguntaQueEs ||
    /para que sirve (el )?rut/.test(t) ||
    /explic(ame|eme|a).{0,12}rut/.test(t) ||
    /cuenta.{0,12}del rut/.test(t)
  );
}

/** Quiere el wizard DEMO en la web (no WhatsApp). */
export function wantsRutDemoWizard(raw: string) {
  const t = normalize(raw);
  return (
    /wizard/.test(t) ||
    /formulario demo/.test(t) ||
    /demo del rut/.test(t) ||
    /cargar aca|cargar aqui|en la pagina|en la demo/.test(t)
  );
}

/** Navegar a la sección RUT (no registro WhatsApp). */
export function wantsRutNavigate(raw: string) {
  const t = normalize(raw);
  if (!t) return false;
  if (wantsRutWhatsAppHandoff(raw)) return false;
  if (wantsRutExplainOnly(raw)) return false;
  if (wantsRutDemoWizard(raw)) return false;

  if (
    /\b(rut|registro unico|root|ruth|rod|rued)\b/.test(t) &&
    /(llevame|lleveme|mostrame|muestrame|muestreme|ir a|parte de|parte del|seccion|zona|donde esta|donde queda|abrir|ver el|ver la|mostrar)/.test(
      t
    )
  ) {
    return true;
  }

  if (/^(el )?(rut|root|ruth|rod)$/.test(t)) return true;

  return false;
}

/** Eco corto de voz: root/ruth/rod → RUT. */
export function isRutSttHomophone(raw: string) {
  const t = normalize(raw);
  return /^(rod|root|ruth|rued|ru)$/.test(t);
}

/**
 * Intención de registrarse / iniciar el RUT → WhatsApp.
 */
export function wantsRutWhatsAppHandoff(raw: string) {
  const t = normalize(raw);
  if (!t) return false;
  if (wantsRutExplainOnly(raw) || wantsRutDemoWizard(raw)) return false;

  if (
    /whatsapp|wsp|wasap/.test(t) &&
    (/\brut\b/.test(t) || /registro|inscrib|tramite/.test(t))
  ) {
    return true;
  }

  if (
    /inscrib|registrar(me|nos)?|quiero hacer el rut|iniciar el rut|empezar el rut|tramitar el rut/.test(
      t
    )
  ) {
    return true;
  }

  if (
    /(mostrame|muestreme|llevame|lleveme|abrir|abre|quiero|necesito|hacer|empezar).{0,24}\brut\b/.test(
      t
    )
  ) {
    return true;
  }

  if (
    /\b(rut|root|ruth|rod)\b/.test(t) &&
    /(registr|inscrib|whatsapp|wsp|wasap|tramite|cargar|datos|document)/.test(t)
  ) {
    return true;
  }

  return false;
}

export function whatsAppRutSpoken(hasLink: boolean): string {
  if (hasLink) {
    return "Para registrarte en el RUT te atiende un agente por WhatsApp: valida datos, pide fotos y documentación, y puede responderte por texto o audio. Te abro el chat ahora; yo sigo acá si necesitás otra consulta.";
  }
  return "El registro del RUT se completa por WhatsApp con un agente especializado (datos, fotos y documentación). Falta configurar el número en la demo; mientras tanto te muestro la sección RUT acá.";
}
