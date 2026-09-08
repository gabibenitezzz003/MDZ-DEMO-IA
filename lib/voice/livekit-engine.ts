"use client";

import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import type { VoiceEngine, VoiceState } from "./types";

export class LiveKitVoiceEngine implements VoiceEngine {
  private room: Room | null = null;
  private listening = false;
  private speaking = false;
  private connected = false;

  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceState) => void;

  private notify() {
    this.onStateChange?.({
      listening: this.listening,
      speaking: this.speaking,
      thinking: false,
    });
  }

  async connect(roomName = "demo-agricultura-room", participantName = "productor") {
    if (typeof window === "undefined") return;

    try {
      const res = await fetch("/api/livekit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, participantName }),
      });
      const data = await res.json() as {
        ok: boolean;
        token?: string;
        url?: string;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.token || !data.url) {
        throw new Error(data.error || "token_failed");
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room.on(RoomEvent.Connected, () => {
        this.connected = true;
      });

      room.on(RoomEvent.Disconnected, () => {
        this.connected = false;
        this.listening = false;
        this.speaking = false;
        this.notify();
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.setAttribute("autoplay", "true");
          this.speaking = true;
          this.notify();
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach();
          this.speaking = false;
          this.notify();
        }
      });

      room.on(RoomEvent.TrackMuted, (pub) => {
        if (pub.track?.kind === Track.Kind.Audio) {
          this.speaking = false;
          this.notify();
        }
      });

      room.on(RoomEvent.TrackUnmuted, (pub) => {
        if (pub.track?.kind === Track.Kind.Audio) {
          this.speaking = true;
          this.notify();
        }
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const text = new TextDecoder().decode(payload);
          const parsed = JSON.parse(text);
          if (parsed.transcript) {
            this.onTranscript?.(parsed.transcript, parsed.isFinal ?? true);
          }
        } catch {
          // ignore non-JSON data
        }
      });

      await room.connect(data.url, data.token);
      this.room = room;
      await room.localParticipant.setMicrophoneEnabled(true);
      this.listening = true;
      this.notify();
    } catch (err) {
      this.onError?.(`LiveKit: ${String(err)}`);
      this.listening = false;
      this.notify();
    }
  }

  startListening(): void {
    if (this.connected) return;
    void this.connect();
  }

  stopListening(): void {
    this.listening = false;
    this.notify();
    if (this.room) {
      this.room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
    }
  }

  isListening(): boolean {
    return this.listening;
  }

  speak(_text: string, onEnd?: () => void): void {
    // En LiveKit el agente remoto genera el audio. El frontend no habla por sí mismo.
    // Si no hay agente conectado, llamamos onEnd inmediatamente.
    onEnd?.();
  }

  stopSpeaking(): void {
    // Silenciar audio remoto no es necesario; el agente controla su propio audio.
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  setSpeaking(value: boolean): void {
    this.speaking = value;
    this.notify();
  }

  destroy(): void {
    this.stopListening();
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
  }
}
