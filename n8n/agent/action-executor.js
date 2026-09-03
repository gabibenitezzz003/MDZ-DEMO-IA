/**
 * Action Executor — ejecuta herramientas aprobadas por el guardrail.
 */
const {
  BOT_MARK,
  FORMS,
  EMPTY_RELEVAMIENTO,
  EMPTY_NOTES,
  EMPTY_PROFILE,
  EMPTY_SESSION,
  EMPTY_MEMORY,
  submissionFromRelevamiento,
  defaultJson,
} = require('./schemas');

function execActions(actions, ctx) {
  const session = defaultJson(ctx.sessionJson, EMPTY_SESSION);
  const memory = defaultJson(ctx.memoryJson, EMPTY_MEMORY);
  const profile = defaultJson(ctx.profileJson, EMPTY_PROFILE);
  const notes = defaultJson(ctx.notesJson, EMPTY_NOTES);
  let relevamiento = defaultJson(ctx.stateJson, EMPTY_RELEVAMIENTO);
  relevamiento.data = relevamiento.data || {};

  const log = [];
  let submission = null;
  let handoff = null;
  let needInbox = false;
  let resetAll = false;

  for (const action of actions || []) {
    const type = action.type;
    if (type === 'save_note') {
      notes.items = Array.isArray(notes.items) ? notes.items : [];
      notes.items.unshift({
        id: `note-${Date.now().toString(36)}`,
        text: String(action.text).trim(),
        at: Date.now(),
      });
      notes.items = notes.items.slice(0, 50);
      log.push('save_note');
    }
    if (type === 'update_profile') {
      profile.preferences = profile.preferences || {};
      profile.preferences[String(action.key)] = action.value;
      if (action.displayName) profile.displayName = String(action.displayName).trim();
      profile.updatedAt = Date.now();
      log.push('update_profile');
    }
    if (type === 'start_relevamiento') {
      const formKey = String(action.form || action.formKey);
      relevamiento = {
        status: 'collecting',
        formKey,
        data: { ...(action.data || {}) },
        hasPhoto: Boolean(relevamiento.hasPhoto),
        geo: relevamiento.geo || null,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      };
      log.push('start_relevamiento');
    }
    if (type === 'update_relevamiento') {
      if (!relevamiento.formKey && action.formKey) relevamiento.formKey = action.formKey;
      Object.assign(relevamiento.data, action.data || {});
      if (action.hasPhoto) relevamiento.hasPhoto = true;
      if (action.geo) relevamiento.geo = action.geo;
      relevamiento.status = relevamiento.status === 'idle' ? 'collecting' : relevamiento.status;
      relevamiento.updatedAt = Date.now();
      const form = FORMS[relevamiento.formKey];
      if (form) {
        const missing = form.fields.filter((k) => !String(relevamiento.data[k] || '').trim());
        relevamiento.status = missing.length ? 'collecting' : 'confirm';
      }
      log.push('update_relevamiento');
    }
    if (type === 'confirm_relevamiento') {
      submission = submissionFromRelevamiento(relevamiento);
      needInbox = Boolean(submission);
      relevamiento.status = 'completed';
      relevamiento.updatedAt = Date.now();
      log.push('confirm_relevamiento');
      relevamiento = JSON.parse(JSON.stringify(EMPTY_RELEVAMIENTO));
    }
    if (type === 'cancel_relevamiento') {
      relevamiento = JSON.parse(JSON.stringify(EMPTY_RELEVAMIENTO));
      log.push('cancel_relevamiento');
    }
    if (type === 'reset_session') {
      session.turns = [];
      session.pendingBuffer = [];
      relevamiento = JSON.parse(JSON.stringify(EMPTY_RELEVAMIENTO));
      resetAll = true;
      log.push('reset_session');
    }
    if (type === 'handoff_human') {
      handoff = {
        id: `handoff-${Date.now().toString(36)}`,
        chatId: ctx.chatId,
        reason: String(action.reason || 'user_request').trim(),
        summary: String(action.summary || '').trim(),
        relevamientoSnapshot: { ...relevamiento },
        notes: (notes.items || []).slice(0, 5),
        at: Date.now(),
      };
      log.push('handoff_human');
    }
  }

  if (ctx.reply) {
    session.turns = Array.isArray(session.turns) ? session.turns : [];
    session.turns.push({ role: 'assistant', text: String(ctx.reply).slice(0, 2000), at: Date.now() });
    session.turns = session.turns.slice(-24);
  }

  if (ctx.memoryPatch) {
    if (ctx.memoryPatch.summary) memory.summary = String(ctx.memoryPatch.summary).slice(0, 1500);
    if (Array.isArray(ctx.memoryPatch.facts)) {
      memory.facts = [...(memory.facts || []), ...ctx.memoryPatch.facts].slice(-30);
    }
    memory.updatedAt = Date.now();
  }

  return {
    ok: true,
    log,
    sessionJson: JSON.stringify(session),
    memoryJson: JSON.stringify(memory),
    profileJson: JSON.stringify(profile),
    notesJson: JSON.stringify(notes),
    stateJson: JSON.stringify(relevamiento),
    submission,
    needInbox,
    handoff,
    resetAll,
  };
}

if (typeof $json !== 'undefined') {
  const g = $json.guardrail || {};
  if (!g.ok) {
    return [{
      json: {
        ...$json,
        reply: `${BOT_MARK}${g.safeReply}`,
        needInbox: false,
        needHandoff: false,
      },
    }];
  }
  const result = execActions(g.actions, {
    chatId: $json.chatId,
    sessionJson: $json.sessionJson,
    memoryJson: $json.memoryJson,
    profileJson: $json.profileJson,
    notesJson: $json.notesJson,
    stateJson: $json.stateJson,
    reply: g.reply,
    memoryPatch: g.agent?.memory_patch,
  });
  return [{
    json: {
      ...$json,
      ...result,
      reply: `${BOT_MARK}${g.reply}`,
      responseMode: g.responseMode,
      typingMs: g.typingMs,
      voiceReply: g.reply,
      needHandoff: Boolean(result.handoff),
    },
  }];
}

module.exports = { execActions };
