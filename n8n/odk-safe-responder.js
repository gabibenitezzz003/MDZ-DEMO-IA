const chatId = String($json.chatId || '').trim();
const input = String($json.input || $json.messageText || '').trim();
const inputType = String($json.inputType || $json.sourceType || 'text').toLowerCase();
const latRaw = $json.lat ?? $json.latitude;
const lonRaw = $json.lon ?? $json.longitude;
const latIn =
  latRaw === undefined || latRaw === null || latRaw === '' ? NaN : Number(latRaw);
const lonIn =
  lonRaw === undefined || lonRaw === null || lonRaw === '' ? NaN : Number(lonRaw);
const hasMedia = ['image', 'photo', 'document', 'file'].includes(inputType);
const hasCoords =
  Number.isFinite(latIn) &&
  Number.isFinite(lonIn) &&
  Math.abs(latIn) <= 90 &&
  Math.abs(lonIn) <= 180;
const hasLocation = inputType === 'location' || hasCoords;

const normalized = input
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[¿?¡!.,;:]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const BOT_MARK = '\u200B';
const FORMS = {
  olivo: {
    id: 'demo-olivo',
    name: 'Ficha demo · Olivo en campo',
    version: 'sim-1',
    fields: ['departamento', 'estado', 'consociacion', 'cultivosVecinos'],
  },
  visita: {
    id: 'demo-visita',
    name: 'Ficha demo · Visita técnica',
    version: 'sim-1',
    fields: ['departamento', 'cultivo', 'variedad', 'estadio'],
  },
  fincas: {
    id: 'demo-finca',
    name: 'Ficha demo · Finca y cuartel',
    version: 'sim-1',
    fields: ['departamento', 'finca', 'cultivo', 'orientacion'],
  },
};

const EMPTY_STATE = {
  status: 'idle',
  formKey: '',
  data: {},
  hasPhoto: false,
  geo: null,
  updatedAt: 0,
};

let state;
try {
  const raw = $json.state_raw || $json.stateJson || '';
  state = raw ? JSON.parse(String(raw)) : JSON.parse(JSON.stringify(EMPTY_STATE));
} catch {
  state = JSON.parse(JSON.stringify(EMPTY_STATE));
}
state.data = state.data && typeof state.data === 'object' ? state.data : {};
state.hasPhoto = Boolean(state.hasPhoto);
state.geo = state.geo && typeof state.geo === 'object' ? state.geo : null;
state.status = state.status || 'idle';
state.formKey = state.formKey || '';

const DEPTOS = [
  ['guaymallen', 'Guaymallén'],
  ['maipu', 'Maipú'],
  ['lujan', 'Luján de Cuyo'],
  ['san martin', 'San Martín'],
  ['junin', 'Junín'],
  ['rivadavia', 'Rivadavia'],
  ['tunuyan', 'Tunuyán'],
  ['tupungato', 'Tupungato'],
  ['san carlos', 'San Carlos'],
  ['lavalle', 'Lavalle'],
  ['las heras', 'Las Heras'],
  ['godoy cruz', 'Godoy Cruz'],
  ['capital', 'Capital'],
  ['mendoza capital', 'Capital'],
  ['malargue', 'Malargüe'],
  ['san rafael', 'San Rafael'],
  ['general alveolar', 'General Alvear'],
  ['alvear', 'General Alvear'],
];

const ESTADOS = [
  ['abandonado', 'Abandonado'],
  ['inculto', 'Inculto'],
  ['productivo', 'Productivo'],
  ['trinchera', 'Trinchera'],
  ['consociado', 'Consociado'],
  ['puro', 'Puro'],
];

const STAGES = [
  ['floracion', 'Floración'],
  ['brote', 'Brotes'],
  ['yema', 'Yema'],
  ['cuaje', 'Cuaje'],
  ['envero', 'Envero'],
  ['cosecha', 'Cosecha'],
  ['dormancia', 'Dormancia'],
];

const CROPS = [
  ['ciruela industria', 'Ciruela industria'],
  ['ciruelo japones', 'Ciruelo japonés'],
  ['ciruela', 'Ciruela industria'],
  ['duraznero industria', 'Duraznero industria'],
  ['duraznero en fresco', 'Duraznero en fresco'],
  ['durazno', 'Duraznero industria'],
  ['almendro', 'Almendro'],
  ['almendra', 'Almendro'],
  ['nogal', 'Nogal'],
  ['nuez', 'Nogal'],
  ['cerezo', 'Cerezo'],
  ['cereza', 'Cerezo'],
  ['olivo', 'Olivo'],
  ['oliva', 'Olivo'],
  ['vid', 'Vid'],
  ['uva', 'Vid'],
  ['pistacho', 'Pistacho'],
];

function pickLabel(pairs, text) {
  for (const [needle, label] of pairs) {
    if (text.includes(needle)) return label;
  }
  return '';
}

function detectForm(text) {
  if (/(verificar olivo|olivo a verificar)/.test(text)) return 'olivo';
  if (/(olivo|oliva|olivar)/.test(text)) return 'olivo';
  if (/(visita tecnica|\bvisita\b|visitas|estadio|fenolog|floracion|cuaje|envero)/.test(text))
    return 'visita';
  if (/(finca|cuartel)/.test(text)) return 'fincas';
  if (/(certific|equipo|brujula|teledetec)/.test(text)) return 'equipos';
  return '';
}

function harvest(text) {
  const found = {};
  const depto = pickLabel(DEPTOS, text);
  if (depto) found.departamento = depto;
  const estado = pickLabel(ESTADOS, text);
  if (estado) found.estado = estado;
  if (/consocia/.test(text) || estado === 'Consociado') found.consociacion = 'Consociado';
  if (estado === 'Puro' || /\bpuro\b/.test(text)) found.consociacion = found.consociacion || 'Puro';
  const crop = pickLabel(CROPS, text);
  if (crop) {
    if (state.formKey === 'olivo' || detectForm(text) === 'olivo') found.cultivosVecinos = crop;
    else found.cultivo = crop;
  }
  const vecino = text.match(/al lado de ([a-zñ ]{3,24})|junto a ([a-zñ ]{3,24})|con ([a-zñ ]{3,18}) al lado/);
  if (vecino) {
    const raw = (vecino[1] || vecino[2] || vecino[3] || '').trim();
    const mapped = pickLabel(CROPS, raw) || raw;
    if (mapped) found.cultivosVecinos = mapped.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const variedad = text.match(/variedad(?:\s+es)?\s+([a-z0-9 -]{2,30})/);
  if (variedad) found.variedad = variedad[1].trim();
  const estadioNamed = text.match(/estadio(?:\s+es)?\s+([a-z0-9 -]{2,40})/);
  const estadio = pickLabel(STAGES, text) || (estadioNamed ? estadioNamed[1].trim() : '');
  if (estadio) found.estadio = estadio;
  const finca = text.match(/finca(?:\s+se llama)?\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,3})/);
  if (finca && !/fincas y/.test(text)) found.finca = finca[1].trim();
  const ori = text.match(/orientaci[oó]n(?:\s+es)?\s+(norte|sur|este|oeste|ne|no|se|so)/);
  if (ori) found.orientacion = ori[1].toUpperCase();
  const coords = text.match(/(-?\d{1,3}\.\d+)\s*[,; ]\s*(-?\d{1,3}\.\d+)/);
  if (coords) {
    const lat = Number(coords[1]);
    const lon = Number(coords[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      state.geo = { lat, lon, source: 'text' };
    }
  }
  if (found.cultivosVecinos && !found.consociacion) found.consociacion = 'Consociado';
  return found;
}

function applyHarvest(found) {
  for (const [key, value] of Object.entries(found)) {
    if (value && !state.data[key]) state.data[key] = value;
  }
}

function formMeta() {
  return FORMS[state.formKey] || null;
}

function missingFields() {
  const form = formMeta();
  if (!form) return [];
  return form.fields.filter((key) => !String(state.data[key] || '').trim());
}

function promptFor(field) {
  const prompts = {
    departamento: '¿En qué departamento lo viste? Rivadavia, Junín, Tunuyán…',
    estado: '¿Cómo está? Productivo, abandonado, puro, consociado o en trinchera.',
    consociacion: '¿Va solo (puro) o consociado con otro cultivo?',
    cultivosVecinos: '¿Qué hay al lado? Vid, ciruela, durazno…',
    cultivo: '¿Qué cultivo estás visitando?',
    variedad: '¿Qué variedad? Si no la tenés a mano, decime “la salto”.',
    estadio: '¿Qué estadio ves? Brotes, floración, cuaje, envero…',
    finca: '¿Cómo se llama la finca?',
    orientacion: '¿Orientación del cuartel? Norte, sur, este u oeste.',
  };
  return prompts[field] || 'Contame un poco más.';
}

function summaryLines() {
  const form = formMeta();
  const rows = Object.entries(state.data).filter(([, value]) => value);
  const extra = [];
  if (state.hasPhoto) extra.push('foto: recibida');
  if (state.geo) extra.push(`gps: ${state.geo.lat.toFixed(5)}, ${state.geo.lon.toFixed(5)}`);
  return `${form ? form.name : 'Formulario'} · ${rows
    .map(([key, value]) => `${key}: ${value}`)
    .concat(extra)
    .join(' · ')}`;
}

function buildPacket() {
  const form = formMeta();
  if (!form) return '';
  return JSON.stringify(
    {
      simulada: true,
      aviso: 'Ficha de demostración. No es un XForm de Central ni se envía a ningún servidor.',
      fichaId: form.id,
      nombre: form.name,
      version: form.version,
      canal: 'whatsapp-demo',
      datos: state.data,
      foto: state.hasPhoto,
      gps: state.geo,
    },
    null,
    2
  );
}

function save(reply, extra) {
  state.updatedAt = Date.now();
  return {
    ok: true,
    chatId,
    reply: `${BOT_MARK}${reply}`,
    deterministicReply: reply,
    stateJson: JSON.stringify(state),
    formKey: state.formKey || '',
    formId: formMeta()?.id || '',
    status: state.status,
    data: state.data,
    hasPhoto: state.hasPhoto,
    geo: state.geo,
    allowAiOverride: true,
    submission: extra && extra.submission ? extra.submission : null,
    needInbox: Boolean(extra && extra.submission),
  };
}

function startForm(formKey, opener) {
  state.formKey = formKey;
  state.status = 'collecting';
  applyHarvest(harvest(normalized));
  if (hasMedia) state.hasPhoto = true;
  if (hasCoords) state.geo = { lat: latIn, lon: lonIn, source: 'whatsapp' };
  const missing = missingFields();
  if (!missing.length) {
    state.status = 'confirm';
    return save(
      `${opener} Ya tengo esto: ${summaryLines()}. ¿Confirmamos el paquete o corregís algo?`
    );
  }
  return save(`${opener} ${promptFor(missing[0])}`);
}

if (/(cancelar|salir|reiniciar|nuevo relevamiento|otra ficha)/.test(normalized)) {
  state = JSON.parse(JSON.stringify(EMPTY_STATE));
  return [
    {
      json: save(
        'Listo, dejamos esa ficha. ¿Olivo encontrado, visita técnica o finca y cuartel?'
      ),
    },
  ];
}

if (/(certific|equipo|brujula|teledetec)/.test(normalized) && !state.formKey) {
  return [
    {
      json: save(
        'Eso en la vida real pide sensores del celular. En esta demo te armo una ficha simulada de olivo o de visita, conversando. ¿Cuál cargamos?'
      ),
    },
  ];
}

if (state.status === 'idle' || !state.formKey) {
  const formKey = detectForm(normalized);
  if (formKey === 'equipos') {
    return [
      {
        json: save(
          'Eso pide sensores. Por WhatsApp te armo una ficha simulada de olivo o de visita: hablás como en el campo. ¿Olivo o visita?'
        ),
      },
    ];
  }
  if (formKey) {
    const openers = {
      olivo: 'Dale, ficha simulada de olivo.',
      visita: 'Dale, ficha simulada de visita.',
      fincas: 'Dale, ficha simulada de finca.',
    };
    return [{ json: startForm(formKey, openers[formKey]) }];
  }
  if (/(hola|buenas|como estas|que haces|ayuda|campo|formulario)/.test(normalized)) {
    return [
      {
        json: save(
          'Acá no rellenás casilleros. Contame como si estuvieras en la finca: “encontré un olivo abandonado en Rivadavia, al lado de vid” o “visita de ciruela en floración en Tunuyán”. Yo armo el paquete. Foto y ubicación si las tenés.'
        ),
      },
    ];
  }
  return [
    {
      json: save(
        'No te entendí el formulario. Decime olivo encontrado, visita técnica o finca y cuartel. Una frase suelta alcanza.'
      ),
    },
  ];
}

applyHarvest(harvest(normalized));
if (hasMedia) state.hasPhoto = true;
if (hasCoords) state.geo = { lat: latIn, lon: lonIn, source: 'whatsapp' };

if (state.status === 'confirm') {
  if (/(confirmo|confirmar|\bsi\b|\bdale\b|enviar|manda|\blisto\b|\bok\b|okay)/.test(normalized)) {
    const form = formMeta();
    const xml = buildPacket();
    const submission = {
      id: `campo-${Date.now().toString(36)}`,
      formId: form.id,
      formName: form.name,
      version: form.version,
      channel: 'whatsapp-demo',
      data: { ...state.data },
      xml,
      hasPhoto: state.hasPhoto,
      geo: state.geo,
      createdAt: Date.now(),
      note: 'Ficha simulada de demostración. No es un formulario de Central.',
    };
    state.status = 'completed';
    const reply = save(
      `Ficha simulada lista: ${form.name}. Quedó en la bandeja de la demo. No es el XForm real ni se mandó a ningún servidor. Si querés otra, decime “nuevo relevamiento”.`,
      { submission }
    );
    state = JSON.parse(JSON.stringify(EMPTY_STATE));
    reply.stateJson = JSON.stringify(state);
    reply.status = 'completed';
    return [{ json: reply }];
  }
  if (/(no|correg|cambia|modific)/.test(normalized)) {
    state.status = 'collecting';
    return [{ json: save('Decime qué cambio. Por ejemplo: “el departamento es Junín”.') }];
  }
  if (hasMedia) state.hasPhoto = true;
  if (hasCoords) state.geo = { lat: latIn, lon: lonIn, source: 'whatsapp' };
  return [
    {
      json: save(
        `Quedó así: ${summaryLines()}. Respondé “confirmo” y lo dejo en la bandeja, o decime el dato a corregir.`
      ),
    },
  ];
}

if (/(la salto|saltear|despues|no la tengo|sin variedad)/.test(normalized)) {
  const missing = missingFields();
  if (missing[0] === 'variedad') state.data.variedad = 'Sin dato';
  if (missing[0] === 'cultivosVecinos') state.data.cultivosVecinos = 'Sin dato';
  if (missing[0] === 'orientacion') state.data.orientacion = 'Sin dato';
}

const missing = missingFields();
if (!missing.length) {
  state.status = 'confirm';
  const extras = [];
  if (!state.hasPhoto) extras.push('Si tenés una foto, mandala.');
  if (!state.geo) extras.push('Si podés, compartí la ubicación.');
  return [
    {
      json: save(
        `Anoté esto: ${summaryLines()}. ${extras.join(' ')} ¿Confirmamos el envío?`
      ),
    },
  ];
}

if (hasMedia) {
  return [
    {
      json: save(`Foto anotada. ${promptFor(missing[0])}`),
    },
  ];
}
if (hasLocation) {
  return [
    {
      json: save(`Ubicación anotada. ${promptFor(missing[0])}`),
    },
  ];
}

return [{ json: save(`Bien. ${promptFor(missing[0])}`) }];
