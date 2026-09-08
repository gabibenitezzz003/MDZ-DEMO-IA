"use client";

import {
  analyzeFrame,
  createVadGate,
  stepVadGate,
  type VadGate,
} from "@/lib/mic-capture";

/**
 * Detecta voz humana mientras suena el TTS (cuando el STT del browser no transcribe).
 * Solo corre durante la reproducción — no abre pestañas ni compite con el STT en reposo.
 */
export class TtsBargeMonitor {
  private gate: VadGate = createVadGate({ bargeMs: 360 });
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf: number | null = null;
  private lastTs = 0;
  private active = false;
  private starting: Promise<void> | null = null;
  private lastBargeAt = 0;

  onBarge?: () => void;

  async start(): Promise<void> {
    if (this.active) return;
    if (this.starting) return this.starting;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    this.starting = (async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
            channelCount: 1,
          },
        });
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctx) return;

        this.ctx = new Ctx();
        if (this.ctx.state === "suspended") await this.ctx.resume();

        const source = this.ctx.createMediaStreamSource(this.stream);
        const highPass = this.ctx.createBiquadFilter();
        highPass.type = "highpass";
        highPass.frequency.value = 120;
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.35;
        source.connect(highPass);
        highPass.connect(this.analyser);

        this.gate = createVadGate({ bargeMs: 360 });
        this.active = true;
        this.lastTs = performance.now();
        this.tick();
      } catch {
        // Sin mic: el barge-in queda solo con STT si el browser coopera.
      } finally {
        this.starting = null;
      }
    })();

    return this.starting;
  }

  stop(): void {
    this.active = false;
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ctx && this.ctx.state !== "closed") {
      void this.ctx.close();
    }
    this.ctx = null;
    this.analyser = null;
  }

  isActive(): boolean {
    return this.active;
  }

  private tick = (): void => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.tick);

    const analyser = this.analyser;
    const ctx = this.ctx;
    if (!analyser || !ctx) return;

    const now = performance.now();
    const dt = Math.min(80, Math.max(8, now - this.lastTs));
    this.lastTs = now;

    const frame = analyzeFrame(analyser, ctx.sampleRate);
    const { barge } = stepVadGate(this.gate, frame, dt, { holdAmbient: true });

    if (barge) {
      const t = Date.now();
      if (t - this.lastBargeAt < 600) return;
      this.lastBargeAt = t;
      this.gate.bargeHoldMs = 0;
      this.onBarge?.();
    }
  };
}
