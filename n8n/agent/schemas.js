/** Constantes de dominio — compartidas por context, guardrail y executor. */

const BOT_MARK = '\u200B';

const REDIS = {
  dedupe: (id) => `wa:dedupe:${id}`,
  session: (chatId) => `wa:session:${chatId}`,
  memory: (chatId) => `wa:memory:${chatId}`,
  profile: (chatId) => `wa:profile:${chatId}`,
  notes: (chatId) => `wa:notes:${chatId}`,
  state: (chatId) => `wa:state:${chatId}`,
  buffer: (chatId) => `wa:buffer:${chatId}`,
  handoff: (chatId) => `wa:handoff:${chatId}`,
};

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
  finca: {
    id: 'demo-finca',
    name: 'Ficha demo · Finca y cuartel',
    version: 'sim-1',
    fields: ['departamento', 'finca', 'cultivo', 'orientacion'],
  },
};

const ALLOWED_ACTIONS = new Set([
  'save_note',
  'get_notes',
  'update_profile',
  'get_profile',
  'start_relevamiento',
  'update_relevamiento',
  'confirm_relevamiento',
  'cancel_relevamiento',
  'get_current_state',
  'reset_session',
  'handoff_human',
]);

const EMPTY_SESSION = {
  turns: [],
  lastInputAt: 0,
  pendingBuffer: [],
};

const EMPTY_MEMORY = {
  summary: '',
  facts: [],
  updatedAt: 0,
};

const EMPTY_PROFILE = {
  preferences: {
    language: 'es-AR',
    voice: true,
    response_mode: 'auto',
  },
  displayName: '',
  updatedAt: 0,
};

const EMPTY_NOTES = { items: [] };

const EMPTY_RELEVAMIENTO = {
  status: 'idle',
  formKey: '',
  data: {},
  hasPhoto: false,
  geo: null,
  startedAt: 0,
  updatedAt: 0,
};

function defaultJson(raw, fallback) {
  if (!raw) return JSON.parse(JSON.stringify(fallback));
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : JSON.parse(JSON.stringify(fallback));
  } catch {
    return JSON.parse(JSON.stringify(fallback));
  }
}

function buildPacket(form, relevamiento) {
  return JSON.stringify(
    {
      simulada: true,
      aviso: 'Ficha de demostración. No es un XForm de Central ni se envía a ningún servidor.',
      fichaId: form.id,
      nombre: form.name,
      version: form.version,
      canal: 'whatsapp-demo-agent',
      datos: relevamiento.data,
      foto: relevamiento.hasPhoto,
      gps: relevamiento.geo,
    },
    null,
    2
  );
}

function submissionFromRelevamiento(relevamiento) {
  const form = FORMS[relevamiento.formKey];
  if (!form) return null;
  const xml = buildPacket(form, relevamiento);
  return {
    id: `campo-${Date.now().toString(36)}`,
    formId: form.id,
    formName: form.name,
    version: form.version,
    channel: 'whatsapp-demo-agent',
    data: { ...relevamiento.data },
    xml,
    hasPhoto: Boolean(relevamiento.hasPhoto),
    geo: relevamiento.geo,
    createdAt: Date.now(),
    note: 'Ficha simulada vía agente conversacional. No es un formulario de Central.',
  };
}

module.exports = {
  BOT_MARK,
  REDIS,
  FORMS,
  ALLOWED_ACTIONS,
  EMPTY_SESSION,
  EMPTY_MEMORY,
  EMPTY_PROFILE,
  EMPTY_NOTES,
  EMPTY_RELEVAMIENTO,
  defaultJson,
  buildPacket,
  submissionFromRelevamiento,
};
