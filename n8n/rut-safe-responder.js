const chatId = String($json.chatId || '').trim();
const input = String($json.input || $json.messageText || '').trim();
const inputType = String($json.inputType || $json.sourceType || 'text').toLowerCase();
const normalized = input
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[¿?¡!.,;:]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const correctionText = input
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const EMPTY_STATE = {
  step: 0,
  status: 'collecting',
  siaStep: 'TITULAR',
  data: {},
  documents: [],
  validations: [],
  locationSaved: false,
  pendingDoc: null,
};
let state;
try {
  const raw = $json.state_raw || $json.stateJson || '';
  state = raw ? JSON.parse(String(raw)) : JSON.parse(JSON.stringify(EMPTY_STATE));
} catch {
  state = JSON.parse(JSON.stringify(EMPTY_STATE));
}
state.data = state.data && typeof state.data === 'object' ? state.data : {};
state.documents = Array.isArray(state.documents) ? state.documents : [];
state.validations = Array.isArray(state.validations) ? state.validations : [];
state.locationSaved = Boolean(state.locationSaved);
state.pendingDoc = state.pendingDoc || null;
state.siaStep = state.siaStep || 'TITULAR';

const fieldOrder = [
  'cuit',
  'email',
  'razonSocial',
  'telefono',
  'condicionTierra',
  'establecimiento',
  'departamento',
  'localidad',
];
const labels = {
  cuit: 'CUIT',
  email: 'correo',
  razonSocial: 'razón social o nombre',
  telefono: 'teléfono',
  condicionTierra: 'condición frente a la tierra',
  establecimiento: 'finca o establecimiento',
  departamento: 'departamento',
  localidad: 'localidad',
};
const BOT_MARK = '\u200B';

const LEGAL_BY_CONDITION = {
  titular: 'escritura pública o boleto de compra-venta sellado en Rentas',
  usufructuario: 'escritura pública',
  locatario: 'contrato de locación o arrendamiento sellado en Rentas',
  mediero: 'contrato de mediería sellado en Rentas',
  fideicomiso: 'escritura o contrato de fideicomiso sellado en Rentas',
  comodatario: 'contrato de comodato sellado en Rentas',
  aparcero: 'contrato de aparcería sellado en Rentas',
  apoderado: 'poder con constancia de inscripción, sellado en Rentas',
};

const DOC_PROVIDERS = {
  constancia_cuit: ['ARCA', 'constancia_cuit'],
  legal: ['RENTAS', 'documentacion_legal'],
  inmobiliario: ['ATM', 'impuesto_inmobiliario'],
  riego: ['IRRIGACION', 'boleta_riego'],
  inv: ['INV', 'registro_vinedos'],
  renspa: ['SENASA', 'renspa'],
  adicional: ['SIA', 'adicional'],
};

function validCuit(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, weight, index) => acc + Number(digits[index]) * weight, 0);
  const mod = 11 - (sum % 11);
  const verifier = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return verifier === Number(digits[10]);
}

function hasLetters(value) {
  return /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(String(value || ''));
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function nextMissing() {
  return fieldOrder.find((key) => !String(state.data[key] || '').trim()) || null;
}

function promptFor(field) {
  const prompts = {
    cuit: '¿Me pasás tu CUIT? Son 11 dígitos, con o sin guiones.',
    email: '¿A qué mail te escribo si hace falta?',
    razonSocial: '¿A nombre de quién queda, razón social o nombre y apellido?',
    telefono: '¿Qué teléfono dejamos, con código de área?',
    condicionTierra: '¿Qué condición frente a la tierra? Titular, locatario, usufructuario, mediero u otra.',
    establecimiento: '¿Cómo se llama la finca?',
    departamento: '¿En qué departamento de Mendoza queda? Por ejemplo San Rafael, Maipú o Luján.',
    localidad: '¿Y la localidad?',
  };
  return prompts[field] || 'Decime cómo seguimos.';
}

function spokenAck(field) {
  const acks = {
    cuit: 'CUIT en regla.',
    email: 'Dejo ese correo.',
    razonSocial: 'Quedó el titular.',
    telefono: 'Teléfono anotado.',
    condicionTierra: 'Condición clara.',
    establecimiento: 'Finca anotada.',
    departamento: 'Departamento listo.',
    localidad: 'Localidad lista.',
  };
  return acks[field] || 'Quedó anotado.';
}

function officialCondition(raw) {
  const value = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/\b(titular|propietari)/.test(value)) return 'titular';
  if (/\busufructuar/.test(value)) return 'usufructuario';
  if (/\b(locatari|arrendatari)/.test(value)) return 'locatario';
  if (/\bmedier/.test(value)) return 'mediero';
  if (/\bfideicomis/.test(value)) return 'fideicomiso';
  if (/\bcomodatari/.test(value)) return 'comodatario';
  if (/\baparc/.test(value)) return 'aparcero';
  if (/\bapoderad/.test(value)) return 'apoderado';
  return '';
}

function recordValidation(provider, check, status, detail) {
  const row = { provider, check, status, detail, at: Date.now() };
  const existing = state.validations.find((item) => item.provider === provider && item.check === check);
  if (existing) Object.assign(existing, row);
  else state.validations.push(row);
}

function requiredDocs() {
  const cond = officialCondition(state.data.condicionTierra) || 'titular';
  const items = [
    { id: 'constancia_cuit', label: 'la constancia de CUIT (ARCA/AFIP)', required: true },
    { id: 'legal', label: `la documentación legal: ${LEGAL_BY_CONDITION[cond]}`, required: true },
    { id: 'inmobiliario', label: 'la boleta de Impuesto Inmobiliario (ATM)', required: true },
    { id: 'riego', label: 'la boleta de riego o pozo (Irrigación)', required: true },
  ];
  if (state.data.hasVid) {
    items.push({ id: 'inv', label: 'el censo o DJ de viñedos (INV)', required: true });
  }
  if (state.data.hasRenspa) {
    items.push({ id: 'renspa', label: 'la constancia RENSPA (SENASA)', required: true });
  }
  items.push({
    id: 'adicional',
    label: 'documentación adicional si aplica (condóminos, sucesión o planos)',
    required: false,
  });
  return items;
}

function receivedDocIds() {
  return new Set(
    state.documents
      .filter((doc) => doc.officialType && doc.status !== 'metadata-only')
      .map((doc) => doc.officialType)
  );
}

function skippedDocIds() {
  return new Set(Array.isArray(state.skippedDocs) ? state.skippedDocs : []);
}

function nextRequiredDoc() {
  const skipped = skippedDocIds();
  return (
    requiredDocs().find(
      (doc) => doc.required && !receivedDocIds().has(doc.id) && !skipped.has(doc.id)
    ) || null
  );
}

function wantsDeferDoc() {
  return /\b(no la tengo|no lo tengo|no las tengo|no los tengo|no tengo( la| el| ese| esa| ahora| aca| acá)?|despues|mas tarde|seguir con otra|otra cosa|salte(a|alo|amos)|lo mando despues|no ahora|por ahora no|no dispongo|no me da|no esta a mano|no la consigo|podemos seguir|pasamos a otra)\b/.test(
    normalized
  );
}

function skipPendingAndContinue() {
  const current = state.pendingDoc;
  state.skippedDocs = Array.isArray(state.skippedDocs) ? state.skippedDocs : [];
  if (current && current !== 'flags' && !state.skippedDocs.includes(current)) {
    state.skippedDocs.push(current);
  }
  const label = requiredDocs().find((doc) => doc.id === current)?.label || 'ese archivo';
  const next = nextRequiredDoc();
  if (next) {
    state.status = 'archivos';
    state.pendingDoc = next.id;
    return `Dale, ${label} lo dejamos para después. ¿Seguimos con ${next.label}? Si preferís otra cosa, decime.`;
  }
  state.status = 'revision';
  state.siaStep = 'TERMINAR';
  state.pendingDoc = null;
  return `Dale, ${label} queda pendiente. El resto del expediente ya puede ir a revisión demo. Cuando lo tengas, lo mandás y lo sumamos.`;
}

function inferDocType(text) {
  const value = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/\b(constancia|cuit|afip|arca)\b/.test(value)) return 'constancia_cuit';
  if (/\b(escritura|boleto|contrato|locacion|arrendamiento|poder|medieria|comodato|aparceria|fideicomiso)\b/.test(value)) {
    return 'legal';
  }
  if (/\b(inmobiliario|atm|catastro|rentas)\b/.test(value)) return 'inmobiliario';
  if (/\b(riego|pozo|irrigacion)\b/.test(value)) return 'riego';
  if (/\b(inv|vinedo|vid)\b/.test(value)) return 'inv';
  if (/\b(renspa|senasa)\b/.test(value)) return 'renspa';
  if (/\b(adicional|sucesion|condomino|plano)\b/.test(value)) return 'adicional';
  return '';
}

function syncSiaStep() {
  if (state.status === 'revision' || state.status === 'completed') {
    state.siaStep = 'TERMINAR';
    return;
  }
  if (state.status === 'archivos') {
    state.siaStep = 'ARCHIVOS';
    return;
  }
  if (state.locationSaved || !nextMissing()) {
    state.siaStep = 'ESTABLECIMIENTO';
    return;
  }
  const missing = nextMissing();
  state.siaStep = ['establecimiento', 'departamento', 'localidad'].includes(missing) ? 'ESTABLECIMIENTO' : 'TITULAR';
}

function askNextFile() {
  const next = nextRequiredDoc();
  if (!next) {
    state.status = 'revision';
    state.siaStep = 'TERMINAR';
    state.pendingDoc = null;
    return 'Con eso cierran los papeles obligatorios. El expediente queda en revisión demo; en el SIA real lo mira un administrador. Esto no implica validación oficial.';
  }
  state.status = 'archivos';
  state.siaStep = 'ARCHIVOS';
  state.pendingDoc = next.id;
  return `Mandame ${next.label}, en foto o PDF. Recibirlo acá no implica validación oficial.`;
}

function startArchivos() {
  state.status = 'archivos';
  state.siaStep = 'ARCHIVOS';
  if (state.data.hasVid === undefined && state.data.hasRenspa === undefined) {
    state.pendingDoc = 'flags';
    return 'Datos y mapa listos. Ahora los papeles. ¿Tenés viñedo (INV), RENSPA de SENASA, ambos o ninguno?';
  }
  return askNextFile();
}

function parseVidRenspaFlags(text) {
  const value = String(text || '');
  const both =
    /\b(ambos|ambas|los dos|las dos|los 2|las 2)\b/.test(value) ||
    /\b(vid|vinedo|vina|inv)\b.+\b(renspa|senasa)\b/.test(value) ||
    /\b(renspa|senasa)\b.+\b(vid|vinedo|vina|inv)\b/.test(value);
  const none =
    /^(no|ninguno|ninguna|nada|no tengo)$/.test(value) ||
    /\b(ninguno|ninguna)\b/.test(value) ||
    /\bno tengo (ninguno|nada|ni uno)\b/.test(value);
  if (both) return { vid: true, renspa: true, none: false };
  const vid = /\b(vid|vinedo|vina|inv)\b/.test(value);
  const renspa = /\b(renspa|senasa)\b/.test(value);
  if (none && !vid && !renspa) return { vid: false, renspa: false, none: true };
  return { vid, renspa, none: false };
}

function checklistText() {
  const got = receivedDocIds();
  return requiredDocs()
    .filter((doc) => doc.required || got.has(doc.id))
    .map((doc) => `${got.has(doc.id) ? 'listo' : 'falta'} ${doc.label}`)
    .join('. ');
}

function isDocCommand() {
  return /\b(requisitos|documentos|papeles|checklist|que falta|que documentos|que papeles)\b/.test(normalized);
}

function harvestFromText(text) {
  const found = {};
  const email = String(text || '').match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (email && looksLikeEmail(email[0])) found.email = email[0].toLowerCase();

  const cuitMatch = String(text || '').match(/\b\d{2}[-\s.]?\d{8}[-\s.]?\d\b/) || String(text || '').match(/\b\d{11}\b/);
  if (cuitMatch && validCuit(cuitMatch[0])) found.cuit = cuitMatch[0].replace(/\D/g, '');

  const cond = officialCondition(text);
  if (cond && /(titular|usufructuar|locatari|arrendatari|medier|fideicomis|comodatari|aparc|apoderad|propietari)/.test(
    String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  )) {
    found.condicionTierra = cond;
  }

  const phones = String(text || '').match(/\+?\d[\d\s().-]{6,16}\d/g) || [];
  for (const phone of phones) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15 && digits.length !== 11 && digits !== found.cuit) {
      found.telefono = digits;
      break;
    }
  }

  const nameMatch = String(text || '').match(
    /(?:me llamo|razon social(?:\s+es)?|mi nombre(?:\s+es)?)\s+([a-záéíóúñA-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s.]{1,60})/i
  );
  if (nameMatch && hasLetters(nameMatch[1]) && !officialCondition(nameMatch[1])) {
    found.razonSocial = nameMatch[1].trim();
  }

  const farmMatch = String(text || '').match(
    /(?:la finca se llama|el establecimiento se llama|finca se llama|establecimiento se llama)\s+([a-záéíóúñA-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s.]{1,60})/i
  );
  if (farmMatch && hasLetters(farmMatch[1])) {
    found.establecimiento = farmMatch[1].trim();
  }

  return found;
}

function applyHarvest(text) {
  const found = harvestFromText(text);
  Object.entries(found).forEach(([key, value]) => {
    if (String(state.data[key] || '').trim()) return;
    if (key === 'cuit') {
      state.data.cuit = value;
      recordValidation('ARCA', 'cuit_dv', 'DEMO_OK', 'Dígito verificador correcto. Sin cruce oficial con ARCA.');
      recordValidation('ANSES', 'identidad', 'NO_CONECTADO', 'No hay convenio demo con ANSES. El instructivo RUT no exige ANSES.');
      return;
    }
    state.data[key] = value;
  });
  return found;
}

function detectObviousField(value) {
  const trimmed = String(value || '').trim();
  if (validCuit(trimmed)) return 'cuit';
  if (looksLikeEmail(trimmed)) return 'email';
  if (officialCondition(trimmed) && trimmed.split(/\s+/).length <= 3) return 'condicionTierra';
  const digits = trimmed.replace(/\D/g, '');
  if (!hasLetters(trimmed) && digits.length >= 8 && digits.length <= 15 && digits.length !== 11 && !validCuit(trimmed)) {
    return 'telefono';
  }
  return '';
}

function isSmallTalk() {
  if (
    /\b(confirmo|corregir|cambiar|modificar|nuevo registro|cancelar|mapa|ubicacion|perimetro|requisitos|documentos|papeles|constancia|escritura|contrato|renspa|vinedo|vid|inv|ambos|ambas|ninguno|los dos|las dos)\b/.test(
      normalized
    )
  ) {
    return false;
  }
  if (/\d{8,}/.test(input) || /@/.test(input)) return false;
  return (
    /^(hola|holis|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal|que onda)(\s|$)/.test(normalized) ||
    /\b(como estas|como andas|que andas|todo bien vos)\b/.test(normalized) ||
    /^(gracias|muchas gracias|mil gracias)\b/.test(normalized) ||
    /^(quien sos|que haces|que es esto|sos un bot|para que sirve)$/.test(normalized) ||
    /^(bien y vos|aca andamos|aca nomas|tranqui|joya)$/.test(normalized)
  );
}

function opener() {
  if (/\b(como estas|como andas)\b/.test(normalized)) return 'Bien, acá andamos. ';
  if (/^(gracias|muchas gracias|mil gracias)\b/.test(normalized)) return 'De nada. ';
  if (/^(quien sos|que haces|que es esto|sos un bot|para que sirve)$/.test(normalized)) {
    return 'Soy Gabi, te armo el expediente del RUT de Mendoza. ';
  }
  if (/^(hola|holis|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal|que onda)/.test(normalized)) {
    return 'Hola, ¿todo bien? ';
  }
  return 'Seguimos. ';
}

function save(reply, extra = {}) {
  const missing = nextMissing();
  state.step = missing ? fieldOrder.indexOf(missing) + 1 : 9;
  state.updatedAt = Date.now();
  syncSiaStep();
  const spoken = String(reply || '').replace(/^\u200B+/, '');
  const full = BOT_MARK + spoken;
  return [{
    json: {
      ...$json,
      chatId,
      reply: full,
      deterministicReply: full,
      voiceReply: spoken,
      state,
      stateJson: JSON.stringify(state),
      missingField: missing,
      siaStep: state.siaStep,
      ...extra,
    },
  }];
}

if (!chatId) {
  return save('No pude identificar el chat. Mandame el mensaje de nuevo, por texto o por audio.');
}

if (/\b(cancelar|cancela|salir|abandonar)\b/.test(normalized)) {
  state.status = 'cancelled';
  return save('Cancelé este registro. Cuando quieras retomar, escribí “nuevo registro”.');
}

if (/\b(reiniciar|empezar de nuevo|nuevo registro)\b/.test(normalized)) {
  state = JSON.parse(JSON.stringify(EMPTY_STATE));
  return save('Expediente nuevo. ' + promptFor('cuit'));
}

if (isDocCommand()) {
  if (nextMissing() || !state.locationSaved) {
    return save(
      'Primero cierro datos y mapa. Después te pido los archivos del instructivo: constancia de CUIT, documentación legal, inmobiliario y riego.'
    );
  }
  return save(`Según el instructivo: ${checklistText()}. ${askNextFile()}`);
}

if (['image', 'document'].includes(inputType)) {
  const documentType = inputType === 'image' ? 'foto' : 'documento';
  const mediaAvailable = Boolean($json.mediaBase64 || $json.mediaUrl) && !$json.mediaOmitted;
  const mediaId = String($json.messageId || `${documentType}-${Date.now()}`);
  const inArchivos =
    state.status === 'archivos' ||
    state.status === 'revision' ||
    (state.status === 'completed' && !nextMissing() && state.locationSaved);
  const inferred = inferDocType(`${input} ${$json.mediaFileName || ''}`) || (inArchivos && state.pendingDoc !== 'flags' ? state.pendingDoc : '');
  const officialType = inArchivos ? inferred || nextRequiredDoc()?.id || 'adicional' : '';
  if (!state.documents.some((doc) => doc.id === mediaId)) {
    state.documents.push({
      id: mediaId,
      type: documentType,
      officialType: officialType || undefined,
      mimeType: String($json.mediaMimeType || ''),
      fileName: String($json.mediaFileName || ''),
      receivedAt: Date.now(),
      status: mediaAvailable ? 'received-demo' : 'metadata-only',
    });
  }
  if (inArchivos && mediaAvailable && officialType && DOC_PROVIDERS[officialType]) {
    const [provider, check] = DOC_PROVIDERS[officialType];
    recordValidation(provider, check, 'RECIBIDO_DEMO', 'Archivo asociado al expediente. No implica validación oficial.');
  }
  const missing = nextMissing();
  if (!mediaAvailable) {
    return save(
      `Recibí el aviso del ${documentType}, pero no pude descargar el archivo. ¿Lo mandás de nuevo? Mientras tanto seguimos por texto o audio.${missing ? ` ${promptFor(missing)}` : ''}`,
      { mediaReceived: false }
    );
  }
  if (inArchivos) {
    const label = requiredDocs().find((doc) => doc.id === officialType)?.label || 'el archivo';
    return save(
      `Listo, recibí ${documentType === 'foto' ? 'la foto' : 'el documento'} como ${label}. Todavía no implica validación oficial. ${askNextFile()}`,
      { mediaReceived: true }
    );
  }
  return save(
    `Recibí ${documentType === 'foto' ? 'la foto' : 'el documento'} y la asocié al registro de la demo; todavía no implica validación oficial.${missing ? ` ${promptFor(missing)}` : ' Si ya está todo, respondé “confirmo” y cerramos el armado.'}`,
    { mediaReceived: true }
  );
}

if (inputType === 'audio' && !input) {
  return save('No se entendió bien el audio. ¿Lo repetís más cerca o me lo mandás por texto?');
}

const correction = correctionText.match(
  /(?:corregir|cambiar|modificar)\s+(?:el |la |mi )?(cuit|correo|email|mail|razon social|nombre|telefono|condicion|establecimiento|finca|departamento|localidad)(?:\s+(?:a|por|es)\s+(.+))?/
);
if (correction) {
  const aliases = {
    correo: 'email',
    mail: 'email',
    nombre: 'razonSocial',
    'razon social': 'razonSocial',
    telefono: 'telefono',
    condicion: 'condicionTierra',
    finca: 'establecimiento',
  };
  const field = aliases[correction[1]] || correction[1];
  delete state.data[field];
  state.status = 'collecting';
  const inlineValue = String(correction[2] || '').trim();
  if (!inlineValue) return save(`Lo cambiamos ahora. ${promptFor(field)}`);
  return validateAndStore(field, inlineValue, true);
}

function validateAndStore(field, value, correcting = false) {
  applyHarvest(value);
  const detected = detectObviousField(value);
  if (detected && detected !== field && !correcting && String(state.data[field] || '').trim() === '') {
    const missing = nextMissing() || field;
    const taken = labels[detected] || detected;
    return save(`Anoté ${taken}. ${promptFor(missing)}`);
  }

  const digits = value.replace(/\D/g, '');
  if (field === 'cuit') {
    if (!/^\d{11}$/.test(digits) && !state.data.cuit) {
      return save('Ese CUIT no cierra: necesito los 11 dígitos, con o sin guiones.');
    }
    if (!validCuit(state.data.cuit || value)) {
      delete state.data.cuit;
      return save('Ese CUIT no es válido: revisá los 11 dígitos y el dígito verificador.');
    }
    if (!state.data.cuit) {
      state.data.cuit = digits;
      recordValidation('ARCA', 'cuit_dv', 'DEMO_OK', 'Dígito verificador correcto. Sin cruce oficial con ARCA.');
      recordValidation('ANSES', 'identidad', 'NO_CONECTADO', 'No hay convenio demo con ANSES. El instructivo RUT no exige ANSES.');
    }
  } else if (field === 'email') {
    if (!state.data.email) {
      if (!looksLikeEmail(value)) {
        return save('Ese correo parece incompleto. Mandamelo tipo nombre@dominio.com.');
      }
      state.data.email = value.toLowerCase();
    }
  } else if (field === 'telefono') {
    if (!state.data.telefono) {
      if (digits.length < 8 || digits.length > 15) {
        return save('El teléfono parece incompleto. Mandalo con código de área, por ejemplo 2604 o 261.');
      }
      state.data.telefono = digits;
    }
  } else if (field === 'condicionTierra') {
    if (!state.data.condicionTierra) {
      const mapped = officialCondition(normalized || value);
      if (/\b(otra|otro)\b/.test(normalized) && !mapped) {
        return save('Decime cuál: titular, usufructuario, locatario, mediero, fideicomiso, comodatario, aparcero o apoderado.');
      }
      if (!mapped) return save('Decime si sos titular, locatario, usufructuario, mediero u otra condición frente a la tierra.');
      state.data.condicionTierra = mapped;
    }
  } else if (field === 'razonSocial' || field === 'establecimiento') {
    if (!state.data[field]) {
      if (!hasLetters(value) || value.replace(/[\d\s.,/-]/g, '').trim().length < 2) {
        return save(
          field === 'razonSocial'
            ? 'Eso parece un número, no un nombre. Decime la razón social o tu nombre y apellido.'
            : 'Necesito el nombre de la finca o establecimiento, no un número.'
        );
      }
      if (value.trim().length < 2) return save(`Necesito ${labels[field]} para continuar.`);
      state.data[field] = value.trim();
    }
  } else if (field === 'departamento') {
    if (!state.data.departamento) {
      const parts = value.split(/[,/|-]/).map((part) => part.trim()).filter(Boolean);
      if (parts[0] && parts[0].length >= 2) state.data.departamento = parts[0];
      if (parts[1] && parts[1].length >= 2 && !state.data.localidad) state.data.localidad = parts[1];
      if (!state.data.departamento) return save(`Necesito ${labels[field]} para continuar.`);
    }
  } else {
    if (!state.data[field]) {
      if (value.trim().length < 2) return save(`Necesito ${labels[field]} para continuar.`);
      state.data[field] = value.trim();
    }
  }

  const missing = nextMissing();
  if (missing) {
    return save(`${correcting ? 'Dato corregido.' : spokenAck(field)} ${promptFor(missing)}`);
  }
  state.status = 'confirm';
  const d = state.data;
  if (!state.locationSaved) {
    return save(
      `Ya tengo tus datos: CUIT ${d.cuit}, ${d.razonSocial}, ${d.establecimiento} en ${d.localidad}. Te mando un enlace seguro para marcar el GPS y el perímetro; dura 30 minutos. Cuando termines, escribí “ya cargué el mapa”.`,
      { needLanding: true }
    );
  }
  return save(
    `Quedó así: CUIT ${d.cuit}, ${d.razonSocial}, correo ${d.email}, teléfono ${d.telefono}, ${d.condicionTierra}, ${d.establecimiento} en ${d.localidad}, ${d.departamento}. Si te cierra, respondé “confirmo”. Si no, decime qué dato corregir.`
  );
}

if (state.status === 'cancelled') {
  return save('Este registro quedó cancelado. Escribí “nuevo registro” cuando quieras empezar de nuevo.');
}

const justMapped = /\b(ya cargue|ya marque|listo el mapa|ubicacion lista|ya la cargue)\b/.test(normalized);
if (justMapped) {
  state.locationSaved = true;
} else if (/\b(mapa|ubicacion|poligono|perimetro|marcar la finca|cargar ubicacion|enlace)\b/.test(normalized)) {
  return save(
    'Te mando un enlace seguro para marcar el GPS y el perímetro de la finca. Vence en 30 minutos. Cuando termines, volvé y escribí “ya cargué el mapa”.',
    { needLanding: true }
  );
}

if (state.status === 'archivos' && state.pendingDoc === 'flags') {
  const flags = parseVidRenspaFlags(normalized);
  if (!flags.vid && !flags.renspa && !flags.none && !isSmallTalk() && !wantsDeferDoc()) {
    return save('Decime una de estas: viñedo, RENSPA, ambos o ninguno.');
  }
  if (flags.vid || flags.renspa || flags.none) {
    state.data.hasVid = flags.none ? false : flags.vid;
    state.data.hasRenspa = flags.none ? false : flags.renspa;
    return save(askNextFile());
  }
}

if (state.status === 'archivos' && wantsDeferDoc()) {
  return save(skipPendingAndContinue(), { allowAiOverride: true });
}

if (state.status === 'archivos' && inferDocType(normalized) && !wantsDeferDoc()) {
  state.pendingDoc = inferDocType(normalized);
  const label = requiredDocs().find((doc) => doc.id === state.pendingDoc)?.label || 'ese archivo';
  return save(`Lo anoto como ${label}. Mandame la foto o el PDF; recibirlo acá no implica validación oficial.`);
}

if (isSmallTalk()) {
  const missing = nextMissing();
  const finca = String(state.data.establecimiento || '').trim();
  const who = finca || String(state.data.razonSocial || '').trim();
  if (state.status === 'archivos') {
    if (state.pendingDoc === 'flags') {
      return save(opener() + '¿Tenés viñedo, RENSPA, ambos o ninguno?', { allowAiOverride: true });
    }
    const label = requiredDocs().find((doc) => doc.id === state.pendingDoc)?.label || 'el próximo papel';
    return save(
      opener() +
        `Seguimos con tu expediente. El que falta es ${label}. Si no lo tenés a mano, decime y pasamos a otra cosa.`,
      { allowAiOverride: true }
    );
  }
  if (state.status === 'revision') {
    return save(opener() + 'El expediente quedó en revisión demo. Podés mandar un archivo extra o escribir “nuevo registro”.');
  }
  if (state.status === 'completed') {
    return save(opener() + 'El armado ya está cerrado. Si querés, mandá una foto o escribí “nuevo registro”.');
  }
  if (!missing && state.locationSaved) {
    return save(
      opener() +
        (who ? `Ya tengo ${who} cargada. ` : 'Ya tengo tu registro cargado. ') +
        '¿Lo damos por bueno o hay que cambiar algún dato?'
    );
  }
  if (!missing && !state.locationSaved) {
    return save(opener() + 'Me falta que marques la finca en el mapa. Te mando un enlace seguro.', { needLanding: true });
  }
  if (state.step === 0 && missing === 'cuit') {
    state.status = 'collecting';
    return save(opener() + 'Te armo el expediente ahora. ' + promptFor('cuit'));
  }
  return save(opener() + promptFor(missing));
}

if (state.status === 'archivos') {
  const next = nextRequiredDoc();
  if (!next) {
    return save(askNextFile(), { allowAiOverride: true });
  }
  return save(
    `Te leo. No hace falta que mandes ${next.label} ahora si no lo tenés. ¿Lo dejamos para después o preferís seguir con otro papel?`,
    { allowAiOverride: true }
  );
}

if (state.status === 'revision') {
  return save('El expediente ya está en revisión demo. Podés mandar documentación adicional o escribir “nuevo registro”.');
}

if (state.status === 'confirm' || !nextMissing()) {
  if (!state.locationSaved) {
    return save(
      'Ya tengo tus datos. Ahora falta marcar la ubicación y el perímetro de la finca. Te mando un enlace seguro; dura 30 minutos. Cuando termines, escribí “ya cargué el mapa”.',
      { needLanding: true }
    );
  }
  if (/\b(si|confirmo|confirmar|correcto|esta bien|todo bien)\b/.test(normalized)) {
    return save(startArchivos());
  }
  if (/^\s*(corregir|cambiar|modificar)\s*$/.test(normalized)) {
    return save('Decime el dato: CUIT, correo, nombre, teléfono o la finca.');
  }
  if (justMapped) {
    return save('Quedó el mapa. Si te cierra, respondé “confirmo”. Si hay que cambiar un dato, decime cuál.');
  }
  if (state.status === 'completed') {
    return save('El armado demo ya está completo. Podés mandar documentación, corregir un dato o escribir “nuevo registro”.');
  }
  return save('No te seguí del todo. ¿Cerramos el registro o hay que cambiar algún dato? Si está bien, respondé “confirmo”.');
}

const missing = nextMissing();
if (state.step === 0 && missing === 'cuit' && !/\d{11}/.test(input) && !looksLikeEmail(input) && !validCuit(input)) {
  applyHarvest(input);
  if (nextMissing() === 'cuit') {
    state.status = 'collecting';
    return save('Perfecto, te armo el expediente ahora. ' + promptFor('cuit'));
  }
  return save('Anoté lo que ya me diste. ' + promptFor(nextMissing()));
}

return validateAndStore(missing, input);
