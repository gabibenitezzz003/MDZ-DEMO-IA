"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSessionId, useSessionReady } from "@/components/SessionProvider";
import { dispatchAgentEvent } from "@/lib/agent-event-client";
import type { AgentEvent } from "@/lib/types";
import { isLikelyNoiseTranscript } from "@/lib/noise-transcript";
import { openOfficialFromUserGesture } from "@/lib/official-tab";
import { createVoiceEngine, voiceRuntimeFromEnv } from "@/lib/voice/factory";
import type { VoiceEngine } from "@/lib/voice/types";
import { buildWhatsAppRutUrl } from "@/lib/whatsapp-rut";
import { readBrowserPageContext } from "@/lib/page-context";
import {
  estimateSpeechMs,
  isLikelyUserBargeIn,
  isNearDuplicateHeard,
  isParaphraseOfAssistant,
  looksLikeEcho,
  normalizeBargeUtterance,
  shouldAcceptVoiceTranscript,
  shouldStopTtsOnInterim,
} from "@/lib/voice-stt-guards";

type Message = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Demo guiada",
  "Quiero el RUT por WhatsApp",
  "Llevame a ciruela",
  "Mapas agrícolas",
  "Vista ingeniería",
  "Dónde estoy",
];

const WHATSAPP_SUGGESTION = "Quiero el RUT por WhatsApp";

function voiceErrorForUser(raw: string): string {
  if (/STT: network/i.test(raw)) return raw;
  if (/TTS|voz|audio/i.test(raw)) {
    return "No pude reproducir la voz. Probá de nuevo.";
  }
  if (/STT|dictado|transcri/i.test(raw)) {
    return "No te escuché bien. Probá de nuevo.";
  }
  return "Algo falló. Probá de nuevo.";
}

export function VoiceAssistant() {
  const sessionId = useSessionId();
  const sessionReady = useSessionReady();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [log, setLog] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hola. Tocá el micrófono o escribí. Te llevo a cualquier sección y abro el sitio oficial si lo pedís.",
    },
  ]);
  const engineRef = useRef<VoiceEngine | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const lastUserTextRef = useRef<string>("");
  const lastSpokenRef = useRef<string>("");
  const echoGuardUntilRef = useRef(0);
  const busyCountRef = useRef(0);
  const thinkingRef = useRef(false);
  const turnGenRef = useRef(0);
  const lastBargeAtRef = useRef(0);
  const lastBargeCutAtRef = useRef(0);
  const listenAfterSpeakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const BARGE_PREFIX = "Perfecto, seguimos con eso. ";

  const stopSpeaking = useCallback(() => {
    engineRef.current?.stopSpeaking();
  }, []);

  const stopListening = useCallback(() => {
    engineRef.current?.stopListening();
  }, []);

  const startListening = useCallback(() => {
    if (!engineRef.current && typeof window !== "undefined") {
      engineRef.current = createVoiceEngine(voiceRuntimeFromEnv());
      engineRef.current.onStateChange = (s) => setListening(s.listening);
      engineRef.current.onError = (err) =>
        setLog((prev) => [...prev, { role: "assistant", text: voiceErrorForUser(err) }]);
    }
    engineRef.current?.resumeAudioContext?.();
    engineRef.current?.startListening();
  }, []);

  const speak = useCallback(
    (
      text: string,
      onEnd?: () => void,
      opts?: { fast?: boolean; audioBase64?: string; audioMime?: string }
    ) => {
      lastSpokenRef.current = text;
      echoGuardUntilRef.current =
        Date.now() + estimateSpeechMs(text) + 2000;
      engineRef.current?.speak(text, onEnd, opts);
    },
    []
  );

  const triggerBargeCut = useCallback(() => {
    const now = Date.now();
    if (now - lastBargeCutAtRef.current < 400) return;
    lastBargeCutAtRef.current = now;

    if (listenAfterSpeakTimerRef.current) {
      clearTimeout(listenAfterSpeakTimerRef.current);
      listenAfterSpeakTimerRef.current = null;
    }
    stopSpeaking();
    echoGuardUntilRef.current = 0;
  }, [stopSpeaking]);

  const scheduleListenAfterSpeak = useCallback(() => {
    if (listenAfterSpeakTimerRef.current) {
      clearTimeout(listenAfterSpeakTimerRef.current);
    }
    stopListening();
    listenAfterSpeakTimerRef.current = setTimeout(() => {
      listenAfterSpeakTimerRef.current = null;
      echoGuardUntilRef.current = Date.now() + 700;
      if (!engineRef.current?.isSpeaking() && !thinkingRef.current) {
        startListening();
      }
    }, 500);
  }, [startListening, stopListening]);

  const rejectHeard = useCallback(
    (text: string, opts?: { fromBarge?: boolean }) => {
      const spoken = lastSpokenRef.current;
      const trimmed = text.trim();
      if (!trimmed) return true;
      if (isLikelyNoiseTranscript(trimmed)) return true;
      const inEchoGuard = Date.now() < echoGuardUntilRef.current;
      if (
        !shouldAcceptVoiceTranscript(trimmed, spoken, {
          fromBarge: opts?.fromBarge,
          inEchoGuard,
        })
      ) {
        return true;
      }
      if (
        !opts?.fromBarge &&
        (looksLikeEcho(trimmed, spoken) ||
          isParaphraseOfAssistant(trimmed, spoken))
      ) {
        return true;
      }
      return false;
    },
    []
  );

  const handleText = useCallback(
    async (text: string, opts?: { fromBarge?: boolean; fromChip?: boolean }) => {
      if (!sessionReady || !sessionId || !text.trim()) {
        if (!sessionReady) {
          setLog((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "Esperá un segundo, estoy conectando la sesión…",
            },
          ]);
        }
        return;
      }

      const trimmed = text.trim();
      const fromBarge = opts?.fromBarge === true;
      if (fromBarge) {
        const now = Date.now();
        if (now - lastBargeAtRef.current < 800) return;
        lastBargeAtRef.current = now;
      }

      if (rejectHeard(trimmed, { fromBarge })) return;

      const engine = engineRef.current;
      const wasSpeaking = engine?.isSpeaking() ?? false;
      const wasThinking = thinkingRef.current;

      if (!fromBarge && !opts?.fromChip) {
        if (
          trimmed === lastUserTextRef.current &&
          trimmed.length < 40 &&
          !wasSpeaking &&
          !wasThinking
        ) {
          return;
        }
      }

      if (
        !fromBarge &&
        isNearDuplicateHeard(trimmed, lastUserTextRef.current)
      ) {
        return;
      }

      fetchAbortRef.current?.abort();
      stopSpeaking();
      echoGuardUntilRef.current = 0;

      const myTurn = ++turnGenRef.current;
      lastUserTextRef.current = trimmed;
      const myBusy = ++busyCountRef.current;
      thinkingRef.current = true;
      setBusy(true);
      setLog((prev) => [...prev, { role: "user", text: trimmed }]);
      setInput("");

      const controller = new AbortController();
      fetchAbortRef.current = controller;

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          credentials: "same-origin",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            text: trimmed,
            context: readBrowserPageContext(),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          reply?: string;
          spoken?: string;
          fastTts?: boolean;
          audioBase64?: string;
          audioMime?: string;
          error?: string;
          event?: AgentEvent;
          startTour?: boolean | "engineering" | "producer";
        };

        if (myTurn !== turnGenRef.current) return;

        if (!res.ok || data.ok === false) {
          const msg =
            res.status === 401
              ? "La sesión expiró. Recargá la página (F5) e intentá de nuevo."
              : data.error || `Error del servidor (${res.status})`;
          throw new Error(msg);
        }

        let reply = data.reply || data.spoken || "Listo.";
        if (
          (fromBarge || wasSpeaking || wasThinking) &&
          !reply.startsWith(BARGE_PREFIX)
        ) {
          reply = `${BARGE_PREFIX}${reply}`;
        }
        setLog((prev) => [...prev, { role: "assistant", text: reply }]);

        if (opts?.fromChip && data.event?.action === "open_whatsapp") {
          const wa =
            (typeof data.event.target === "string" && data.event.target) ||
            buildWhatsAppRutUrl();
          if (wa) openOfficialFromUserGesture(wa);
        }

        dispatchAgentEvent(data.event);

        if (reply) {
          speak(
            reply,
            () => {
              if (myTurn !== turnGenRef.current) return;
              echoGuardUntilRef.current = Date.now() + 700;
              scheduleListenAfterSpeak();
            },
            {
              fast: data.fastTts === true,
              audioBase64: data.audioBase64,
              audioMime: data.audioMime,
            }
          );
        } else {
          scheduleListenAfterSpeak();
        }
      } catch (err) {
        if (controller.signal.aborted || myTurn !== turnGenRef.current) return;
        setLog((prev) => [
          ...prev,
          { role: "assistant", text: `Error: ${String(err)}` },
        ]);
        scheduleListenAfterSpeak();
      } finally {
        if (myTurn !== turnGenRef.current) return;
        if (myBusy === busyCountRef.current) {
          thinkingRef.current = false;
          setBusy(false);
        }
      }
    },
    [
      sessionId,
      sessionReady,
      pathname,
      speak,
      scheduleListenAfterSpeak,
      stopListening,
      stopSpeaking,
      rejectHeard,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const engine =
      engineRef.current ?? createVoiceEngine(voiceRuntimeFromEnv());
    engineRef.current = engine;
    engine.onStateChange = (s) => {
      setListening(s.listening);
    };
    engine.onBargeIn = () => {
      const now = Date.now();
      if (now - lastBargeCutAtRef.current < 400) return;
      lastBargeCutAtRef.current = now;
      if (listenAfterSpeakTimerRef.current) {
        clearTimeout(listenAfterSpeakTimerRef.current);
        listenAfterSpeakTimerRef.current = null;
      }
      echoGuardUntilRef.current = 0;
    };
    engine.onTranscript = (text, isFinal) => {
      const engineLive = engineRef.current;
      if (!engineLive) return;
      const speaking = engineLive.isSpeaking();
      const thinking = thinkingRef.current;
      const spoken = lastSpokenRef.current;
      const trimmed = text.trim();

      if (speaking || thinking) {
        if (!isFinal) {
          if (speaking && shouldStopTtsOnInterim(trimmed, spoken)) {
            triggerBargeCut();
          }
          return;
        }

        if (!isLikelyUserBargeIn(trimmed, spoken)) return;
        if (rejectHeard(trimmed, { fromBarge: true })) return;

        const core = normalizeBargeUtterance(trimmed);
        const toSend = core.length >= 3 ? core : trimmed;

        turnGenRef.current += 1;
        fetchAbortRef.current?.abort();
        stopSpeaking();
        echoGuardUntilRef.current = 0;
        void handleText(toSend, { fromBarge: true });
        return;
      }

      if (!isFinal) return;
      if (rejectHeard(trimmed)) return;
      void handleText(trimmed);
    };
    engine.onError = (err) => {
      if (engine.isSpeaking()) return;
      if (/STT: network/i.test(err)) {
        window.setTimeout(() => {
          if (!engine.isSpeaking() && !engine.isListening()) {
            engine.startListening();
          }
        }, 500);
        return;
      }
      setLog((prev) => [...prev, { role: "assistant", text: voiceErrorForUser(err) }]);
    };
  }, [handleText, rejectHeard, stopSpeaking, triggerBargeCut]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [log]);

  useEffect(() => {
    return () => {
      if (listenAfterSpeakTimerRef.current) {
        clearTimeout(listenAfterSpeakTimerRef.current);
      }
      fetchAbortRef.current?.abort();
      engineRef.current?.destroy?.();
      engineRef.current = null;
    };
  }, []);

  const toggleMic = useCallback(() => {
    if (!sessionReady) {
      setLog((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Esperá un momento, estoy iniciando la sesión…",
        },
      ]);
      return;
    }
    if (!engineRef.current) {
      startListening();
      return;
    }
    if (engineRef.current.isListening()) {
      engineRef.current.stopListening();
    } else {
      turnGenRef.current += 1;
      fetchAbortRef.current?.abort();
      stopSpeaking();
      engineRef.current.startListening();
    }
  }, [sessionReady, startListening, stopSpeaking]);

  const runSuggestion = useCallback(
    (s: string) => {
      engineRef.current?.resumeAudioContext?.();
      if (s === WHATSAPP_SUGGESTION) {
        const wa = buildWhatsAppRutUrl();
        if (wa) openOfficialFromUserGesture(wa);
      }
      void handleText(s, { fromChip: s === WHATSAPP_SUGGESTION });
    },
    [handleText]
  );

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      engineRef.current?.resumeAudioContext?.();
      void handleText(input);
    },
    [input, handleText]
  );

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
      {open && (
        <div className="w-80 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl sm:w-96">
          <div className="border-b border-slate-200 bg-mza-blue px-4 py-3 text-white">
            <p className="font-semibold">Asistente de voz</p>
          </div>
          <div
            ref={containerRef}
            className="h-72 space-y-3 overflow-y-auto bg-slate-50 p-4"
          >
            {log.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-mza-blue text-white"
                    : "mr-auto bg-slate-200 text-slate-800"
                }`}
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="mr-auto w-fit rounded-2xl bg-slate-200 px-3 py-2 text-sm text-slate-600">
                Pensando…
              </div>
            )}
          </div>

          <div className="max-h-24 overflow-y-auto border-t border-slate-200 bg-white p-2">
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy || !sessionReady}
                  onClick={() => runSuggestion(s)}
                  className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-200 p-3">
            <button
              type="button"
              onClick={toggleMic}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ${
                listening ? "bg-red-500 animate-pulse" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
              title={listening ? "Detener" : "Hablar"}
            >
              {listening ? "◼" : "🎙"}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí o usá el micrófono"
              className="min-w-0 flex-1 rounded-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-mza-blue"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy || !sessionReady}
              className="rounded-full bg-mza-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => {
          engineRef.current?.resumeAudioContext?.();
          setOpen((o) => !o);
        }}
        className={`grid h-14 w-14 place-items-center rounded-full shadow-xl transition ${
          open ? "bg-slate-300 text-slate-700" : "bg-mza-blue text-white"
        }`}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente"}
      >
        {open ? "✕" : "🎙"}
      </button>
    </div>
  );
}
