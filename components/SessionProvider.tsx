"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SessionContextValue = {
  sessionId: string | null;
  ready: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  sessionId: null,
  ready: false,
});

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = "demo-mza-session-id";
    let active = true;
    const bootstrap = async () => {
      let candidate = createId();
      try {
        candidate = sessionStorage.getItem(key) || candidate;
      } catch {
        // El almacenamiento puede estar deshabilitado.
      }
      try {
        const response = await fetch("/api/agent/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: candidate }),
        });
        if (!response.ok) throw new Error("session bootstrap failed");
        const data = (await response.json()) as { sessionId?: string };
        candidate = data.sessionId || candidate;
      } catch {
        // La UI puede mostrarse; las APIs devolverán un error claro si no hay cookie.
      }
      try {
        sessionStorage.setItem(key, candidate);
      } catch {
        // ignore
      }
      if (active) {
        setSessionId(candidate);
        setReady(true);
      }
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ sessionId, ready }), [sessionId, ready]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionId() {
  return useContext(SessionContext).sessionId;
}

export function useSessionReady() {
  return useContext(SessionContext).ready;
}
