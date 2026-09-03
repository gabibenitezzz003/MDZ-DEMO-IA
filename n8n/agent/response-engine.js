/**
 * Response Engine — timing, modo voz, anti-loop.
 */
const { BOT_MARK } = require('./schemas');

function wantsVoice(input, profile, agentMode) {
  if (agentMode === 'text') return false;
  if (agentMode === 'text_and_voice') return true;
  const prefs = profile?.preferences || {};
  if (prefs.voice === false) return false;
  const said = String(input || '').toLowerCase();
  return /\b(decime|contame|hablame|por voz|mandame audio)\b/.test(said);
}

function composeResponse(ctx) {
  const reply = String(ctx.reply || '').trim();
  const mark = reply.startsWith(BOT_MARK) ? '' : BOT_MARK;
  let typingMs = Number(ctx.typingMs);
  if (!Number.isFinite(typingMs)) typingMs = reply.length > 140 ? 350 : 0;

  const responseMode = wantsVoice(ctx.input, ctx.profile, ctx.responseMode)
    ? 'text_and_voice'
    : 'text';

  return {
    ok: true,
    chatId: ctx.chatId,
    reply: `${mark}${reply}`,
    voiceReply: reply.replace(/^\u200B+/, ''),
    responseMode,
    typingMs: Math.min(Math.max(typingMs, 0), 1200),
    sendText: true,
    sendVoice: responseMode === 'text_and_voice',
  };
}

if (typeof $json !== 'undefined') {
  const profile = JSON.parse($json.profileJson || '{}');
  const out = composeResponse({
    chatId: $json.chatId,
    reply: $json.reply,
    input: $json.input,
    profile,
    responseMode: $json.responseMode,
    typingMs: $json.typingMs,
  });
  return [{ json: { ...$json, ...out } }];
}

module.exports = { composeResponse, wantsVoice };
