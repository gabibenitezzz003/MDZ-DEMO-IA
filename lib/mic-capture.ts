/** Client-side helpers for MediaRecorder + VAD capture. */

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "audio/webm";
}

export function computeRms(analyser: AnalyserNode): number {
  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/** Energía relativa en bandas de voz (~300–3400 Hz) vs ruido total. */
export function voiceBandRatio(analyser: AnalyserNode, sampleRate: number): number {
  const bins = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(bins);
  const hzPerBin = sampleRate / analyser.fftSize;
  let voice = 0;
  let total = 0;
  for (let i = 0; i < bins.length; i += 1) {
    const hz = i * hzPerBin;
    const v = bins[i] / 255;
    total += v;
    if (hz >= 280 && hz <= 3400) voice += v;
  }
  if (total < 0.001) return 0;
  return voice / total;
}

export type VadGate = {
  noiseFloor: number;
  speechHoldMs: number;
  silenceHoldMs: number;
  bargeHoldMs: number;
  inSpeech: boolean;
  utteranceMs: number;
};

export function createVadGate(): VadGate {
  return {
    noiseFloor: 0.016,
    speechHoldMs: 0,
    silenceHoldMs: 0,
    bargeHoldMs: 0,
    inSpeech: false,
    utteranceMs: 0,
  };
}

/**
 * VAD usable en demo: sensible a voz real, sin exigir push-to-talk.
 * El piso de ruido ayuda un poco, pero no bloquea frases cortas.
 */
export function stepVadGate(
  gate: VadGate,
  rms: number,
  voiceRatio: number,
  dtMs: number
): { start: boolean; end: boolean; barge: boolean } {
  const MIN_FLOOR = 0.01;
  const MAX_FLOOR = 0.06;
  const MARGIN = 0.014;
  const ABS_MIN = 0.018;
  const ONSET_MS = 90;
  const HANGOVER_MS = 1100;
  const SHORT_UTTERANCE_MS = 900;
  const SHORT_HANGOVER_MS = 1600;
  const BARGE_MARGIN = 0.028;

  if (!gate.inSpeech) {
    const alpha = rms < gate.noiseFloor ? 0.12 : 0.04;
    gate.noiseFloor = gate.noiseFloor * (1 - alpha) + rms * alpha;
    gate.noiseFloor = Math.max(MIN_FLOOR, Math.min(MAX_FLOOR, gate.noiseFloor));
  }

  const speechThresh = Math.max(ABS_MIN, gate.noiseFloor + MARGIN);
  const bargeThresh = Math.max(ABS_MIN + 0.01, gate.noiseFloor + BARGE_MARGIN);
  // voiceRatio es ayuda, no veto duro (antes bloqueaba casi todo).
  const looksLikeVoice =
    rms >= speechThresh && (voiceRatio >= 0.22 || rms >= speechThresh + 0.012);
  const bargeCandidate = rms >= bargeThresh && voiceRatio >= 0.24;
  gate.bargeHoldMs = bargeCandidate
    ? gate.bargeHoldMs + dtMs
    : Math.max(0, gate.bargeHoldMs - dtMs * 2);
  // Un golpe, aplauso o pico del ambiente no debe cortar la respuesta hablada.
  const barge = gate.bargeHoldMs >= 110;

  if (looksLikeVoice) {
    gate.speechHoldMs += dtMs;
    gate.silenceHoldMs = 0;
    if (gate.inSpeech) gate.utteranceMs += dtMs;
    if (!gate.inSpeech && gate.speechHoldMs >= ONSET_MS) {
      gate.inSpeech = true;
      gate.utteranceMs = gate.speechHoldMs;
      gate.speechHoldMs = 0;
      return { start: true, end: false, barge };
    }
  } else {
    gate.speechHoldMs = Math.max(0, gate.speechHoldMs - dtMs * 1.5);
    if (gate.inSpeech) {
      gate.silenceHoldMs += dtMs;
      const neededSilence =
        gate.utteranceMs < SHORT_UTTERANCE_MS
          ? SHORT_HANGOVER_MS
          : HANGOVER_MS;
      if (gate.silenceHoldMs >= neededSilence) {
        const end = gate.utteranceMs >= 280;
        gate.inSpeech = false;
        gate.silenceHoldMs = 0;
        gate.speechHoldMs = 0;
        gate.utteranceMs = 0;
        return { start: false, end, barge: false };
      }
    }
  }

  return { start: false, end: false, barge };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
