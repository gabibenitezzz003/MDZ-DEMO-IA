"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSessionId } from "@/components/SessionProvider";
import {
  buildDemoTourBeats,
  matchTourChoice,
  pickTourCrop,
  wantsStopTour,
  type TourChoice,
} from "@/lib/demo-tour";
import {
  navigateOfficialTab,
  openOfficialFromUserGesture,
  primeOfficialTab,
} from "@/lib/official-tab";
import { officialUrlFor } from "@/lib/page-knowledge";
import { readBrowserPageContext } from "@/lib/page-context";
import type { AgentEvent } from "@/lib/types";
import {
  blobToBase64,
  computeRms,
  pickRecorderMime,
} from "@/lib/mic-capture";
import {
  estimateSpeechMs,
  isNearDuplicateHeard,
  looksLikeEcho,
  normalizeHeard,
  shouldCutSpeechOnInterim,
} from "@/lib/voice-stt-guards";

const OFFICIAL_PORTAL = officialUrlFor();
const CHAT_TIMEOUT_MS = 14_000;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult:
    | ((ev: {
        resultIndex: number;
        results: ArrayLike<{
          0: { transcript: string };
          isFinal: boolean;
        }>;
      }) => void)
    | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type ConfirmFill = {
  type: "fill";
  fields: Record<string, string>;
  question: string;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function base64ToBlobUrl(audioBase64: string, mime = "audio/mpeg") {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}

function playAudioBase64(
  audioBase64: string,
  mime = "audio/mpeg",
  onEnd?: () => void
) {
  const objectUrl = base64ToBlobUrl(audioBase64, mime);
  const audio = new Audio(objectUrl);
  let finished = false;
  let safety = 0;
  const done = () => {
    if (finished) return;
    finished = true;
    if (safety) window.clearTimeout(safety);
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore
    }
    onEnd?.();
  };
  (audio as HTMLAudioElement & { __demoDone?: () => void; __blobUrl?: string }).__demoDone =
    done;
  (
    audio as HTMLAudioElement & { __demoDone?: () => void; __blobUrl?: string }
  ).__blobUrl = objectUrl;
  audio.onended = done;
  audio.onerror = done;
  audio.preload = "auto";
  const armSafety = () => {
    const durMs =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.ceil(audio.duration * 1000) + 2500
        : 40000;
    if (safety) window.clearTimeout(safety);
    safety = window.setTimeout(done, durMs);
  };
  audio.onloadedmetadata = armSafety;
  void audio.play().then(undefined, (err: unknown) => {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: string }).name)
        : "";
    if (name !== "AbortError") done();
  });
  safety = window.setTimeout(done, 40000);
  return audio;
}

function speakBrowser(text: string, onEnd?: () => void) {
  let finished = false;
  let safety = 0;
  const done = () => {
    if (finished) return;
    finished = true;
    if (safety) window.clearTimeout(safety);
    onEnd?.();
  };

  if (typeof window === "undefined" || !window.speechSynthesis) {
    done();
    return;
  }

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-AR";
  u.rate = 0.94;
  u.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => /es-AR/i.test(v.lang)) ||
    voices.find((v) => /es-MX|es-ES|es_/i.test(v.lang) && /female|paulina|sabina|lucia|google/i.test(v.name)) ||
    voices.find((v) => /^es/i.test(v.lang));
  if (preferred) u.voice = preferred;
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.speak(u);
  safety = window.setTimeout(done, estimateSpeechMs(text) + 5000);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const SUGGESTIONS = [
  "Demo guiada",
  "Mostrame el RUT",
  "Llevame a ciruela",
  "Mapas agrícolas",
  "Quién es el director",
  "Qué es el QR",
  "Dónde estoy",
  "Explicame esto",
];

export function DemoAssistant() {
  const sessionId = useSessionId();
  const [open, setOpen] = useState(true);
  const [sessionLive, setSessionLive] = useState(false);
  const [, setListening] = useState(false);
  const [speakingUi, setSpeakingUi] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [confirm, setConfirm] = useState<ConfirmFill | null>(null);
  const [voiceMode, setVoiceMode] = useState<"gabi" | "browser" | "none">(
    "none"
  );
  const [pushToTalk, setPushToTalk] = useState(false);
  const [tourRunning, setTourRunning] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourChapter, setTourChapter] = useState("");
  const [tourChoices, setTourChoices] = useState<TourChoice[] | null>(null);
  const [tourPausePrompt, setTourPausePrompt] = useState("");
  const [officialHint, setOfficialHint] = useState(false);
  const tourChoiceResolverRef = useRef<((id: string) => void) | null>(null);
  const [log, setLog] = useState<{ role: "user" | "assistant"; text: string }[]>(
    [
      {
        role: "assistant",
        text: "Hola, ¿cómo está? Active el micrófono verde o ▶ Demo 3 min para el recorrido completo. Marco la página, abro el portal oficial en otra pestaña y lo guío en el RUT por voz.",
      },
    ]
  );
  const tourCancelRef = useRef(false);
  const tourRunningRef = useRef(false);
  const pushToTalkRef = useRef(false);
  const runGuidedTourRef = useRef<() => Promise<void>>(async () => undefined);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionLiveRef = useRef(false);
  const speakingRef = useRef(false);
  const busyRef = useRef(false);
  const startingRef = useRef(false);
  const runningRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const lastHeardAtRef = useRef(0);
  const lastHeardTextRef = useRef("");
  const lastStartAtRef = useRef(0);
  const restartTimerRef = useRef<number | null>(null);
  const interimCommitTimerRef = useRef<number | null>(null);
  const lastInterimRef = useRef("");
  const sttLangRef = useRef("es-AR");
  /** Prefer server STT (MediaRecorder) — browser SpeechRecognition often fails in Edge/corp nets. */
  const serverMicRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const vadSpeakingRef = useRef(false);
  const silenceAtRef = useRef(0);
  const sttBusyRef = useRef(false);
  const recorderMimeRef = useRef("audio/webm");
  const startEngineRef = useRef<() => void>(() => undefined);
  const handleTextRef = useRef<(raw: string) => Promise<void>>(
    async () => undefined
  );
  const genIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastSpokenRef = useRef("");
  const lastSpokenUntilRef = useRef(0);
  const bargeArmedRef = useRef(false);
  const bargeInFlightRef = useRef(false);
  const tourCropIdRef = useRef<string>("ciruela");
  const tourOfficialUrlRef = useRef<string>(OFFICIAL_PORTAL);

  const speechSupported = useMemo(
    () => (typeof window === "undefined" ? false : Boolean(getRecognitionCtor())),
    []
  );

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const clearInterimCommit = useCallback(() => {
    if (interimCommitTimerRef.current != null) {
      window.clearTimeout(interimCommitTimerRef.current);
      interimCommitTimerRef.current = null;
    }
    lastInterimRef.current = "";
  }, []);

  const disposeRecognition = useCallback((abort: boolean) => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    runningRef.current = false;
    startingRef.current = false;
    clearInterimCommit();
    if (!rec) return;
    rec.onend = null;
    rec.onerror = null;
    rec.onresult = null;
    rec.onstart = null;
    // Siempre frenar el motor: si solo se anulan handlers, Edge/Chrome
    // siguen capturando audio sin entregar resultados (mic “muerto”).
    try {
      if (abort && typeof rec.abort === "function") rec.abort();
      else rec.stop();
    } catch {
      try {
        rec.stop();
      } catch {
        try {
          rec.abort?.();
        } catch {
          // ignore
        }
      }
    }
  }, [clearInterimCommit]);

  const stopAudio = (keepSpeakingFlag = false) => {
    window.speechSynthesis?.cancel();
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      const tagged = audio as HTMLAudioElement & {
        __demoDone?: () => void;
        __blobUrl?: string;
      };
      const finish = tagged.__demoDone;
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } catch {
        // ignore cleanup races
      }
      if (tagged.__blobUrl) {
        try {
          URL.revokeObjectURL(tagged.__blobUrl);
        } catch {
          // ignore
        }
      }
      finish?.();
    }
    if (!keepSpeakingFlag) {
      speakingRef.current = false;
      setSpeakingUi(false);
    }
  };

  const tourPauseListeningRef = useRef(false);

  const scheduleRestart = useCallback((delayMs = 180) => {
    clearRestartTimer();
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      if (!sessionLiveRef.current) return;
      if (tourRunningRef.current) return;
      if (pushToTalkRef.current) return;
      if (serverMicRef.current) return;
      startEngineRef.current();
    }, delayMs);
  }, [clearRestartTimer]);

  const acceptHeardRef = useRef<((raw: string) => void) | null>(null);

  const stopServerMic = useCallback(() => {
    if (vadRafRef.current != null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    const rec = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.ondataavailable = null;
        rec.onstop = null;
        rec.stop();
      } catch {
        // ignore
      }
    }
    recordChunksRef.current = [];
    vadSpeakingRef.current = false;
    silenceAtRef.current = 0;
    sttBusyRef.current = false;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    serverMicRef.current = false;
    setMicLevel(0);
  }, []);

  const sendRecordingForStt = useCallback(async (blob: Blob) => {
    if (!blob.size || blob.size < 400) return;
    if (sttBusyRef.current || busyRef.current) return;
    sttBusyRef.current = true;
    setInterim("Transcribiendo…");
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch("/api/agent/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || recorderMimeRef.current,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; text?: string };
      const text = (data.text || "").trim();
      setInterim("");
      if (text) {
        // Reuse the same echo/dedupe path as browser STT.
        acceptHeardRef.current?.(text);
      }
    } catch (err) {
      console.error("server STT failed", err);
      setInterim("");
      setLog((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "No pude transcribir lo que dijo. Probá de nuevo o escribí en el chat.",
        },
      ]);
    } finally {
      sttBusyRef.current = false;
    }
  }, []);

  const beginUtteranceRecorder = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream || mediaRecorderRef.current) return;
    try {
      const mime = recorderMimeRef.current;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordChunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const chunks = recordChunksRef.current;
        recordChunksRef.current = [];
        mediaRecorderRef.current = null;
        if (!chunks.length) return;
        const blob = new Blob(chunks, {
          type: rec.mimeType || recorderMimeRef.current,
        });
        void sendRecordingForStt(blob);
      };
      mediaRecorderRef.current = rec;
      rec.start(200);
      setInterim("…");
    } catch (err) {
      console.error("MediaRecorder start failed", err);
      mediaRecorderRef.current = null;
    }
  }, [sendRecordingForStt]);

  const endUtteranceRecorder = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") return;
    try {
      rec.stop();
    } catch {
      mediaRecorderRef.current = null;
    }
  }, []);

  const startServerMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia unsupported");
    }
    stopServerMic();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStreamRef.current = stream;
    recorderMimeRef.current = pickRecorderMime();
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) throw new Error("AudioContext unsupported");
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;
    serverMicRef.current = true;
    setListening(true);

    const SPEECH = 0.028;
    const BARGE = 0.045;
    const SILENCE_MS = 700;
    let lastLevelUi = 0;

    const tick = () => {
      vadRafRef.current = requestAnimationFrame(tick);
      if (!sessionLiveRef.current || !serverMicRef.current) return;
      const analyserNode = analyserRef.current;
      if (!analyserNode) return;
      const level = computeRms(analyserNode);
      if (Math.abs(level - lastLevelUi) > 0.01 || level < 0.01) {
        lastLevelUi = level;
        setMicLevel(level);
      }

      if (tourRunningRef.current) return;

      // Mientras el asistente habla: solo barge-in (cortar TTS).
      if (speakingRef.current) {
        if (level > BARGE) {
          stopAudio();
          speakingRef.current = false;
          setSpeakingUi(false);
        }
        return;
      }

      if (busyRef.current || sttBusyRef.current) return;
      if (pushToTalkRef.current) return;

      if (level > SPEECH) {
        if (!vadSpeakingRef.current) {
          vadSpeakingRef.current = true;
          beginUtteranceRecorder();
        }
        silenceAtRef.current = 0;
      } else if (vadSpeakingRef.current) {
        if (!silenceAtRef.current) silenceAtRef.current = Date.now();
        if (Date.now() - silenceAtRef.current >= SILENCE_MS) {
          vadSpeakingRef.current = false;
          silenceAtRef.current = 0;
          endUtteranceRecorder();
        }
      }
    };
    vadRafRef.current = requestAnimationFrame(tick);
  }, [beginUtteranceRecorder, endUtteranceRecorder, stopServerMic]);

  const acceptHeard = useCallback((raw: string) => {
    const done = raw.trim();
    if (!done) return;

    const echoWindowOpen = Date.now() < lastSpokenUntilRef.current;
    const spoken = lastSpokenRef.current;

    if (
      (speakingRef.current || bargeInFlightRef.current) &&
      looksLikeEcho(done, spoken)
    ) {
      setInterim("");
      return;
    }
    if (
      echoWindowOpen &&
      spoken &&
      looksLikeEcho(done, spoken) &&
      normalizeHeard(done).length >= 24
    ) {
      setInterim("");
      return;
    }

    if (speakingRef.current) {
      stopAudio();
      speakingRef.current = false;
      setSpeakingUi(false);
    }

    const now = Date.now();
    if (
      lastHeardTextRef.current &&
      now - lastHeardAtRef.current < 1600 &&
      isNearDuplicateHeard(done, lastHeardTextRef.current)
    ) {
      setInterim("");
      return;
    }
    lastHeardTextRef.current = normalizeHeard(done) || done.toLowerCase();
    lastHeardAtRef.current = now;
    bargeInFlightRef.current = false;
    clearInterimCommit();
    setInterim("");
    void handleTextRef.current(done);
  }, [clearInterimCommit]);

  acceptHeardRef.current = acceptHeard;

  const startRecognitionEngine = useCallback(() => {
    if (serverMicRef.current) return;
    if (!sessionLiveRef.current) return;
    if (tourRunningRef.current) return;
    if (pushToTalkRef.current) return;
    if (Date.now() - lastStartAtRef.current < 280) {
      scheduleRestart(280);
      return;
    }

    // Si hay un motor colgado/vivo, matarlo y reintentar: no dejar handlers nulos.
    if (startingRef.current || runningRef.current || recognitionRef.current) {
      disposeRecognition(true);
      scheduleRestart(240);
      return;
    }

    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = sttLangRef.current;
    // continuous:true en Edge/Chrome a menudo no marca isFinal en frases cortas.
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      startingRef.current = false;
      runningRef.current = true;
      setListening(true);
    };

    rec.onresult = (ev) => {
      let finalText = "";
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const piece = ev.results[i];
        const said = piece?.[0]?.transcript ?? "";
        if (!said) continue;
        if (piece.isFinal) finalText += `${said} `;
        else live += said;
      }

      const liveTrim = live.trim();
      const spoken = lastSpokenRef.current;

      if (liveTrim) {
        setInterim(liveTrim);
        lastInterimRef.current = liveTrim;
        if (interimCommitTimerRef.current != null) {
          window.clearTimeout(interimCommitTimerRef.current);
        }
        // Si el motor nunca manda isFinal (bug típico), confirmar el interim.
        interimCommitTimerRef.current = window.setTimeout(() => {
          interimCommitTimerRef.current = null;
          const pending = lastInterimRef.current.trim();
          if (!pending || pending.length < 2) return;
          if (!sessionLiveRef.current) return;
          acceptHeard(pending);
        }, 850);
      }

      // Cortá el audio apenas se escucha voz real (no eco).
      if (
        speakingRef.current &&
        shouldCutSpeechOnInterim(liveTrim, spoken)
      ) {
        bargeInFlightRef.current = true;
        bargeArmedRef.current = true;
        stopAudio();
        speakingRef.current = false;
        setSpeakingUi(false);
      }

      const done = finalText.trim();
      if (!done) return;
      acceptHeard(done);
    };

    rec.onerror = (ev) => {
      startingRef.current = false;

      if (ev.error === "no-speech") {
        // Chrome/Edge disparan onend después; el restart va ahí.
        return;
      }

      if (ev.error === "aborted") {
        runningRef.current = false;
        return;
      }

      if (ev.error === "language-not-supported") {
        if (sttLangRef.current !== "es-ES") {
          sttLangRef.current = "es-ES";
          runningRef.current = false;
          recognitionRef.current = null;
          scheduleRestart(120);
          return;
        }
      }

      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        sessionLiveRef.current = false;
        setSessionLive(false);
        setListening(false);
        disposeRecognition(true);
        setLog((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "El navegador bloqueó el micrófono. Permitilo en el candado de la barra de direcciones y tocá de nuevo el botón verde.",
          },
        ]);
        return;
      }

      if (ev.error === "audio-capture") {
        runningRef.current = false;
        setLog((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "No encuentro el micrófono. Revisá que esté conectado y que ninguna otra app lo esté usando.",
          },
        ]);
        scheduleRestart(800);
        return;
      }

      runningRef.current = false;
      scheduleRestart(400);
    };

    rec.onend = () => {
      startingRef.current = false;
      runningRef.current = false;
      if (recognitionRef.current === rec) recognitionRef.current = null;
      if (sessionLiveRef.current && !pushToTalkRef.current) {
        scheduleRestart(speakingRef.current || busyRef.current ? 160 : 200);
      } else {
        setListening(false);
      }
    };

    startingRef.current = true;
    lastStartAtRef.current = Date.now();
    try {
      rec.start();
    } catch {
      startingRef.current = false;
      runningRef.current = false;
      recognitionRef.current = null;
      scheduleRestart(500);
    }
  }, [acceptHeard, disposeRecognition, scheduleRestart]);

  startEngineRef.current = startRecognitionEngine;

  const pauseListeningForSpeech = useCallback(() => {
    speakingRef.current = true;
    setSpeakingUi(true);
    setInterim("");
    bargeArmedRef.current = false;
    bargeInFlightRef.current = false;
    window.setTimeout(() => {
      bargeArmedRef.current = true;
    }, 120);
    if (!runningRef.current && !pushToTalkRef.current) {
      scheduleRestart(60);
    }
  }, [scheduleRestart]);

  const resumeListeningAfterSpeech = useCallback(() => {
    speakingRef.current = false;
    setSpeakingUi(false);
    bargeArmedRef.current = false;
    bargeInFlightRef.current = false;
    lastSpokenUntilRef.current = Date.now() + 250;
    lastSpokenRef.current = "";
    if (!sessionLiveRef.current) return;
    if (pushToTalkRef.current) {
      setListening(false);
      return;
    }
    if (serverMicRef.current) {
      setListening(true);
      return;
    }
    // Forzar ciclo de reconocimiento (Edge/Chrome a veces dejan el STT “muerto”).
    disposeRecognition(true);
    scheduleRestart(260);
  }, [disposeRecognition, scheduleRestart]);

  const hardStopSession = useCallback(() => {
    sessionLiveRef.current = false;
    setSessionLive(false);
    genIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    clearRestartTimer();
    stopAudio();
    setInterim("");
    setListening(false);
    stopServerMic();
    disposeRecognition(true);
    busyRef.current = false;
    setBusy(false);
  }, [clearRestartTimer, disposeRecognition, stopServerMic]);

  const startVoiceSession = useCallback(async () => {
    speakingRef.current = false;
    setSpeakingUi(false);
    sessionLiveRef.current = true;
    setSessionLive(true);

    try {
      await startServerMic();
      setLog((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Micrófono abierto. Hablá con calma: “hola”, “mostrame el RUT” o “llevame a los mapas”.",
        },
      ]);
      return;
    } catch (err) {
      console.error("server mic failed", err);
      serverMicRef.current = false;
    }

    if (!speechSupported) {
      sessionLiveRef.current = false;
      setSessionLive(false);
      setLog((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "No pude abrir el micrófono. Permitilo en el candado del sitio o escribí en el chat.",
        },
      ]);
      return;
    }

    setLog((prev) => [
      ...prev,
      {
        role: "assistant",
        text: "Micrófono abierto (dictado del navegador). Hablá cuando quieras.",
      },
    ]);
    startRecognitionEngine();
  }, [speechSupported, startRecognitionEngine, startServerMic]);

  const endVoiceSession = useCallback(() => {
    hardStopSession();
    setLog((prev) => [
      ...prev,
      {
        role: "assistant",
        text: "Listo, apagué el micrófono. Cuando quieras seguir, tocá el botón verde.",
      },
    ]);
  }, [hardStopSession]);

  const speakWaiterRef = useRef<(() => void) | null>(null);

  const speakLine = useCallback(
    (spoken: string, audioBase64?: string, audioMime?: string, genId?: number) =>
      new Promise<void>((resolve) => {
        const prev = speakWaiterRef.current;
        speakWaiterRef.current = null;
        prev?.();

        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          if (speakWaiterRef.current === done) speakWaiterRef.current = null;
          window.clearTimeout(safety);
          if (genId == null || genId === genIdRef.current) {
            speakingRef.current = false;
            setSpeakingUi(false);
          }
          resolve();
        };
        speakWaiterRef.current = done;
        const safety = window.setTimeout(
          done,
          audioBase64 ? 45000 : estimateSpeechMs(spoken) + 3500
        );

        if (genId != null && genId !== genIdRef.current) {
          done();
          return;
        }

        lastSpokenRef.current = spoken;
        // Ventana de eco corta: se recorta al terminar el audio.
        lastSpokenUntilRef.current = Date.now() + 900;
        speakingRef.current = true;
        setSpeakingUi(true);
        bargeArmedRef.current = true;
        bargeInFlightRef.current = false;
        stopAudio(true);
        // Mantener el micrófono vivo para poder interrumpir.
        if (
          !tourRunningRef.current &&
          sessionLiveRef.current &&
          !pushToTalkRef.current
        ) {
          if (!runningRef.current) scheduleRestart(40);
        }

        const finishSpeak = () => {
          lastSpokenUntilRef.current = Date.now() + 250;
          done();
          // Reactivar micrófono sí o sí al terminar de hablar.
          if (
            sessionLiveRef.current &&
            !tourRunningRef.current &&
            !pushToTalkRef.current
          ) {
            if (serverMicRef.current) {
              setListening(true);
            } else {
              disposeRecognition(true);
              scheduleRestart(260);
            }
          }
          window.setTimeout(() => {
            lastSpokenRef.current = "";
          }, 400);
        };

        if (audioBase64) {
          setVoiceMode("gabi");
          audioRef.current = playAudioBase64(
            audioBase64,
            audioMime || "audio/mpeg",
            finishSpeak
          );
        } else if (spoken.trim()) {
          setVoiceMode("browser");
          speakBrowser(spoken, finishSpeak);
        } else {
          finishSpeak();
        }
      }),
    [disposeRecognition, scheduleRestart]
  );

  const resolveTourChoice = useCallback((id: string, fromGesture = false) => {
    const openOnGesture: Record<string, { url: string; title: string; sectionId: string }> = {
      official: {
        url: tourOfficialUrlRef.current || officialUrlFor(tourCropIdRef.current),
        title: `Oficial · ${tourCropIdRef.current}`,
        sectionId: tourCropIdRef.current,
      },
      radar: {
        url: officialUrlFor("radar"),
        title: "Radar meteorológico",
        sectionId: "radar",
      },
      sia: {
        url: "https://sia.mendoza.gov.ar/account/login",
        title: "SIA · RUT oficial",
        sectionId: "rut",
      },
    };
    const external = openOnGesture[id];
    if (external) {
      const opened = fromGesture
        ? openOfficialFromUserGesture(external.url)
        : navigateOfficialTab(external.url);
      window.dispatchEvent(
        new CustomEvent("demo:official-toast", {
          detail: {
            url: external.url,
            title: external.title,
            sectionId: external.sectionId,
            blocked: !opened,
          },
        })
      );
    }
    const resolver = tourChoiceResolverRef.current;
    tourChoiceResolverRef.current = null;
    setTourChoices(null);
    setTourPausePrompt("");
    resolver?.(id);
  }, []);

  const resumeMicAfterTourRef = useRef(false);

  const stopGuidedTour = useCallback(() => {
    if (!tourRunningRef.current) return;
    tourCancelRef.current = true;
    const resolver = tourChoiceResolverRef.current;
    tourChoiceResolverRef.current = null;
    setTourChoices(null);
    setTourPausePrompt("");
    stopAudio();
    resolver?.("continue");
  }, []);

  const handleText = useCallback(
    async (raw: string, opts?: { silentUser?: boolean }) => {
      const text = raw.trim();
      if (!text || !sessionId) return;

      if (tourRunningRef.current) {
        if (wantsStopTour(text)) {
          stopGuidedTour();
          return;
        }
        if (tourChoices && tourChoiceResolverRef.current) {
          const choiceId = matchTourChoice(text, tourChoices);
          if (choiceId) {
            if (!opts?.silentUser) {
              setLog((prev) => [...prev, { role: "user", text }]);
            }
            stopAudio();
            resolveTourChoice(choiceId, true);
          }
        }
        return;
      }

      abortRef.current?.abort();
      stopAudio();
      speakingRef.current = false;
      setSpeakingUi(false);
      const myGen = ++genIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      queueRef.current = [];

      busyRef.current = true;
      setBusy(true);
      if (!opts?.silentUser) {
        setLog((prev) => {
          const last = prev[prev.length - 1];
          if (
            last?.role === "user" &&
            isNearDuplicateHeard(last.text, text) &&
            Date.now() - lastHeardAtRef.current < 5000
          ) {
            return prev;
          }
          return [...prev, { role: "user", text }];
        });
      }
      setInput("");
      setConfirm(null);

      try {
        if (wantsStopTour(text)) {
          tourCancelRef.current = true;
          tourRunningRef.current = false;
          setTourRunning(false);
          setTourChoices(null);
        }

        const timeout = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch("/api/agent/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              sessionId,
              text,
              context: readBrowserPageContext(),
            }),
          });
        } finally {
          window.clearTimeout(timeout);
        }
        if (myGen !== genIdRef.current) return;

        const data = (await res.json()) as {
          ok?: boolean;
          spoken?: string;
          reply?: string;
          audioBase64?: string;
          audioMime?: string;
          error?: string;
          event?: AgentEvent;
          confirm?: ConfirmFill;
          endSession?: boolean;
          startTour?: boolean;
        };

        if (myGen !== genIdRef.current) return;

        if (!res.ok || !data.ok) {
          throw new Error(data.error || `chat HTTP ${res.status}`);
        }

        const spoken = data.spoken || data.reply || "Listo.";
        // Liberar "Pensando…" antes de narrar para no trabar la UI.
        busyRef.current = false;
        setBusy(false);
        setLog((prev) => [...prev, { role: "assistant", text: spoken }]);
        setConfirm(data.confirm ?? null);

        if (data.event) {
          window.dispatchEvent(
            new CustomEvent("demo:agent-event", { detail: data.event })
          );
        }

        await speakLine(spoken, data.audioBase64, data.audioMime, myGen);
        if (myGen !== genIdRef.current) return;

        if (data.endSession) {
          hardStopSession();
          return;
        }

        if (data.startTour) {
          await sleep(300);
          if (myGen !== genIdRef.current) return;
          await runGuidedTourRef.current();
          return;
        }

        resumeListeningAfterSpeech();
      } catch (err) {
        if (myGen !== genIdRef.current) return;
        const name =
          err && typeof err === "object" && "name" in err
            ? String((err as { name: string }).name)
            : "";
        if (name === "AbortError") {
          setLog((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "Se me trabó la respuesta. Decime de nuevo, por favor.",
            },
          ]);
          resumeListeningAfterSpeech();
          return;
        }
        const detail =
          err instanceof Error && err.message
            ? err.message.slice(0, 120)
            : "error de red";
        setLog((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `No pude responder (${detail}). El micrófono sigue en sesión: probá de nuevo.`,
          },
        ]);
        resumeListeningAfterSpeech();
      } finally {
        if (myGen === genIdRef.current) {
          busyRef.current = false;
          setBusy(false);
          if (abortRef.current === controller) abortRef.current = null;
        }
      }
    },
    [
      hardStopSession,
      resolveTourChoice,
      resumeListeningAfterSpeech,
      sessionId,
      speakLine,
      stopGuidedTour,
      tourChoices,
    ]
  );

  handleTextRef.current = handleText;

  type TourAudio = {
    spoken: string;
    audioBase64?: string;
    audioMime?: string;
  };

  const fetchTourAudio = useCallback(
    async (id: string, spoken: string): Promise<TourAudio> => {
      try {
        if (!sessionId) return { spoken };
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            text: `__tour_narrate__:${id}`,
            narration: spoken,
          }),
        });
        if (!res.ok) return { spoken };
        const data = (await res.json()) as {
          spoken?: string;
          audioBase64?: string;
          audioMime?: string;
        };
        return {
          spoken: data.spoken || spoken,
          audioBase64: data.audioBase64,
          audioMime: data.audioMime,
        };
      } catch {
        return { spoken };
      }
    },
    [sessionId]
  );

  const narrate = useCallback(
    async (id: string, spoken: string, prefetched?: Promise<TourAudio> | TourAudio) => {
      const audio = prefetched
        ? await prefetched
        : await fetchTourAudio(id, spoken);
      await speakLine(
        audio.spoken || spoken,
        audio.audioBase64,
        audio.audioMime
      );
    },
    [fetchTourAudio, speakLine]
  );

  const runGuidedTour = useCallback(async () => {
    if (tourRunningRef.current) return;
    tourCancelRef.current = false;
    tourRunningRef.current = true;
    setTourRunning(true);

    // Demo 3 min = solo botones + narración. Mic apagado para que no trabe ni interrumpa.
    resumeMicAfterTourRef.current = sessionLiveRef.current;
    clearRestartTimer();
    disposeRecognition(true);
    setListening(false);
    setInterim("");
    sessionLiveRef.current = false;
    setSessionLive(false);
    speakingRef.current = false;
    setSpeakingUi(false);
    busyRef.current = false;
    setBusy(false);
    abortRef.current?.abort();
    abortRef.current = null;
    genIdRef.current += 1;

    const crop = pickTourCrop();
    tourCropIdRef.current = crop.id;
    tourOfficialUrlRef.current = officialUrlFor(crop.id);
    const beats = buildDemoTourBeats(crop);
    setTourStep(0);
    setTourChapter(beats[0]?.chapter || "");
    setTourChoices(null);
    setTourPausePrompt("");
    queueRef.current = [];

    setLog((prev) => [
      ...prev,
      {
        role: "assistant",
        text: "▶ Demo 3 min — recorrido fluido. El micrófono queda apagado: en las pausas tocá un botón para seguir o abrir enlaces.",
      },
    ]);

    let lastChoice = "continue";
    let played = 0;

    const nextPlayableIndex = (from: number, choice: string) => {
      for (let j = from; j < beats.length; j += 1) {
        const b = beats[j];
        if (b.skipUnlessChoice && b.skipUnlessChoice !== choice) continue;
        return j;
      }
      return -1;
    };

    let pendingAudio: Promise<TourAudio> | null = null;
    const firstIdx = nextPlayableIndex(0, lastChoice);
    if (firstIdx >= 0) {
      pendingAudio = fetchTourAudio(
        beats[firstIdx].id,
        beats[firstIdx].spoken
      );
    }

    for (let i = 0; i < beats.length; i += 1) {
      const beat = beats[i];
      if (tourCancelRef.current) break;

      if (beat.skipUnlessChoice && beat.skipUnlessChoice !== lastChoice) {
        continue;
      }

      played += 1;
      setTourStep(played);
      setTourChapter(beat.chapter);

      const audioPromise =
        pendingAudio || fetchTourAudio(beat.id, beat.spoken);
      pendingAudio = null;

      let pauseAudioPromise: Promise<TourAudio> | null = null;
      if (beat.pause) {
        pauseAudioPromise = fetchTourAudio(
          `${beat.id}-pause`,
          beat.pause.prompt
        );
      } else {
        const nextIdx = nextPlayableIndex(i + 1, lastChoice);
        if (nextIdx >= 0) {
          pendingAudio = fetchTourAudio(
            beats[nextIdx].id,
            beats[nextIdx].spoken
          );
        }
      }

      if (beat.action) {
        const event: AgentEvent = {
          id: `tour-${beat.id}-${Date.now()}`,
          sessionId: sessionId || "tour",
          action: beat.action,
          target: beat.target,
          payload: beat.payload,
          createdAt: Date.now(),
        };
        window.dispatchEvent(
          new CustomEvent("demo:agent-event", { detail: event })
        );
      }

      setLog((prev) => [
        ...prev,
        { role: "assistant", text: `【${beat.chapter}】 ${beat.spoken}` },
      ]);

      await narrate(beat.id, beat.spoken, audioPromise);
      if (tourCancelRef.current) break;
      await sleep(beat.dwellMs);

      if (beat.pause) {
        setTourPausePrompt(beat.pause.prompt);
        setTourChoices(beat.pause.choices);
        setLog((prev) => [
          ...prev,
          { role: "assistant", text: beat.pause!.prompt },
        ]);
        tourPauseListeningRef.current = false;
        const choicePromise = new Promise<string>((resolve) => {
          tourChoiceResolverRef.current = resolve;
        });
        void narrate(
          `${beat.id}-pause`,
          beat.pause.prompt,
          pauseAudioPromise || undefined
        );
        const choiceId = await choicePromise;
        if (tourCancelRef.current) break;
        lastChoice = choiceId;
        stopAudio();
        const label =
          beat.pause.choices.find((c) => c.id === choiceId)?.label || choiceId;
        setLog((prev) => [
          ...prev,
          { role: "assistant", text: `→ ${label}` },
        ]);
        const nextIdx = nextPlayableIndex(i + 1, lastChoice);
        if (nextIdx >= 0) {
          pendingAudio = fetchTourAudio(
            beats[nextIdx].id,
            beats[nextIdx].spoken
          );
        }
        await sleep(120);
      }
    }

    tourPauseListeningRef.current = false;
    tourChoiceResolverRef.current = null;
    tourRunningRef.current = false;
    setTourRunning(false);
    setTourStep(0);
    setTourChapter("");
    setTourChoices(null);
    setTourPausePrompt("");
    stopAudio();
    setLog((prev) => [
      ...prev,
      {
        role: "assistant",
        text: tourCancelRef.current
          ? "Listo, frené el recorrido. Cuando quieras, tocá el micrófono o seguí por texto."
          : "Fin del recorrido. Tocá el micrófono para dictar el RUT, o pedime un cultivo / el QR por texto.",
      },
    ]);

    const wantVoice =
      !tourCancelRef.current &&
      (lastChoice === "voice" || resumeMicAfterTourRef.current);
    if (wantVoice) {
      sessionLiveRef.current = true;
      setSessionLive(true);
      scheduleRestart(250);
      if (lastChoice === "voice") {
        setLog((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Micrófono listo. Pasame CUIT, mail o razón social cuando quieras.",
          },
        ]);
      }
    }
  }, [
    clearRestartTimer,
    disposeRecognition,
    fetchTourAudio,
    narrate,
    scheduleRestart,
    sessionId,
  ]);

  runGuidedTourRef.current = runGuidedTour;

  useEffect(() => {
    pushToTalkRef.current = pushToTalk;
    if (pushToTalk) {
      clearRestartTimer();
      disposeRecognition(true);
      if (!serverMicRef.current) setListening(false);
      // Cortá una grabación VAD a medias al pasar a push-to-talk.
      if (vadSpeakingRef.current) {
        vadSpeakingRef.current = false;
        endUtteranceRecorder();
      }
    } else if (
      sessionLiveRef.current &&
      !speakingRef.current &&
      !serverMicRef.current
    ) {
      scheduleRestart(200);
    }
  }, [pushToTalk, scheduleRestart, disposeRecognition, clearRestartTimer, endUtteranceRecorder]);

  useEffect(() => {
    let timer: number | null = null;
    const onOfficial = () => {
      setOfficialHint(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setOfficialHint(false), 12000);
    };
    window.addEventListener("demo:official-toast", onOfficial);
    return () => {
      window.removeEventListener("demo:official-toast", onOfficial);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!sessionLive || pushToTalk || tourRunning) return;
    const id = window.setInterval(() => {
      if (!sessionLiveRef.current) return;
      if (serverMicRef.current) return;
      if (tourRunningRef.current) return;
      if (startingRef.current || runningRef.current) return;
      startEngineRef.current();
    }, 900);
    return () => window.clearInterval(id);
  }, [sessionLive, pushToTalk, tourRunning]);

  useEffect(() => {
    return () => {
      hardStopSession();
    };
  }, [hardStopSession]);

  if (!sessionId) return null;

  const statusLine = tourRunning
    ? speakingUi
      ? `Demo 3 min · ${tourChapter}`
      : `Demo 3 min · tocá un botón`
    : !sessionLive
      ? voiceMode === "gabi"
        ? "Voz lista"
        : "Guía premium · Mendoza"
      : speakingUi
        ? "Hablando · podés interrumpir"
        : busy
          ? "Pensando…"
          : pushToTalk
            ? "Push-to-talk"
            : "Te escucho";

  const tourProgress = tourRunning
    ? Math.min(100, Math.round((tourStep / 8) * 100))
    : 0;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-[min(100vw-2rem,24rem)] flex-col items-end gap-2">
      {open ? (
        <div className="demo-panel-enter w-full overflow-hidden rounded-3xl border border-white/50 bg-white/95 shadow-2xl shadow-mza-blue/25 backdrop-blur-xl">
          <div className="relative overflow-hidden bg-gradient-to-br from-mza-blue via-mza-blue-light to-[#0b3d91] px-4 py-3.5 text-white">
            <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-mza-gold/20 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-lg ring-1 ring-white/25 ${
                    sessionLive && !speakingUi && !pushToTalk
                      ? "demo-mic-live"
                      : ""
                  }`}
                >
                  {speakingUi ? "🗣️" : sessionLive ? "🎙️" : "🌱"}
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight">
                    Asistente Agricultura
                  </p>
                  <p className="text-[11px] text-sky-100/90">{statusLine}</p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-full px-2 text-lg leading-none hover:bg-white/10"
                onClick={() => setOpen(false)}
                aria-label="Cerrar panel"
              >
                ×
              </button>
            </div>
            {tourRunning ? (
              <div className="relative mt-3">
                <div className="mb-1 flex items-center justify-between text-[10px] text-sky-100">
                  <span className="font-semibold">{tourChapter}</span>
                  <span>Paso {tourStep}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mza-gold to-emerald-300 transition-all duration-500"
                    style={{ width: `${tourProgress}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={stopGuidedTour}
                  className="mt-2 w-full rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold text-white ring-1 ring-white/25 hover:bg-white/25"
                >
                  Parar demo
                </button>
              </div>
            ) : null}
          </div>

          {officialHint ? (
            <div className="bg-emerald-50 px-3 py-1.5 text-center text-[11px] font-semibold text-emerald-900">
              Portal oficial abierto en otra pestaña · yo sigo acá
            </div>
          ) : null}

          {tourRunning ? (
            <div className="flex items-center justify-center gap-2 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              {speakingUi ? (
                <span className="demo-voice-bars text-amber-700" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              )}
              <span>
                {speakingUi
                  ? "Narrando el recorrido…"
                  : tourChoices?.length
                    ? "Elegí una opción para continuar"
                    : "Preparando el siguiente paso…"}
              </span>
            </div>
          ) : sessionLive || speakingUi ? (
            <div
              className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold ${
                speakingUi
                  ? "bg-sky-50 text-sky-800"
                  : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {speakingUi ? (
                <span className="demo-voice-bars text-sky-600" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              )}
              <span>
                {speakingUi
                  ? "Hablando…"
                  : pushToTalk
                    ? "Mantener 🎤 para hablar"
                    : "Escuchando — hablá con calma"}
              </span>
              {sessionLive && !speakingUi ? (
                <span
                  className="ml-1 inline-flex h-1.5 w-12 overflow-hidden rounded-full bg-emerald-200"
                  title="Nivel de micrófono"
                >
                  <span
                    className="block h-full bg-emerald-600 transition-[width] duration-75"
                    style={{
                      width: `${Math.min(100, Math.round(micLevel * 420))}%`,
                    }}
                  />
                </span>
              ) : null}
              {interim ? (
                <span className="max-w-[45%] truncate font-normal italic opacity-80">
                  “{interim}”
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="max-h-60 space-y-2 overflow-y-auto px-3 py-3 text-sm">
            {log.map((m, i) => (
              <div
                key={`${i}-${m.text.slice(0, 16)}`}
                className={`rounded-2xl px-3 py-2 leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "ml-8 bg-gradient-to-br from-mza-blue to-mza-blue-light text-white"
                    : "mr-4 border border-slate-100 bg-slate-50 text-slate-800"
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>

          {tourChoices?.length ? (
            <div className="border-t border-mza-gold/40 bg-gradient-to-r from-amber-50 to-sky-50 px-3 py-2.5">
              {tourPausePrompt ? (
                <p className="mb-2 text-[11px] font-medium text-slate-700">
                  {tourPausePrompt}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {tourChoices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => resolveTourChoice(c.id, true)}
                    className="rounded-full bg-mza-blue px-3 py-1.5 text-[11px] font-semibold text-white shadow hover:bg-mza-blue-dark"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {confirm?.type === "fill" ? (
            <div className="flex flex-wrap gap-2 border-t border-amber-100 bg-amber-50/90 px-3 py-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleText("sí, completalo vos")}
                className="rounded-full bg-mza-blue px-3 py-1.5 text-[11px] font-semibold text-white shadow"
              >
                Completalo vos
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleText("lo cargo a mano")}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700"
              >
                Lo cargo a mano
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleText("mostrame los documentos")}
                className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-900"
              >
                Ver documentos
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5 border-t border-slate-100/80 bg-slate-50/50 px-3 py-2">
            <button
              type="button"
              disabled={busy || tourRunning}
              onClick={() => {
                primeOfficialTab();
                void runGuidedTour();
              }}
              className="rounded-full bg-gradient-to-r from-mza-gold/90 to-amber-400 px-2.5 py-1 text-[10px] font-bold text-amber-950 shadow-sm hover:brightness-105 disabled:opacity-50"
            >
              ▶ Demo 3 min
            </button>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy || tourRunning}
                onClick={() => {
                  primeOfficialTab();
                  if (s === "Demo guiada") {
                    void runGuidedTour();
                  } else void handleText(s);
                }}
                className="rounded-full border border-slate-200/80 bg-white px-2 py-1 text-[10px] text-slate-600 shadow-sm hover:border-mza-blue/30 hover:text-mza-blue disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-slate-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleText(input);
            }}
          >
            {pushToTalk && sessionLive ? (
              <button
                type="button"
                className="rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow active:bg-emerald-800"
                onMouseDown={() => {
                  if (serverMicRef.current) beginUtteranceRecorder();
                  else startRecognitionEngine();
                }}
                onMouseUp={() => {
                  if (serverMicRef.current) endUtteranceRecorder();
                  else disposeRecognition(true);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (serverMicRef.current) beginUtteranceRecorder();
                  else startRecognitionEngine();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  if (serverMicRef.current) endUtteranceRecorder();
                  else disposeRecognition(true);
                }}
                title="Mantener para hablar"
              >
                🎤
              </button>
            ) : (
              <button
                type="button"
                disabled={tourRunning}
                onClick={() => {
                  if (sessionLive) endVoiceSession();
                  else void startVoiceSession();
                }}
                className={`rounded-full px-3 py-2 text-sm font-semibold text-white shadow disabled:opacity-40 ${
                  sessionLive ? "bg-red-600" : "bg-emerald-600"
                }`}
                title={
                  tourRunning
                    ? "Micrófono apagado durante la demo"
                    : sessionLive
                      ? "Finalizar sesión"
                      : "Iniciar sesión de voz"
                }
              >
                {sessionLive ? "■" : "🎤"}
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={tourRunning}
              placeholder={
                tourRunning
                  ? "Demo en curso — usá los botones…"
                  : sessionLive
                    ? "Escribí o hablá…"
                    : "Escribí o abrí el micrófono…"
              }
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-mza-blue/20 focus:border-mza-blue focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={busy || tourRunning || !input.trim()}
              className="rounded-full bg-mza-blue px-3.5 py-2 text-sm font-semibold text-white shadow disabled:opacity-40"
            >
              Ir
            </button>
          </form>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={pushToTalk}
                onChange={(e) => setPushToTalk(e.target.checked)}
              />
              Push-to-talk
            </label>
            {sessionLive ? (
              <button
                type="button"
                onClick={endVoiceSession}
                className="font-semibold text-red-700 hover:underline"
              >
                Apagar micrófono
              </button>
            ) : (
              <span className="font-medium text-slate-400">
                Voz institucional · Gemini · Mendoza
              </span>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:scale-[1.02] ${
          sessionLive
            ? "demo-mic-live bg-emerald-700"
            : "bg-gradient-to-r from-mza-blue to-mza-blue-light hover:brightness-110"
        }`}
      >
        {open
          ? sessionLive
            ? "Asistente activo"
            : "Ocultar"
          : sessionLive
            ? "Asistente activo"
            : "Hablar con el asistente"}
      </button>
    </div>
  );
}
