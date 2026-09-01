export type CondicionTierra =
  | "Titular"
  | "Usufructuario"
  | "Locatario/Arrendatario"
  | "Mediero"
  | "Fideicomiso"
  | "Comodatario"
  | "Aparcero"
  | "Apoderado";

export const CONDICIONES_TIERRA: CondicionTierra[] = [
  "Titular",
  "Usufructuario",
  "Locatario/Arrendatario",
  "Mediero",
  "Fideicomiso",
  "Comodatario",
  "Aparcero",
  "Apoderado",
];

const LEGAL_BY_CONDITION: Record<CondicionTierra, string> = {
  Titular:
    "Escritura publica / boleto de compra-venta (sellado en Rentas, firmas certificadas; propiedad identificada).",
  Usufructuario: "Escritura publica.",
  "Locatario/Arrendatario":
    "Contrato de locacion / arrendamiento (sellado en Rentas, firmas certificadas).",
  Mediero: "Contrato de medieria (sellado en Rentas, firmas certificadas).",
  Fideicomiso:
    "Escritura publica / contrato de fideicomiso (sellado en Rentas, firmas certificadas).",
  Comodatario:
    "Contrato de comodato (sellado en Rentas, firmas certificadas).",
  Aparcero:
    "Contrato de aparceria (sellado en Rentas, firmas certificadas).",
  Apoderado:
    "Poder con constancia de inscripcion (sellado en Rentas, firmas certificadas).",
};

export type DocItem = {
  id: string;
  label: string;
  detail?: string;
  required: boolean;
};

export function getDocChecklist(
  condicion: CondicionTierra,
  hasVid = false,
  hasRenspa = false
): DocItem[] {
  const items: DocItem[] = [
    { id: "cuit", label: "Constancia de CUIT", required: true },
    {
      id: "legal",
      label: `Documentacion legal — ${condicion}`,
      detail: LEGAL_BY_CONDITION[condicion],
      required: true,
    },
    {
      id: "inmobiliario",
      label: "Boleta de pago del Impuesto Inmobiliario",
      required: true,
    },
    {
      id: "riego",
      label: "Boleta de pago de Riego o Pozo (Irrigacion)",
      required: true,
    },
  ];

  if (hasVid) {
    items.push({
      id: "inv",
      label: "Censo / DJ de actualizacion del Registro de vinedos (INV)",
      required: true,
    });
  }

  if (hasRenspa) {
    items.push({
      id: "renspa",
      label: "Constancia RENSPA de SENASA",
      required: true,
    });
  }

  items.push({
    id: "adicional",
    label:
      "Documentacion adicional si aplica (condominos, sucesion, planos por modificacion de catastro)",
    required: false,
  });

  return items;
}
