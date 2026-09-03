/**
 * Guardrail — valida salida JSON del agente antes de ejecutar acciones.
 */
const { ALLOWED_ACTIONS, FORMS } = require('./schemas');

const CONFIRM_WORDS =
  /\b(confirmo|confirmar|dale mandalo|manda|enviar|listo cerralo|ok confirmo)\b/i;

function stripMarkdownFence(text) {
  return String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseAgentJson(raw) {
  const cleaned = stripMarkdownFence(raw);
  if (!cleaned) return { ok: false, error: 'empty_agent_output' };
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'not_object' };
    return { ok: true, agent: parsed };
  } catch {
    return { ok: false, error: 'invalid_json', fallbackReply: cleaned.slice(0, 500) };
  }
}

function missingFields(formKey, data) {
  const form = FORMS[formKey];
  if (!form) return ['formKey'];
  return form.fields.filter((key) => !String(data?.[key] || '').trim());
}

function validateAction(action, ctx) {
  if (!action || typeof action !== 'object') return { ok: false, reason: 'action_invalid' };
  const type = String(action.type || '').trim();
  if (!ALLOWED_ACTIONS.has(type)) return { ok: false, reason: 'action_not_allowed', type };

  if (type === 'save_note' && !String(action.text || '').trim()) {
    return { ok: false, reason: 'note_empty' };
  }
  if (type === 'update_profile' && !action.key) {
    return { ok: false, reason: 'profile_key_missing' };
  }
  if (type === 'start_relevamiento') {
    const form = String(action.form || action.formKey || '').trim();
    if (!FORMS[form]) return { ok: false, reason: 'unknown_form', form };
  }
  if (type === 'confirm_relevamiento') {
    const rel = ctx.relevamiento || {};
    if (rel.status !== 'confirm' && rel.status !== 'collecting') {
      return { ok: false, reason: 'nothing_to_confirm' };
    }
    if (!FORMS[rel.formKey]) return { ok: false, reason: 'no_active_form' };
    const missing = missingFields(rel.formKey, rel.data);
    if (missing.length) return { ok: false, reason: 'missing_fields', missing };
    const userText = String(ctx.input || '');
    if (!CONFIRM_WORDS.test(userText)) {
      return { ok: false, reason: 'user_did_not_confirm' };
    }
  }
  if (type === 'handoff_human' && !String(action.summary || action.reason || '').trim()) {
    return { ok: false, reason: 'handoff_needs_summary' };
  }
  return { ok: true, type };
}

function validateAgentOutput(agent, ctx) {
  const reply = String(agent.reply || '').trim();
  if (!reply) return { ok: false, error: 'empty_reply' };

  const blocked = [
    /agriencuestas\.mendoza\.gov\.ar/i,
    /identif_olivos/i,
    /Feno26-/i,
    /qued[oó] validado oficialmente/i,
    /enviado a central/i,
    /xform real/i,
  ];
  for (const pattern of blocked) {
    if (pattern.test(reply)) return { ok: false, error: 'domain_violation', pattern: String(pattern) };
  }

  const actions = Array.isArray(agent.actions) ? agent.actions : [];
  if (actions.length > 8) return { ok: false, error: 'too_many_actions' };

  const approved = [];
  const rejected = [];
  for (const action of actions) {
    const check = validateAction(action, ctx);
    if (check.ok) approved.push(action);
    else rejected.push({ action, ...check });
  }

  const responseMode = agent.response_mode === 'text_and_voice' ? 'text_and_voice' : 'text';
  let typingMs = Number(agent.typing_ms);
  if (!Number.isFinite(typingMs) || typingMs < 0) typingMs = reply.length > 120 ? 400 : 0;
  if (typingMs > 1200) typingMs = 1200;

  return {
    ok: true,
    reply,
    responseMode,
    typingMs,
    actions: approved,
    rejected,
    silent: Boolean(agent.silent) || (reply.length <= 12 && /^(ok|dale|perfecto|listo|👍)/i.test(reply)),
  };
}

function guardrailPipeline(agentRaw, ctx) {
  const parsed = parseAgentJson(agentRaw);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
      safeReply:
        'Uy, me trabé un segundo. ¿Me lo repetís? Si querés seguimos con el relevamiento o anoto algo.',
    };
  }
  const validated = validateAgentOutput(parsed.agent, ctx);
  if (!validated.ok) {
    return {
      ok: false,
      error: validated.error,
      safeReply:
        'Prefiero no inventar nada. Contame de nuevo qué querés cargar o si confirmamos lo que ya tenemos.',
    };
  }
  return { ok: true, ...validated, agent: parsed.agent };
}

if (typeof $json !== 'undefined') {
  const ctx = {
    input: $json.input,
    relevamiento: $json.relevamiento || JSON.parse($json.stateJson || '{}'),
  };
  const result = guardrailPipeline($json.agentRaw || $json.output || '', ctx);
  return [{ json: { ...$json, guardrail: result } }];
}

module.exports = { guardrailPipeline, parseAgentJson, validateAgentOutput, validateAction };
