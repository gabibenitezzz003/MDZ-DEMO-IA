import { extractSpokenEmail } from "@/lib/spoken-email";

const WORD_DIGIT: Record<string, string> = {
  cero: "0",
  zero: "0",
  uno: "1",
  una: "1",
  dos: "2",
  tres: "3",
  cuatro: "4",
  cinco: "5",
  seis: "6",
  siete: "7",
  ocho: "8",
  nueve: "9",
};

const WORD_TENS: Record<string, string> = {
  diez: "10",
  once: "11",
  doce: "12",
  trece: "13",
  catorce: "14",
  quince: "15",
  dieciseis: "16",
  diecisiete: "17",
  dieciocho: "18",
  diecinueve: "19",
  veinte: "20",
  treinta: "30",
  cuarenta: "40",
  cincuenta: "50",
  sesenta: "60",
  setenta: "70",
  ochenta: "80",
  noventa: "90",
};

function digitsFromSpoken(raw: string): string {
  const parts = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\wáéíóúñ\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

  let out = "";
  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      out += p;
      continue;
    }
    if (WORD_TENS[p]) {
      out += WORD_TENS[p];
      continue;
    }
    if (WORD_DIGIT[p]) {
      out += WORD_DIGIT[p];
    }
  }
  return out;
}

function formatCuit(digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export function extractSpokenCuit(raw: string): string | null {
  const direct = raw.match(/\b(\d{2})[-\s.]?(\d{8})[-\s.]?(\d)\b/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;

  const lower = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  const compact = lower.replace(/[^\d]/g, "");
  const fromCompact = formatCuit(compact);
  if (fromCompact) return fromCompact;

  const spokenAll = digitsFromSpoken(lower);
  const fromSpoken = formatCuit(spokenAll);
  if (fromSpoken) return fromSpoken;

  if (!/\bcuit\b/.test(lower) && !/cuil/.test(lower)) return null;

  const after = lower.split(/cuit|cuil/)[1] ?? lower;
  const digits = digitsFromSpoken(after).replace(/\D/g, "");
  const labeled = formatCuit(digits);
  if (labeled) return labeled;

  const loose = after.match(/\b(\d{2})\D+(\d{8})\D+(\d)\b/);
  if (loose) return `${loose[1]}-${loose[2]}-${loose[3]}`;
  return null;
}

export function extractSpokenPhone(raw: string): string | null {
  const labeled = raw.match(
    /(?:tel[eé]fono|celu(?:lar)?|whats?app|n[uú]mero)\s*(?:es|:)?\s*([+\d][\d\s-]{6,18})/i
  );
  if (labeled) return labeled[1].replace(/\s+/g, " ").trim();

  const mza = raw.match(/\b((?:\+54\s?)?9?\s*2(?:61|63|60)[\s-]?\d{6,8})\b/);
  if (mza) return mza[1].replace(/\s+/g, " ").trim();

  const lower = raw.toLowerCase();
  if (!/(tel[eé]fono|celu|whats?app|numero)/.test(lower)) return null;
  const digits = digitsFromSpoken(raw).replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 13) return digits;
  return null;
}

export function extractAllSpokenFields(raw: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const text = raw.trim();
  const lower = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  const cuit = extractSpokenCuit(raw);
  if (cuit) fields.cuit = cuit;

  const email = extractSpokenEmail(raw);
  if (email) fields.email = email;

  const phone = extractSpokenPhone(raw);
  if (phone) fields.telefono = phone;

  const razonLabeled = text.match(
    /(?:raz[oó]n social(?: es|:)?|me llamo|mi nombre es)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .'-]{2,60})/i
  );
  if (razonLabeled) {
    fields.razonSocial = razonLabeled[1]
      .replace(
        /\s+(?:y\s+)?(?:soy|cuit|correo|mail|tel[eé]fono|celu|cuil|finca|titular|locatario).*$/i,
        ""
      )
      .replace(/\s+(?:tel[eé]fono|celu|mail|correo|cuit)\b.*$/i, "")
      .trim();
  }

  const finca = text.match(
    /(?:finca|establecimiento)\s+(?:se llama |es |nombre )?([A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .'-]{3,50})/i
  );
  if (finca) fields.nombreEstablecimiento = finca[1].trim();

  const depto = text.match(
    /(?:departamento|depto)\s+(?:de |es )?([A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,30})/i
  );
  if (depto) fields.departamento = depto[1].trim();
  else {
    const known = text.match(
      /\b(Guaymall[eé]n|Maip[uú]|Luj[aá]n(?: de Cuyo)?|San Mart[ií]n|Jun[ií]n|Rivadavia|Tunuy[aá]n|Tupungato|San Carlos|Lavalle|Las Heras|Godoy Cruz|Capital|Malarg[uü]e|San Rafael|General Alvear)\b/i
    );
    if (known && /(departamento|depto|vivo en|soy de|finca en|en )\b/i.test(text)) {
      fields.departamento = known[1];
    }
  }

  const loc = text.match(
    /localidad\s+(?:de |es )?([A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,30})/i
  );
  if (loc) {
    fields.localidad = loc[1].replace(/\.$/, "").trim();
  } else if (/\bciudad\b/.test(lower) && /localidad/.test(lower)) {
    fields.localidad = "Ciudad";
  }

  const catastro = text.match(/catastro\s+(?:es |: )?([0-9-]{5,20})/i);
  if (catastro) fields.catastro = catastro[1];

  const superficie = text.match(
    /superficie(?: utilizada| del lote)?\s*(?:es |de |: )?\s*([\d.,]+)\s*(?:ha|hect)?/i
  );
  if (superficie) fields.superficie = superficie[1];

  const especie = text.match(
    /especie\s+(?:es |: )?([A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,30})/i
  );
  if (especie) fields.especie = especie[1].trim();

  const variedad = text.match(
    /variedad\s+(?:es |: )?([A-Za-zÁÉÍÓÚÑáéíóúñ0-9'’ ]{2,40})/i
  );
  if (variedad) fields.variedad = variedad[1].trim();

  const anio = text.match(
    /(?:a[nñ]o de implantaci[oó]n|implant[eó] en)\s*(?:es |el |: )?(\d{4})/i
  );
  if (anio) fields.anioImplantacion = anio[1];

  if (/persona humana/.test(lower)) fields.tipoPersona = "Persona humana";
  if (/sociedad/.test(lower)) fields.tipoPersona = "Sociedades Comerciales";
  if (/cooperativ/.test(lower)) fields.tipoPersona = "Cooperativas";

  if (/locatario|arrendatario|alquiler/.test(lower)) {
    fields.condicionTierra = "Locatario/Arrendatario";
  } else if (/\btitular\b/.test(lower)) {
    fields.condicionTierra = "Titular";
  }

  if (/goteo/.test(lower)) fields.sistemaRiego = "Goteo";
  if (/aspersi[oó]n/.test(lower)) fields.sistemaRiego = "Aspersión";
  if (/manto|surco/.test(lower)) fields.sistemaRiego = "Manto / surco";

  return fields;
}

export function wantsOdkHelp(raw: string) {
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /(odk|codigo qr|c[oó]digo qr|\bqr\b|collect|agregar proyecto|formulario.*(celular|campo|movil)|relevamiento en campo)/.test(
    text
  );
}
