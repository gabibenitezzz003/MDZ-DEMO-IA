import { greetingReply } from "@/lib/greeting-reply";
import { wantsListeningCheck, wantsSimpleGreeting } from "@/lib/intent-guards";

export type InstantVoiceReply = {
  spoken: string;
  via: string;
};

/** Respuestas que no necesitan red (~0 ms). */
export function tryInstantVoiceReply(
  raw: string,
  opts?: { engineering?: boolean; turnCount?: number }
): InstantVoiceReply | null {
  const text = raw.trim();
  if (!text) return null;

  if (wantsSimpleGreeting(text)) {
    return {
      spoken: greetingReply(text, opts?.turnCount ?? 0, {
        mode: opts?.engineering ? "engineering" : "producer",
      }),
      via: "instant-greeting",
    };
  }

  if (wantsListeningCheck(text)) {
    return {
      spoken:
        "Sí, te escucho. Decime qué necesitás: un cultivo, el RUT, mapas o lo que busques.",
      via: "instant-mic-check",
    };
  }

  return null;
}
