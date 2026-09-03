/**
 * Context Engine — fusiona sesión, memoria, perfil, notas y relevamiento.
 * Entrada n8n: $json con chatId, input, inputType, lat, lon, hasPhoto + blobs Redis.
 */
const {
  EMPTY_SESSION,
  EMPTY_MEMORY,
  EMPTY_PROFILE,
  EMPTY_NOTES,
  EMPTY_RELEVAMIENTO,
  FORMS,
  defaultJson,
} = require('./schemas');

const DEBOUNCE_MS = 1200;
const MAX_TURNS = 24;

function normalizeInput(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pushTurn(session, role, text) {
  session.turns = Array.isArray(session.turns) ? session.turns : [];
  session.turns.push({ role, text: String(text || '').slice(0, 2000), at: Date.now() });
  session.turns = session.turns.slice(-MAX_TURNS);
}

function mergeInboundBuffer(session, input, inputType, now) {
  session.pendingBuffer = Array.isArray(session.pendingBuffer) ? session.pendingBuffer : [];
  if (inputType === 'text' && input) {
    session.pendingBuffer.push({ text: input, at: now });
  }
  const cutoff = now - DEBOUNCE_MS;
  session.pendingBuffer = session.pendingBuffer.filter((row) => row.at >= cutoff - 5000);
  const recent = session.pendingBuffer.filter((row) => row.at >= cutoff);
  const combined = recent.map((row) => row.text).join(' ').replace(/\s+/g, ' ').trim();
  const words = combined.split(/\s+/).filter(Boolean);
  const isShortFragment = words.length <= 2 && !/[.!?]$/.test(combined);
  const shouldWait =
    inputType === 'text' &&
    input &&
    isShortFragment &&
    recent.length >= 1 &&
    now - recent[0].at < DEBOUNCE_MS;
  return { combined: combined || input, shouldWait, waitMs: DEBOUNCE_MS };
}

function buildContextPayload(json) {
  const chatId = String(json.chatId || '').trim();
  const input = String(json.input || json.messageText || '').trim();
  const inputType = String(json.inputType || json.sourceType || 'text').toLowerCase();
  const now = Date.now();

  const session = defaultJson(json.session_raw, EMPTY_SESSION);
  const memory = defaultJson(json.memory_raw, EMPTY_MEMORY);
  const profile = defaultJson(json.profile_raw, EMPTY_PROFILE);
  const notes = defaultJson(json.notes_raw, EMPTY_NOTES);
  const relevamiento = defaultJson(json.state_raw, EMPTY_RELEVAMIENTO);

  relevamiento.data = relevamiento.data && typeof relevamiento.data === 'object' ? relevamiento.data : {};
  relevamiento.hasPhoto = Boolean(relevamiento.hasPhoto || json.hasPhoto);
  if (json.geo && typeof json.geo === 'object') relevamiento.geo = json.geo;
  if (json.lat != null && json.lon != null && !Number.isNaN(Number(json.lat))) {
    relevamiento.geo = { lat: Number(json.lat), lon: Number(json.lon), source: 'whatsapp' };
  }
  if (['image', 'photo'].includes(inputType)) relevamiento.hasPhoto = true;

  const { combined, shouldWait, waitMs } = mergeInboundBuffer(session, input, inputType, now);
  if (shouldWait) {
    session.lastInputAt = now;
    return {
      ok: true,
      chatId,
      debounce: true,
      waitMs,
      sessionJson: JSON.stringify(session),
      reply: null,
    };
  }

  const effectiveInput = combined || input;
  if (effectiveInput || inputType !== 'text') {
    pushTurn(session, 'user', effectiveInput || `[${inputType}]`);
  }
  session.lastInputAt = now;
  session.pendingBuffer = [];

  const formMeta = relevamiento.formKey ? FORMS[relevamiento.formKey] : null;
  const recentTurns = session.turns.slice(-8).map((t) => `${t.role}: ${t.text}`).join('\n');

  return {
    ok: true,
    chatId,
    debounce: false,
    input: effectiveInput,
    inputType,
    normalized: normalizeInput(effectiveInput),
    session,
    memory,
    profile,
    notes,
    relevamiento,
    formMeta,
    contextBlock: {
      chatId,
      input: effectiveInput,
      inputType,
      relevamiento: {
        status: relevamiento.status,
        formKey: relevamiento.formKey,
        formId: formMeta?.id || '',
        formName: formMeta?.name || '',
        data: relevamiento.data,
        hasPhoto: relevamiento.hasPhoto,
        geo: relevamiento.geo,
      },
      profile: profile.preferences || {},
      displayName: profile.displayName || '',
      memorySummary: memory.summary || '',
      memoryFacts: (memory.facts || []).slice(-12),
      notes: (notes.items || []).slice(-8),
      recentTurns,
      domainRules: {
        simulatedOnly: true,
        noCentralWrite: true,
        forms: Object.keys(FORMS),
      },
    },
    sessionJson: JSON.stringify(session),
    memoryJson: JSON.stringify(memory),
    profileJson: JSON.stringify(profile),
    notesJson: JSON.stringify(notes),
    stateJson: JSON.stringify(relevamiento),
  };
}

if (typeof $json !== 'undefined') {
  const out = buildContextPayload($json);
  if (out.debounce) {
    return [{ json: { ...$json, ...out, sessionJson: out.sessionJson } }];
  }
  return [{ json: { ...$json, ...out } }];
}

module.exports = { buildContextPayload, normalizeInput, DEBOUNCE_MS };
