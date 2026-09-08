import { BrowserVoiceEngine } from "./browser-engine";
import { HybridVoiceEngine } from "./hybrid-engine";
import { LiveKitVoiceEngine } from "./livekit-engine";
import type { VoiceEngine, VoiceRuntime } from "./types";

export function voiceRuntimeFromEnv(): VoiceRuntime {
  if (typeof process === "undefined" || !process.env) return "browser";
  const fromPublic =
    process.env.NEXT_PUBLIC_VOICE_RUNTIME?.trim() ||
    process.env.VOICE_RUNTIME?.trim() ||
    "browser";
  return fromPublic as VoiceRuntime;
}

export function createVoiceEngine(runtime: VoiceRuntime = "browser"): VoiceEngine {
  if (runtime === "browser") return new BrowserVoiceEngine();

  if (runtime === "elevenlabs") {
    // STT nativo del navegador + TTS premium de ElevenLabs.
    return new HybridVoiceEngine();
  }

  if (runtime === "openai-realtime") {
    // TODO: requiere conexión WebRTC a OpenAI Realtime API. Ver docs/v2.1/
    return new BrowserVoiceEngine();
  }

  if (runtime === "livekit") {
    // Requiere servidor LiveKit y livekit-client. Ver docs/v2.1/
    return new LiveKitVoiceEngine();
  }

  return new BrowserVoiceEngine();
}
