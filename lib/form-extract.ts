import { extractAllSpokenFields } from "@/lib/spoken-fields";

export type FillMode = "auto" | "manual" | "ask";

export const FIELD_LABELS: Record<string, string> = {
  cuit: "CUIT",
  email: "correo electrónico",
  telefono: "teléfono",
  razonSocial: "razón social",
  tipoPersona: "tipo de persona",
  condicionTierra: "condición frente a la tierra",
  renspa: "RENSPA",
  nombreEstablecimiento: "nombre de la finca",
  catastro: "catastro",
  irrigacion: "irrigación",
  departamento: "departamento",
  localidad: "localidad",
  superficie: "superficie",
  especie: "especie",
  variedad: "variedad",
  superficieLote: "superficie del lote",
  sistemaRiego: "sistema de riego",
  anioImplantacion: "año de implantación",
};

export function fieldLabels(fields: Record<string, string>) {
  return Object.keys(fields)
    .filter((k) => FIELD_LABELS[k])
    .map((k) => FIELD_LABELS[k])
    .join(", ");
}

export function extractFormFields(raw: string): Record<string, string> {
  // Full spoken + typed harvest (CUIT, mail, tel, finca, depto, etc.)
  return extractAllSpokenFields(raw);
}

export function detectFillPreference(raw: string): FillMode | null {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    /(lo hago yo|a mano|manual|yo lo cargo|lo cargo yo|lo cargo a mano|yo lo lleno|no lo completes|dejalo vacio|prefiero cargarlo)/.test(
      text
    )
  ) {
    return "manual";
  }

  if (
    /(completalo|llena(lo)?|cargalo|hacelo vos|hace lo vos|automatico|si por favor|dale si|si comple|si carga|si llen|si hacelo|si dale|confirm(a|alo|amos|o)|seguimos|mostrame (el )?checklist)/.test(
      text
    )
  ) {
    return "auto";
  }

  if (/^(si|dale|ok|okay|perfecto|va|de una|hacelo|confirmo|listo|adelante)$/.test(text)) {
    return "auto";
  }

  if (/^(no|despues|ahora no)$/.test(text)) {
    return "manual";
  }

  return null;
}

export function wantsEndSession(raw: string) {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /(finalizar sesion|terminar sesion|corta(r)? sesion|apaga(r)? el micro|chau chau|nos vemos|hasta luego)/.test(
    text
  );
}
