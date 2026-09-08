"use client";

import type { VoiceEngine, VoiceState } from "./types";
import {
  estimateSpeechMs,
  isLikelyUserBargeIn,
  isParaphraseOfAssistant,
  looksLikeEcho,
  shouldStopTtsOnInterim,
} from "@/lib/voice-stt-guards";

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort?(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onresult: ((ev: {
    resultIndex: number;
    results: ArrayLike<{
      0: { transcript: string };
      isFinal: boolean;
    }>;
  }) => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

export class BrowserVoiceEngine implements VoiceEngine {
  private recognition: RecognitionLike | null = null;
  private listening = false;
  private speaking = false;
  private pendingStart: ReturnType<typeof setTimeout> | null = null;
  private resumeListenAfterSpeak = false;
  private bargeInEnabled = true;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private lastSpokenText = "";

  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceState) => void;

  constructor() {
    this.loadPreferredVoice();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => this.loadPreferredVoice();
      window.speechSynthesis.cancel();
    }
  }

  private notify() {
    this.onStateChange?.({
      listening: this.listening,
      speaking: this.speaking,
      thinking: false,
    });
  }

  private loadPreferredVoice() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    const candidates = [
      /es-AR/i,
      /es-ES/i,
      /es-MX/i,
      /es-US/i,
      /es-/i,
    ];
    for (const pattern of candidates) {
      const match = voices.find((v) => pattern.test(v.lang));
      if (match) {
        this.preferredVoice = match;
        return;
      }
    }
    this.preferredVoice = voices.find((v) => /^es/i.test(v.lang)) || null;
  }

  private getRecognitionCtor(): RecognitionCtor | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  }

  startListening(): void {
    if (typeof window === "undefined") return;
    if (this.speaking && !this.bargeInEnabled) {
      // El TTS tiene prioridad: reactivamos el mic cuando termine de hablar.
      this.resumeListenAfterSpeak = true;
      return;
    }
    if (this.pendingStart) {
      clearTimeout(this.pendingStart);
      this.pendingStart = null;
    }

    const ctor = this.getRecognitionCtor();
    if (!ctor) {
      this.onError?.("El navegador no soporta SpeechRecognition.");
      return;
    }

    // Si ya está activo, no reiniciar; si hay uno deteniéndose, esperamos.
    if (this.listening) return;

    if (this.recognition) {
      this.stopListening();
      this.pendingStart = setTimeout(() => {
        this.pendingStart = null;
        this.startListening();
      }, 200);
      return;
    }

    const rec = new ctor();
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.listening = true;
      this.notify();
    };

    rec.onend = () => {
      this.listening = false;
      this.recognition = null;
      this.notify();
      if (this.speaking && this.bargeInEnabled) {
        this.pendingStart = setTimeout(() => {
          this.pendingStart = null;
          this.startListening();
        }, 180);
      }
    };

    rec.onerror = (ev: { error: string }) => {
      if (ev.error === "aborted" || ev.error === "no-speech") {
        // Ciclo normal del motor o silencio: no molestar al usuario.
      } else if (ev.error === "network") {
        // Chrome/Edge a veces cortan STT por red mientras suena el TTS.
        if (!this.speaking) {
          this.onError?.("STT: network");
        }
      } else if (ev.error === "audio-capture") {
        if (!this.speaking) {
          this.onError?.(
            "No se pudo activar el micrófono. Verificá el permiso, que no esté en uso y usá http://localhost:3000."
          );
        }
      } else if (!this.speaking) {
        this.onError?.(`STT: ${ev.error}`);
      }
      this.listening = false;
      this.recognition = null;
      this.notify();
      if (
        this.speaking &&
        this.bargeInEnabled &&
        (ev.error === "network" || ev.error === "no-speech" || ev.error === "aborted")
      ) {
        this.pendingStart = setTimeout(() => {
          this.pendingStart = null;
          this.startListening();
        }, 220);
        return;
      }
      if (
        !this.speaking &&
        (ev.error === "network" || ev.error === "no-speech")
      ) {
        this.pendingStart = setTimeout(() => {
          this.pendingStart = null;
          this.startListening();
        }, 420);
      }
    };

    rec.onresult = (ev: {
      resultIndex: number;
      results: ArrayLike<{
        0: { transcript: string };
        isFinal: boolean;
      }>;
    }) => {
      let final = "";
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const result = ev.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          final += transcript;
        } else {
          live += transcript;
        }
      }
      const liveTrim = live.trim();
      const finalTrim = final.trim();
      const spoken = this.lastSpokenText;

      if (this.speaking && this.bargeInEnabled) {
        if (
          liveTrim &&
          !looksLikeEcho(liveTrim, spoken) &&
          !isParaphraseOfAssistant(liveTrim, spoken)
        ) {
          this.onTranscript?.(liveTrim, false);
        }
        if (
          finalTrim &&
          !looksLikeEcho(finalTrim, spoken) &&
          !isParaphraseOfAssistant(finalTrim, spoken)
        ) {
          this.onTranscript?.(finalTrim, true);
        }
        return;
      }

      if (this.speaking) return;

      if (liveTrim) {
        this.onTranscript?.(liveTrim, false);
      }
      if (finalTrim) {
        this.onTranscript?.(finalTrim, true);
      }
    };

    this.recognition = rec;
    try {
      rec.start();
    } catch (err) {
      this.onError?.(String(err));
    }
  }

  stopListening(): void {
    if (this.pendingStart) {
      clearTimeout(this.pendingStart);
      this.pendingStart = null;
    }
    if (!this.recognition) return;
    this.recognition.onresult = null;
    this.recognition.onerror = null;
    this.recognition.onend = null;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    }
    this.recognition = null;
    this.listening = false;
    this.notify();
  }

  isListening(): boolean {
    return this.listening;
  }

  speak(text: string, onEnd?: () => void, opts?: { fast?: boolean; audioBase64?: string; audioMime?: string }): void {
    void opts; // fast/browser flag: el navegador ya es TTS local.
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onEnd?.();
      return;
    }

    this.lastSpokenText = text;
    this.resumeListenAfterSpeak = false;
    if (!this.bargeInEnabled) {
      // STT y TTS juntos en el mismo mic hacen que Chrome corte la voz a mitad.
      this.stopListening();
    }
    this.stopSpeaking();

    let finished = false;
    this.speaking = true;
    this.notify();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.preferredVoice?.lang || "es-AR";
    u.rate = 1;
    u.pitch = 1;
    if (this.preferredVoice) u.voice = this.preferredVoice;

    u.onstart = () => {
      this.notify();
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      if (safetyTimer) window.clearTimeout(safetyTimer);
      this.speaking = false;
      this.notify();
      onEnd?.();
      if (this.resumeListenAfterSpeak) {
        this.resumeListenAfterSpeak = false;
        this.pendingStart = setTimeout(() => {
          this.pendingStart = null;
          this.startListening();
        }, 320);
      }
    };

    let safetyTimer = 0;
    u.onend = finish;

    u.onerror = finish;

    try {
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }
    window.speechSynthesis.speak(u);
    safetyTimer = window.setTimeout(
      finish,
      Math.min(60000, estimateSpeechMs(text) + 4000)
    );
  }

  stopSpeaking(): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    this.speaking = false;
    this.notify();
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  setSpeaking(value: boolean): void {
    this.speaking = value;
    this.notify();
  }

  setBargeInEnabled(enabled: boolean): void {
    this.bargeInEnabled = enabled;
  }

  setLastSpokenText(text: string): void {
    this.lastSpokenText = text;
  }

  getLastSpokenText(): string {
    return this.lastSpokenText;
  }

  destroy(): void {
    this.stopListening();
    this.stopSpeaking();
  }
}
