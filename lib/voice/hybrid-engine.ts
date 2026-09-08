"use client";

import { BrowserVoiceEngine } from "./browser-engine";
import { ElevenLabsVoiceEngine } from "./elevenlabs-engine";
import { TtsBargeMonitor } from "./tts-barge-monitor";
import type { VoiceEngine, VoiceState } from "./types";

export class HybridVoiceEngine implements VoiceEngine {
  private stt: BrowserVoiceEngine;
  private tts: ElevenLabsVoiceEngine;
  private bargeMonitor = new TtsBargeMonitor();

  onTranscript?: (text: string, isFinal: boolean) => void;
  /** VAD detectó voz del usuario mientras el TTS sonaba. */
  onBargeIn?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceState) => void;

  constructor() {
    this.stt = new BrowserVoiceEngine();
    this.tts = new ElevenLabsVoiceEngine();

    this.bargeMonitor.onBarge = () => {
      if (!this.tts.isSpeaking()) return;
      this.interruptTts();
      this.onBargeIn?.();
    };

    const forward = () =>
      this.onStateChange?.({
        listening: this.stt.isListening(),
        speaking: this.tts.isSpeaking(),
        thinking: false,
      });

    this.stt.onStateChange = forward;
    this.tts.onStateChange = () => {
      const ttsSpeaking = this.tts.isSpeaking();
      this.stt.setSpeaking(ttsSpeaking);
      if (ttsSpeaking) {
        this.stt.setBargeInEnabled?.(true);
        // Durante TTS: VAD en el mic (corte instantáneo). STT se reactiva al cortar o al terminar.
        this.stt.stopListening();
        void this.bargeMonitor.start();
      } else {
        this.bargeMonitor.stop();
      }
      forward();
    };

    this.stt.onTranscript = (text, isFinal) => this.onTranscript?.(text, isFinal);
    this.stt.onError = (err) => this.onError?.(err);
    this.tts.onError = (err) => this.onError?.(err);
  }

  private interruptTts(): void {
    this.tts.stopSpeaking();
    this.stt.setSpeaking(false);
    this.bargeMonitor.stop();
    this.stt.setBargeInEnabled?.(true);
    window.setTimeout(() => {
      if (!this.tts.isSpeaking()) {
        this.stt.startListening();
      }
    }, 40);
  }

  startListening(): void {
    this.bargeMonitor.stop();
    this.stt.startListening();
  }

  stopListening(): void {
    this.stt.stopListening();
    if (!this.tts.isSpeaking()) {
      this.bargeMonitor.stop();
    }
  }

  isListening(): boolean {
    return this.stt.isListening();
  }

  resumeAudioContext(): void {
    this.tts.resumeAudioContext?.();
  }

  speak(
    text: string,
    onEnd?: () => void,
    opts?: { fast?: boolean; audioBase64?: string; audioMime?: string }
  ): void {
    if (opts?.fast) {
      this.stt.speak(text, onEnd, opts);
      return;
    }
    this.stt.setLastSpokenText?.(text);
    this.stt.setBargeInEnabled?.(true);
    this.stt.stopListening();
    void this.bargeMonitor.start();
    this.tts.speak(text, () => {
      this.bargeMonitor.stop();
      this.stt.setSpeaking(false);
      this.stt.startListening();
      onEnd?.();
    }, opts);
  }

  stopSpeaking(): void {
    this.interruptTts();
  }

  isSpeaking(): boolean {
    return this.tts.isSpeaking() || this.stt.isSpeaking();
  }

  setSpeaking(value: boolean): void {
    this.tts.setSpeaking(value);
  }

  setBargeInEnabled(enabled: boolean): void {
    this.stt.setBargeInEnabled?.(enabled);
  }

  destroy(): void {
    this.bargeMonitor.stop();
    this.stt.destroy();
    this.tts.destroy();
  }
}
