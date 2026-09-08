export interface VoiceEngine {
  startListening(): void;
  stopListening(): void;
  isListening(): boolean;
  speak(
    text: string,
    onEnd?: () => void,
    opts?: { fast?: boolean; audioBase64?: string; audioMime?: string }
  ): void;
  stopSpeaking(): void;
  isSpeaking(): boolean;
  resumeAudioContext?(): void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  /** VAD detectó voz del usuario mientras el TTS sonaba. */
  onBargeIn?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceState) => void;
  setSpeaking(isSpeaking: boolean): void;
  /** Mantener STT activo durante TTS para interrupciones (barge-in). */
  setBargeInEnabled?(enabled: boolean): void;
  destroy?(): void;
}

export type VoiceState = {
  listening: boolean;
  speaking: boolean;
  thinking: boolean;
};

export type VoiceRuntime = "browser" | "elevenlabs" | "openai-realtime" | "livekit";
