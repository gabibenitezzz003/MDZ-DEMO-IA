import { getWhatsAppRutNumber } from "@/lib/whatsapp-rut";

const DEFAULT_PREFILL =
  "Hola, estoy en campo. Quiero cargar un formulario por WhatsApp: olivo encontrado o visita técnica. No voy a rellenar Collect a mano.";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getWhatsAppCampoPrefill() {
  return process.env.WHATSAPP_ODK_TEXT?.trim() || DEFAULT_PREFILL;
}

export function buildWhatsAppCampoUrl(prefill?: string) {
  const number = getWhatsAppRutNumber();
  if (!number) return null;
  const text = (prefill || getWhatsAppCampoPrefill()).trim();
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function wantsOdkWhatsApp(raw: string) {
  const t = normalize(raw);
  if (!t) return false;
  if (/(whatsapp|wsp|wasap|chat).{0,28}(olivo|visita|feno|formulario|campo|odk|ingenier)/.test(t)) {
    return true;
  }
  if (/(olivo|visita|formulario|campo|odk).{0,28}(whatsapp|wsp|wasap)/.test(t)) {
    return true;
  }
  return /(cargar|alta|relev|encontre).{0,24}(olivo|visita|formulario).{0,16}(whatsapp|wsp|chat)/.test(
    t
  );
}

export function wantsCampoCollector(raw: string) {
  const t = normalize(raw);
  if (!t) return false;
  if (wantsOdkWhatsApp(raw)) return true;
  return (
    /(encontre|encontramos|alta de|cargar|cargame|relev).{0,20}(olivo|olivar|visita)/.test(
      t
    ) ||
    /(salir a campo|ficha de campo|por chat|sin collect|sin rellenar)/.test(t)
  );
}

export function campoSpoken(hasLink: boolean) {
  if (hasLink) {
    return "El diferencial es este: el ingeniero habla por WhatsApp como en la finca y yo armo una ficha simulada. Te abro el chat; en la bandeja aparece el paquete de demo, sin usar los formularios reales ni tocar Central.";
  }
  return "Acá el ingeniero carga por conversación, no a mano. Abrí el chat de campo y hablale como si estuvieras en la finca. La ficha es simulada: no es un XForm de Central.";
}
