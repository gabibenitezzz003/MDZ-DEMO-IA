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
  const buf = buffers(analyser).time;
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/** Banda donde vive la voz humana (formantes principales). */
const VOICE_LO_HZ = 280;
const VOICE_HI_HZ = 3400;
/** Banda para medir estructura espectral: la voz tiene picos, el ruido es plano. */
const CONTRAST_LO_HZ = 200;
const CONTRAST_HI_HZ = 4000;
/** Piso del divisor del contraste. Evita que el silencio parezca estructurado. */
const CONTRAST_MEAN_FLOOR = 0.08;

/** Valores medidos con FFT real de Chrome; ver mic-capture.test.ts. */
export type SpectrumFeatures = {
  /** Energía en banda de voz sobre el total. Voz ≈ 0.91, ventilador ≈ 0.18, ruido ancho ≈ 0.13. */
  voiceRatio: number;
  /** Variación del espectro. Voz ≈ 0.72, ventilador ≈ 0.15, ruido ancho ≈ 0.08. */
  contrast: number;
  /** Energía por debajo de 280 Hz frente a la banda de voz. Aire/motor/tráfico ≈ alto. */
  lowRatio: number;
};

const EMPTY_SPECTRUM: SpectrumFeatures = {
  voiceRatio: 0,
  contrast: 0,
  lowRatio: 1,
};

/**
 * Descriptores espectrales de un frame. Función pura para poder testearla
 * sin WebAudio.
 */
export function spectrumFeatures(
  bins: ArrayLike<number>,
  hzPerBin: number
): SpectrumFeatures {
  if (!bins.length || hzPerBin <= 0) return EMPTY_SPECTRUM;

  let total = 0;
  let voice = 0;
  let low = 0;
  let contrastSum = 0;
  let contrastBins = 0;

  for (let i = 0; i < bins.length; i += 1) {
    const hz = i * hzPerBin;
    const v = bins[i] / 255;
    total += v;
    if (hz >= VOICE_LO_HZ && hz <= VOICE_HI_HZ) voice += v;
    else if (hz < VOICE_LO_HZ) low += v;
    if (hz >= CONTRAST_LO_HZ && hz <= CONTRAST_HI_HZ) {
      contrastSum += v;
      contrastBins += 1;
    }
  }

  if (total < 1e-4) return EMPTY_SPECTRUM;

  const mean = contrastBins ? contrastSum / contrastBins : 0;
  let varSum = 0;
  if (contrastBins) {
    for (let i = 0; i < bins.length; i += 1) {
      const hz = i * hzPerBin;
      if (hz < CONTRAST_LO_HZ || hz > CONTRAST_HI_HZ) continue;
      const d = bins[i] / 255 - mean;
      varSum += d * d;
    }
  }
  const std = contrastBins ? Math.sqrt(varSum / contrastBins) : 0;

  return {
    voiceRatio: voice / total,
    // Normalizado contra la media para medir forma y no volumen, pero con piso
    // en el divisor: en silencio la media es diminuta y std/mean se dispara,
    // dando "estructura" altísima justo donde no hay señal.
    contrast: std / Math.max(mean, CONTRAST_MEAN_FLOOR),
    lowRatio: voice + low > 1e-6 ? low / (voice + low) : 1,
  };
}

/** Energía relativa en bandas de voz (~280–3400 Hz) vs ruido total. */
export function voiceBandRatio(
  analyser: AnalyserNode,
  sampleRate: number
): number {
  const bins = buffers(analyser).freq;
  analyser.getByteFrequencyData(bins);
  return spectrumFeatures(bins, sampleRate / analyser.fftSize).voiceRatio;
}

export type VoiceFrame = SpectrumFeatures & { rms: number };

/** Buffers reusados por analyser: un frame corre ~60 veces por segundo. */
type FrameBuffers = {
  time: Uint8Array<ArrayBuffer>;
  freq: Uint8Array<ArrayBuffer>;
};

const bufferCache = new WeakMap<AnalyserNode, FrameBuffers>();

function buffers(analyser: AnalyserNode): FrameBuffers {
  const cached = bufferCache.get(analyser);
  if (
    cached &&
    cached.time.length === analyser.fftSize &&
    cached.freq.length === analyser.frequencyBinCount
  ) {
    return cached;
  }
  const fresh: FrameBuffers = {
    time: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
    freq: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
  };
  bufferCache.set(analyser, fresh);
  return fresh;
}

/** Un solo paso de análisis por frame: nivel + forma espectral. */
export function analyzeFrame(
  analyser: AnalyserNode,
  sampleRate: number
): VoiceFrame {
  const buf = buffers(analyser);
  analyser.getByteTimeDomainData(buf.time);
  let sum = 0;
  for (let i = 0; i < buf.time.length; i += 1) {
    const v = (buf.time[i] - 128) / 128;
    sum += v * v;
  }
  analyser.getByteFrequencyData(buf.freq);
  return {
    rms: Math.sqrt(sum / buf.time.length),
    ...spectrumFeatures(buf.freq, sampleRate / analyser.fftSize),
  };
}

export type VadTuning = {
  /** Ambiente medido antes de habilitar detección. Evita disparos al abrir el mic. */
  calibrationMs: number;
  /** Voz sostenida necesaria para abrir la puerta. */
  onsetMs: number;
  /** Silencio que cierra una frase normal. */
  hangoverMs: number;
  /** Frases cortas esperan más: el usuario suele seguir hablando. */
  shortUtteranceMs: number;
  shortHangoverMs: number;
  /** Voz real mínima para aceptar la grabación. Debajo de esto es ruido. */
  minVoicedMs: number;
  /** Proporción mínima de frames con voz dentro de la frase. */
  minVoicedRatio: number;
  /** Voz sostenida para interrumpir al asistente hablando. */
  bargeMs: number;
  /** Techo de energía grave admitida (aire acondicionado, motores, tráfico). */
  maxLowRatio: number;
};

export const DEFAULT_VAD_TUNING: VadTuning = {
  calibrationMs: 550,
  // Corto a propósito: quien filtra ruido es la forma espectral, no el tiempo.
  // Exigir más sólo agrega latencia al usuario sin agregar rechazo.
  onsetMs: 120,
  hangoverMs: 900,
  shortUtteranceMs: 900,
  shortHangoverMs: 1400,
  minVoicedMs: 420,
  minVoicedRatio: 0.32,
  bargeMs: 340,
  maxLowRatio: 0.5,
};

/** Piso de ruido: rango amplio para salas ruidosas, sin quedarse pegado abajo. */
const MIN_FLOOR = 0.006;
const MAX_FLOOR = 0.14;
/**
 * La energía es el discriminador débil: medido con FFT real, un ventilador da
 * rms 0.30 contra 0.05 de una voz normal. Quien separa de verdad es la forma
 * espectral (voz: voiceRatio ~0.91 / contrast ~0.73; ruido: ~0.18 / ~0.14).
 * Por eso el umbral de energía queda bajo —para no perder voz suave— y el peso
 * del filtrado recae en las dos métricas de forma.
 */
const ENERGY_MARGIN = 0.008;
const ENERGY_SNR = 1.7;
const ABS_MIN = 0.01;
/** Forma espectral mínima exigida siempre, además del ambiente medido. */
const MIN_VOICE_RATIO = 0.3;
const VOICE_RATIO_MARGIN = 0.05;
const MIN_CONTRAST = 0.42;
/** Solo un sonido MUY fuerte se salta la prueba de estructura espectral. */
const STRONG_ENERGY_MULT = 2.5;
/** Fracción del umbral que sostiene una frase ya empezada (disparador Schmitt). */
const SUSTAIN_RATIO = 0.55;
/** Interrumpir exige mejor relación señal/ruido que empezar a hablar. */
const BARGE_ENERGY_MULT = 1.45;

export type VadGate = {
  noiseFloor: number;
  noiseVoiceRatio: number;
  calibratedMs: number;
  speechHoldMs: number;
  silenceHoldMs: number;
  bargeHoldMs: number;
  inSpeech: boolean;
  utteranceMs: number;
  voicedMs: number;
  tuning: VadTuning;
};

export function createVadGate(tuning?: Partial<VadTuning>): VadGate {
  return {
    noiseFloor: 0.012,
    noiseVoiceRatio: 0.2,
    calibratedMs: 0,
    speechHoldMs: 0,
    silenceHoldMs: 0,
    bargeHoldMs: 0,
    inSpeech: false,
    utteranceMs: 0,
    voicedMs: 0,
    tuning: { ...DEFAULT_VAD_TUNING, ...tuning },
  };
}

export type VadStep = {
  /** Arrancó una frase: hay que empezar a grabar. */
  start: boolean;
  /** Terminó una frase con voz suficiente: mandar a STT. */
  end: boolean;
  /** Terminó una frase que resultó ser ruido: descartar la grabación. */
  discard: boolean;
  /** Voz sostenida mientras el asistente habla: interrumpir. */
  barge: boolean;
  /** Este frame parece voz humana. */
  voiced: boolean;
  /** Todavía midiendo el ambiente. */
  calibrating: boolean;
  /** Duración de la frase que acaba de cerrar (0 si no cerró ninguna). */
  utteranceMs: number;
  /** Voz real dentro de esa frase. */
  voicedMs: number;
};

const IDLE: VadStep = {
  start: false,
  end: false,
  discard: false,
  barge: false,
  voiced: false,
  calibrating: false,
  utteranceMs: 0,
  voicedMs: 0,
};

function lerp(current: number, target: number, alpha: number) {
  return current * (1 - alpha) + target * alpha;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * VAD para sala real: mide el ambiente, exige forma de voz (no solo volumen)
 * y descarta las frases que resultaron ser ruido antes de gastar STT.
 *
 * `holdAmbient` congela la referencia de ambiente mientras el asistente habla,
 * para que el TTS que se filtra por los parlantes no suba el piso de ruido.
 */
export function stepVadGate(
  gate: VadGate,
  frame: VoiceFrame,
  dtMs: number,
  opts: { holdAmbient?: boolean } = {}
): VadStep {
  const t = gate.tuning;
  const { rms, voiceRatio, contrast, lowRatio } = frame;

  const calibrating = gate.calibratedMs < t.calibrationMs;
  if (calibrating) gate.calibratedMs += dtMs;

  // Margen fijo para salas silenciosas, relación S/R para salas ruidosas.
  const energyThresh = Math.max(
    ABS_MIN,
    gate.noiseFloor + ENERGY_MARGIN,
    gate.noiseFloor * ENERGY_SNR
  );
  const voiceThresh = Math.max(
    MIN_VOICE_RATIO,
    gate.noiseVoiceRatio + VOICE_RATIO_MARGIN
  );

  // Volumen alto NO alcanza: un portazo o un aplauso pasan el umbral de energía
  // pero no tienen banda de voz ni estructura de formantes.
  const shapedLikeVoice = voiceRatio >= voiceThresh && lowRatio <= t.maxLowRatio;
  // El contraste es una medida de forma con significado propio: no se adapta al
  // ambiente. Adaptarlo hacia arriba endurecía la puerta justo en salas
  // silenciosas, que es donde el usuario más espera que lo escuchen.
  const structured =
    contrast >= MIN_CONTRAST || rms >= energyThresh * STRONG_ENERGY_MULT;
  const spectralVoice = !calibrating && shapedLikeVoice && structured;

  // Disparo alto / sostén bajo. Entre sílabas la voz cae a menos de la mitad de
  // su pico: con un solo umbral el arranque se reinicia en cada valle y la
  // puerta no abre nunca. El umbral alto decide que empezó a hablar; el bajo
  // mantiene la frase viva mientras siga teniendo forma de voz.
  const onsetFrame = spectralVoice && rms >= energyThresh;
  const sustainFrame = spectralVoice && rms >= energyThresh * SUSTAIN_RATIO;
  const voiced = gate.inSpeech ? sustainFrame : onsetFrame;

  // El ambiente SOLO aprende de frames que no son voz ni parte tranquila de una
  // voz, y tampoco mientras se acumula un arranque. Si adapta mientras el
  // usuario habla, el piso trepa hacia su propia voz y el umbral sube más rápido
  // de lo que el arranque acumula: se traba sola.
  if (
    !opts.holdAmbient &&
    !gate.inSpeech &&
    !sustainFrame &&
    gate.speechHoldMs === 0
  ) {
    // Baja rápido y sube muy lento: el piso sigue los momentos tranquilos del
    // ambiente, no su promedio. Bajar rápido evita que un ruido fuerte que
    // termina deje el umbral por encima de la voz; subir lento evita que una
    // frase que todavía no se detectó empuje el piso hacia la propia voz y se
    // trabe sola.
    const alpha = calibrating ? 0.3 : rms < gate.noiseFloor ? 0.3 : 0.008;
    gate.noiseFloor = clamp(
      lerp(gate.noiseFloor, rms, alpha),
      MIN_FLOOR,
      MAX_FLOOR
    );
    gate.noiseVoiceRatio = lerp(gate.noiseVoiceRatio, voiceRatio, alpha);
  }

  // Interrumpir al asistente pide más señal y más tiempo que empezar a hablar.
  const bargeFrame = voiced && rms >= energyThresh * BARGE_ENERGY_MULT;
  gate.bargeHoldMs = bargeFrame
    ? gate.bargeHoldMs + dtMs
    : Math.max(0, gate.bargeHoldMs - dtMs * 2);
  const barge = gate.bargeHoldMs >= t.bargeMs;

  if (voiced) {
    gate.silenceHoldMs = 0;
    if (gate.inSpeech) {
      gate.utteranceMs += dtMs;
      gate.voicedMs += dtMs;
      return { ...IDLE, voiced: true, barge, calibrating };
    }
    gate.speechHoldMs += dtMs;
    if (gate.speechHoldMs >= t.onsetMs) {
      gate.inSpeech = true;
      gate.utteranceMs = gate.speechHoldMs;
      gate.voicedMs = gate.speechHoldMs;
      gate.speechHoldMs = 0;
      return { ...IDLE, start: true, voiced: true, barge, calibrating };
    }
    return { ...IDLE, voiced: true, barge, calibrating };
  }

  // Valle dentro de un arranque en curso: no suma, pero tampoco enfría. Es la
  // pausa entre sílabas de alguien que ya empezó a hablar.
  if (!gate.inSpeech && sustainFrame && gate.speechHoldMs > 0) {
    return { ...IDLE, barge, calibrating };
  }

  // Frame sin voz: el arranque se enfría rápido para que picos sueltos no sumen.
  gate.speechHoldMs = Math.max(0, gate.speechHoldMs - dtMs * 1.5);

  if (!gate.inSpeech) return { ...IDLE, barge, calibrating };

  gate.utteranceMs += dtMs;
  gate.silenceHoldMs += dtMs;
  const neededSilence =
    gate.utteranceMs < t.shortUtteranceMs ? t.shortHangoverMs : t.hangoverMs;
  if (gate.silenceHoldMs < neededSilence) {
    return { ...IDLE, barge, calibrating };
  }

  // La frase cerró: descontamos el hangover, que es silencio por definición.
  const utteranceMs = Math.max(0, gate.utteranceMs - gate.silenceHoldMs);
  const voicedMs = gate.voicedMs;
  gate.inSpeech = false;
  gate.silenceHoldMs = 0;
  gate.speechHoldMs = 0;
  gate.utteranceMs = 0;
  gate.voicedMs = 0;

  const enough =
    voicedMs >= t.minVoicedMs &&
    utteranceMs > 0 &&
    voicedMs / utteranceMs >= t.minVoicedRatio;

  return {
    ...IDLE,
    end: enough,
    discard: !enough,
    calibrating,
    utteranceMs,
    voicedMs,
  };
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
