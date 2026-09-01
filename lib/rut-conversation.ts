/** Premium RUT dialogue helpers — tone, field hygiene, confirm/docs intents. */

import { FIELD_LABELS } from "@/lib/form-extract";

/** Gemini / spoken aliases → canonical wizard keys */
const FIELD_ALIASES: Record<string, string> = {
  condicionfrentetierra: "condicionTierra",
  condicion_tierra: "condicionTierra",
  condicion: "condicionTierra",
  nombrefinca: "nombreEstablecimiento",
  nombre_finca: "nombreEstablecimiento",
  finca: "nombreEstablecimiento",
  establecimiento: "nombreEstablecimiento",
  razonsocial: "razonSocial",
  nombre: "razonSocial",
  mail: "email",
  correo: "email",
  correoelectronico: "email",
  tel: "telefono",
  telefono: "telefono",
  celular: "telefono",
  depto: "departamento",
};

export function normalizeRutFields(
  fields: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(fields)) {
    if (!value?.trim()) continue;
    const norm = rawKey
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]/g, "");
    const key = FIELD_ALIASES[norm] || rawKey;
    if (!FIELD_LABELS[key] && !FIELD_ALIASES[norm]) continue;
    const canon = FIELD_ALIASES[norm] || key;
    out[canon] = value.trim();
  }
  return out;
}

/** Short human list for speech — never dump camelCase keys. */
export function summarizePending(fields: Record<string, string>): string {
  const keys = Object.keys(normalizeRutFields(fields)).filter(
    (k) => FIELD_LABELS[k]
  );
  if (!keys.length) return "lo que me fuiste pasando";
  const labels = keys.map((k) => FIELD_LABELS[k]);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  if (labels.length === 3) {
    return `${labels[0]}, ${labels[1]} y ${labels[2]}`;
  }
  return `${labels.slice(0, 2).join(", ")} y ${labels.length - 2} datos más`;
}

const ACK_TEMPLATES = [
  (got: string, next: string) =>
    `Listo, quedó ${got}. Seguimos: pasame ${next}.`,
  (got: string, next: string) =>
    `Bien, ya tengo ${got}. ¿Me pasás ${next}?`,
  (got: string, next: string) =>
    `Anotado ${got}. Ahora necesito ${next}.`,
  (got: string, next: string) =>
    `Gracias. Con ${got} estamos bien. Pasame ${next} y avanzamos.`,
  (got: string, next: string) =>
    `Quedó registrado ${got}. Decime ${next}.`,
];

export function ackAndAskNext(
  gotFields: Record<string, string>,
  nextHint: string,
  salt = 0
): string {
  const got = summarizePending(gotFields);
  const tpl = ACK_TEMPLATES[Math.abs(salt) % ACK_TEMPLATES.length];
  return tpl(got, nextHint);
}

export function askFirstField(hint: string): string {
  const openers = [
    `Buenísimo, arrancamos juntos. Empecemos por ${hint}.`,
    `Dale, te voy guiando paso a paso. Primero pasame ${hint}.`,
    `Perfecto, vamos con calma. Para empezar necesito ${hint}.`,
    `Genial. Arrancamos por lo básico: pasame ${hint}.`,
  ];
  return openers[Math.floor(Date.now() / 1000) % openers.length];
}

export function askConfirmReady(fields: Record<string, string>): string {
  return `Ya tengo ${summarizePending(
    fields
  )}. Si está todo bien, decime “confirmá” o “completalo vos” y te cargo el formulario y el checklist de documentos.`;
}

export function completeRutSpoken(
  fields: Record<string, string>,
  condicion: string,
  mentionedDocs: string[]
): string {
  const docsBit = mentionedDocs.length
    ? ` Me anoté que ya tenés ${mentionedDocs.join(", ")}.`
    : "";
  return `Excelente. Te cargo ${summarizePending(
    fields
  )} en el wizard.${docsBit} Te dejo el checklist para condición ${condicion}: constancia de CUIT, documentación legal del titular y boleta del impuesto inmobiliario. Mirá el paso 4; en el oficial se presenta según tu caso.`;
}

export function isAffirmativeRut(raw: string): boolean {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    /^(si|dale|ok|okay|va|de una|confirmo|confirmalo|confirmamos|listo|seguimos|adelante)$/.test(
      text
    )
  ) {
    return true;
  }
  return /(confirm|completalo|cargalo|llena(lo)?|hacelo vos|si por favor|dale si|mostrame (el )?checklist|seguimos al checklist|si dale)/.test(
    text
  );
}

export function extractMentionedDocs(raw: string): string[] {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const docs: string[] = [];
  if (/constancia(\s+de)?\s+cuit/.test(text)) {
    docs.push("constancia de CUIT");
  }
  if (
    /documento legal|dni del titular|pasaporte|escritura|boleto de compra/.test(
      text
    )
  ) {
    docs.push("documentación legal del titular");
  }
  if (/impuesto inmobiliario|boleta.*(inmobiliario|pago)/.test(text)) {
    docs.push("boleta del impuesto inmobiliario");
  }
  if (/boleta.*(riego|irrigacion|pozo)|(riego|irrigacion).*boleta/.test(text)) {
    docs.push("boleta de riego");
  }
  return [...new Set(docs)];
}

export function wantsRutChecklist(raw: string): boolean {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /(checklist|papeles del rut|documentos? del rut|que documentos|que papeles|que tengo que (presentar|llevar)|mostrame (el )?checklist|mostrame los documentos)/.test(
    text
  );
}

export function wantsToPassRutData(raw: string): boolean {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /(te (tengo|voy) a pasar|pasarte|dictar|completar|cargar|empezar|arranc(a|amos)|dale que|vamos (con|al) (los )?datos)/.test(
    text
  );
}
