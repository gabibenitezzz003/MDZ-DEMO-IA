"use client";

import type { VoiceEngine, VoiceState } from "./types";

export class ElevenLabsVoiceEngine implements VoiceEngine {
  private audioCtx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private fallback: SpeechSynthesisUtterance | null = null;
  private listening = false;
  private speaking = false;
  private speakGen = 0;

  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceState) => void;

  constructor() {
    if (typeof window === "undefined") return;
    const Ctx =
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext || window.AudioContext;
    if (!Ctx) return;
    try {
      this.audioCtx = new Ctx();
    } catch {
      this.audioCtx = null;
    }
  }

  private notify() {
    this.onStateChange?.({
      listening: this.listening,
      speaking: this.speaking,
      thinking: false,
    });
  }

  resumeAudioContext(): void {
    if (this.audioCtx && this.audioCtx.state === "closed") {
      this.audioCtx = null;
    }
    if (!this.audioCtx) {
      const Ctx =
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext || window.AudioContext;
      if (Ctx) {
        try {
          this.audioCtx = new Ctx();
        } catch {
          this.audioCtx = null;
        }
      }
    }
    if (!this.audioCtx || this.audioCtx.state === "running") return;
    void this.audioCtx.resume().catch(() => {
      // ignore
    });
  }

  startListening(): void {
    this.listening = false;
    this.notify();
  }

  stopListening(): void {
    this.listening = false;
    this.notify();
  }

  isListening(): boolean {
    return this.listening;
  }

  speak(
    text: string,
    onEnd?: () => void,
    opts?: { fast?: boolean; audioBase64?: string; audioMime?: string }
  ): void {
    if (typeof window === "undefined") {
      onEnd?.();
      return;
    }

    if (opts?.fast) {
      this.fallbackSpeak(text, onEnd);
      return;
    }

    void this.speakWithContext(text, onEnd, opts, ++this.speakGen);
  }

  private async speakWithContext(
    text: string,
    onEnd?: () => void,
    opts?: { fast?: boolean; audioBase64?: string; audioMime?: string },
    gen?: number
  ): Promise<void> {
    const myGen = gen ?? this.speakGen;
    this.resumeAudioContext();
    this.stopSpeaking(myGen);
    this.speaking = true;
    this.notify();

    if (myGen !== this.speakGen) return;

    try {
      const ttsAudio =
        opts?.audioBase64 && opts.audioBase64.length > 40
          ? { audioBase64: opts.audioBase64, audioMime: opts.audioMime }
          : await this.fetchTts(text);

      if (myGen !== this.speakGen) {
        this.speaking = false;
        this.notify();
        return;
      }

      if (!ttsAudio) {
        this.fallbackSpeak(text, onEnd, myGen);
        this.onError?.("TTS no disponible.");
        return;
      }

      await this.playBuffer(ttsAudio.audioBase64, onEnd, myGen);
    } catch (err) {
      if (myGen !== this.speakGen) {
        this.speaking = false;
        this.notify();
        return;
      }
      this.fallbackSpeak(text, onEnd, myGen);
      this.onError?.("No pude reproducir la voz.");
    }
  }

  private async fetchTts(text: string): Promise<{
    audioBase64: string;
    audioMime?: string;
  } | null> {
    const res = await fetch("/api/agent/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      audioBase64?: string | null;
      audioMime?: string;
      ttsFallbackReason?: string;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.audioBase64) {
      return null;
    }
    return { audioBase64: data.audioBase64, audioMime: data.audioMime };
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async playBuffer(
    audioBase64: string,
    onEnd?: () => void,
    gen?: number
  ): Promise<void> {
    const myGen = gen ?? this.speakGen;
    if (myGen !== this.speakGen) return;
    if (!this.audioCtx) {
      throw new Error("AudioContext no disponible");
    }

    const buffer = await this.audioCtx.decodeAudioData(
      this.base64ToBuffer(audioBase64)
    );

    if (myGen !== this.speakGen) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = this.audioCtx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(this.audioCtx.destination);

    source.onended = () => {
      if (myGen !== this.speakGen) return;
      this.speaking = false;
      this.gainNode = null;
      this.notify();
      onEnd?.();
    };

    source.start(0);
    this.source = source;
    this.gainNode = gain;
    this.speaking = true;
    this.notify();
  }

  private fallbackSpeak(text: string, onEnd?: () => void, gen?: number) {
    const myGen = gen ?? this.speakGen;
    if (myGen !== this.speakGen) return;
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-AR";
    u.rate = 1.02;
    u.onstart = () => {
      this.speaking = true;
      this.notify();
    };
    u.onend = () => {
      if (myGen !== this.speakGen) return;
      this.speaking = false;
      this.notify();
      onEnd?.();
    };
    u.onerror = () => {
      if (myGen !== this.speakGen) return;
      this.speaking = false;
      this.notify();
      onEnd?.();
    };
    window.speechSynthesis.speak(u);
  }

  stopSpeaking(keepGen?: number): void {
    if (keepGen === undefined) {
      this.speakGen += 1;
    }
    if (this.gainNode && this.audioCtx) {
      try {
        this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
      } catch {
        // ignore
      }
    }
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // ignore
      }
      this.source.onended = null;
      this.source = null;
    }
    this.gainNode = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.fallback = null;
    }
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

  destroy(): void {
    this.stopSpeaking();
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      void this.audioCtx.close().then(() => {
        this.audioCtx = null;
      });
    } else {
      this.audioCtx = null;
    }
  }
}
