import { describe, expect, it } from "vitest";
import {
  createVadGate,
  spectrumFeatures,
  stepVadGate,
  type VoiceFrame,
} from "@/lib/mic-capture";

const HZ_PER_BIN = 48_000 / 2048;
const BINS = 1024;

/** Espectro sintético: nivel por banda en bytes 0–255. */
function makeBins(opts: { low: number; voice: number; high: number; peaks?: boolean }) {
  const bins = new Uint8Array(BINS);
  for (let i = 0; i < BINS; i += 1) {
    const hz = i * HZ_PER_BIN;
    if (hz < 280) bins[i] = opts.low;
    else if (hz <= 3400) {
      // La voz real tiene formantes: picos y valles dentro de la banda.
      bins[i] = opts.peaks && i % 7 < 2 ? Math.min(255, opts.voice * 2) : opts.voice;
    } else bins[i] = opts.high;
  }
  return bins;
}

const SPEECH: VoiceFrame = {
  rms: 0.09,
  ...spectrumFeatures(makeBins({ low: 40, voice: 90, high: 20, peaks: true }), HZ_PER_BIN),
};

const ROOM_NOISE: VoiceFrame = {
  rms: 0.012,
  ...spectrumFeatures(makeBins({ low: 30, voice: 14, high: 10 }), HZ_PER_BIN),
};

/** Ventilador / aire acondicionado fuerte: mucha energía, casi toda grave. */
const FAN: VoiceFrame = {
  rms: 0.055,
  ...spectrumFeatures(makeBins({ low: 150, voice: 45, high: 22 }), HZ_PER_BIN),
};

/** Portazo o aplauso: fuerte y de banda ancha, sin estructura de voz. */
const SLAM: VoiceFrame = {
  rms: 0.14,
  ...spectrumFeatures(makeBins({ low: 130, voice: 120, high: 115 }), HZ_PER_BIN),
};

const SILENCE: VoiceFrame = {
  rms: 0.004,
  ...spectrumFeatures(makeBins({ low: 6, voice: 4, high: 3 }), HZ_PER_BIN),
};

/** Corre `ms` de un mismo frame en pasos de 40 ms y junta los resultados. */
function run(gate: ReturnType<typeof createVadGate>, frame: VoiceFrame, ms: number) {
  const steps = [];
  for (let t = 0; t < ms; t += 40) {
    steps.push(stepVadGate(gate, frame, 40));
  }
  return steps;
}

function calibrated(ambient: VoiceFrame = ROOM_NOISE) {
  const gate = createVadGate();
  run(gate, ambient, 1200);
  return gate;
}

describe("spectrumFeatures", () => {
  it("separates voice-band energy from low rumble", () => {
    const speech = spectrumFeatures(
      makeBins({ low: 40, voice: 90, high: 20, peaks: true }),
      HZ_PER_BIN
    );
    const fan = spectrumFeatures(makeBins({ low: 150, voice: 45, high: 22 }), HZ_PER_BIN);
    expect(speech.voiceRatio).toBeGreaterThan(fan.voiceRatio);
    expect(fan.lowRatio).toBeGreaterThan(speech.lowRatio);
  });

  it("gives flat noise less spectral contrast than voice", () => {
    const speech = spectrumFeatures(
      makeBins({ low: 40, voice: 90, high: 20, peaks: true }),
      HZ_PER_BIN
    );
    const flat = spectrumFeatures(makeBins({ low: 90, voice: 90, high: 90 }), HZ_PER_BIN);
    expect(speech.contrast).toBeGreaterThan(flat.contrast);
  });

  it("does not report near-silence as structured", () => {
    // Regresión: sin piso en el divisor, std/mean se dispara en silencio y el
    // silencio marcaba MÁS contraste que la voz (1.14 vs 0.72 medidos en
    // Chrome), endureciendo la puerta justo en salas tranquilas.
    const silence = spectrumFeatures(makeBins({ low: 6, voice: 4, high: 3 }), HZ_PER_BIN);
    const speech = spectrumFeatures(
      makeBins({ low: 40, voice: 90, high: 20, peaks: true }),
      HZ_PER_BIN
    );
    expect(silence.contrast).toBeLessThan(speech.contrast);
    expect(silence.contrast).toBeLessThan(0.42);
  });

  it("survives an empty spectrum", () => {
    expect(spectrumFeatures(new Uint8Array(BINS), HZ_PER_BIN).voiceRatio).toBe(0);
    expect(spectrumFeatures([], HZ_PER_BIN).voiceRatio).toBe(0);
  });
});

describe("stepVadGate calibration", () => {
  it("ignores everything while measuring the room", () => {
    const gate = createVadGate();
    const early = run(gate, SPEECH, 400);
    expect(early.every((s) => !s.start && s.calibrating)).toBe(true);
  });

  it("opens for real speech once calibrated", () => {
    const gate = calibrated();
    expect(run(gate, SPEECH, 400).some((s) => s.start)).toBe(true);
  });
});

describe("stepVadGate noise rejection", () => {
  it("never opens on steady room noise", () => {
    const gate = calibrated();
    expect(run(gate, ROOM_NOISE, 4000).some((s) => s.start)).toBe(false);
  });

  it("never opens on a loud fan", () => {
    const gate = calibrated();
    expect(run(gate, FAN, 4000).some((s) => s.start)).toBe(false);
  });

  it("does not treat a door slam as speech", () => {
    const gate = calibrated();
    // Un golpe dura poco: 200 ms de ruido de banda ancha y vuelta al silencio.
    const steps = [...run(gate, SLAM, 200), ...run(gate, ROOM_NOISE, 400)];
    expect(steps.some((s) => s.start)).toBe(false);
  });

  it("adapts to a noisy room instead of latching open", () => {
    // El ambiente arranca tranquilo y sube: el VAD debe re-aprender el piso.
    const gate = calibrated();
    run(gate, FAN, 5000);
    expect(run(gate, FAN, 2000).some((s) => s.start)).toBe(false);
    // Y aun así la voz por encima de ese ruido tiene que pasar.
    expect(run(gate, { ...SPEECH, rms: 0.13 }, 500).some((s) => s.start)).toBe(true);
  });
});

describe("stepVadGate utterance lifecycle", () => {
  it("closes an utterance after the hangover and reports it usable", () => {
    const gate = calibrated();
    run(gate, SPEECH, 1600);
    const tail = run(gate, SILENCE, 2000);
    const closed = tail.find((s) => s.end || s.discard);
    expect(closed?.end).toBe(true);
    expect(closed?.discard).toBe(false);
    expect(closed?.voicedMs).toBeGreaterThanOrEqual(1200);
  });

  it("discards an utterance that was mostly silence", () => {
    const gate = calibrated();
    // Apenas supera el onset y se corta: no hay voz suficiente para STT.
    run(gate, SPEECH, 240);
    const tail = run(gate, SILENCE, 2200);
    const closed = tail.find((s) => s.end || s.discard);
    expect(closed?.discard).toBe(true);
    expect(closed?.end).toBe(false);
  });

  it("does not close mid-sentence on a short pause", () => {
    const gate = calibrated();
    run(gate, SPEECH, 1600);
    const pause = run(gate, SILENCE, 600);
    expect(pause.some((s) => s.end || s.discard)).toBe(false);
    expect(run(gate, SPEECH, 400).some((s) => s.start)).toBe(false);
  });
});

/**
 * Valores medidos con el FFT real de Chrome sobre señales sintéticas
 * (ver commit): voz armónica con formantes, ventilador y ruido de banda ancha.
 * Fijan el comportamiento contra números reales, no contra espectros de test.
 */
describe("stepVadGate against real-FFT measurements", () => {
  const MEASURED = {
    voiceNormal: { rms: 0.0481, voiceRatio: 0.912, contrast: 0.725, lowRatio: 0.067 },
    voiceQuiet: { rms: 0.0174, voiceRatio: 0.913, contrast: 0.829, lowRatio: 0.071 },
    fanLoud: { rms: 0.3024, voiceRatio: 0.181, contrast: 0.145, lowRatio: 0.1 },
    slam: { rms: 0.2021, voiceRatio: 0.131, contrast: 0.078, lowRatio: 0.072 },
  } satisfies Record<string, VoiceFrame>;

  it("hears a normally-spoken voice", () => {
    const gate = calibrated();
    expect(run(gate, MEASURED.voiceNormal, 500).some((s) => s.start)).toBe(true);
  });

  it("still hears a quiet voice in a quiet room", () => {
    const gate = calibrated(SILENCE);
    expect(run(gate, MEASURED.voiceQuiet, 500).some((s) => s.start)).toBe(true);
  });

  it("needs the user to speak up when the room itself is loud", () => {
    // Voz a 1.45× el ruido de sala son ~3 dB de SNR: ahí no se abre la puerta,
    // y está bien — es el mismo margen que impide que una charla de fondo
    // dispare el micrófono.
    const gate = calibrated(ROOM_NOISE);
    expect(run(gate, MEASURED.voiceQuiet, 500).some((s) => s.start)).toBe(false);
    expect(run(gate, MEASURED.voiceNormal, 500).some((s) => s.start)).toBe(true);
  });

  it("rejects a fan that is six times louder than the voice", () => {
    expect(MEASURED.fanLoud.rms).toBeGreaterThan(MEASURED.voiceNormal.rms * 6);
    const gate = calibrated();
    const steps = run(gate, MEASURED.fanLoud, 5000);
    expect(steps.some((s) => s.start)).toBe(false);
    expect(steps.some((s) => s.barge)).toBe(false);
  });

  it("rejects broadband noise that is four times louder than the voice", () => {
    const gate = calibrated();
    const steps = run(gate, MEASURED.slam, 5000);
    expect(steps.some((s) => s.start)).toBe(false);
    expect(steps.some((s) => s.barge)).toBe(false);
  });

  it("recovers quickly when loud noise stops and the user speaks", () => {
    // Regresión: con el piso alto por el ruido previo y adaptación lenta, el
    // umbral quedaba por encima de la voz y convergía hacia ella, dejando al
    // usuario sin poder abrir la puerta.
    const gate = calibrated();
    run(gate, MEASURED.fanLoud, 4000);
    const steps = [
      ...run(gate, SILENCE, 500),
      ...run(gate, MEASURED.voiceNormal, 600),
    ];
    expect(steps.some((s) => s.start)).toBe(true);
  });

  it("hears the user over a running fan", () => {
    const gate = calibrated();
    run(gate, MEASURED.fanLoud, 4000);
    // Voz por encima del ventilador: energía del ruido, forma de voz.
    const over = { ...MEASURED.voiceNormal, rms: 0.34 };
    expect(run(gate, over, 500).some((s) => s.start)).toBe(true);
  });
});

describe("stepVadGate barge-in", () => {
  it("does not treat a single loud noise spike as barge", () => {
    const gate = calibrated();
    expect(stepVadGate(gate, SLAM, 40).barge).toBe(false);
  });

  it("does not let a fan interrupt the assistant", () => {
    const gate = calibrated();
    const steps = run(gate, FAN, 3000);
    expect(steps.some((s) => s.barge)).toBe(false);
  });

  it("lets sustained speech interrupt the assistant", () => {
    const gate = calibrated();
    expect(run(gate, SPEECH, 800).some((s) => s.barge)).toBe(true);
  });

  it("keeps the ambient reference frozen while the assistant talks", () => {
    const gate = calibrated();
    const before = gate.noiseFloor;
    for (let t = 0; t < 2000; t += 40) {
      stepVadGate(gate, FAN, 40, { holdAmbient: true });
    }
    expect(gate.noiseFloor).toBeCloseTo(before, 5);
  });
});
