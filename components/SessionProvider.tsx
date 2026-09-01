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
};

const SessionContext = createContext<SessionContextValue>({ sessionId: null });

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const key = "demo-mza-session-id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = createId();
      sessionStorage.setItem(key, id);
    }
    setSessionId(id);
  }, []);

  const value = useMemo(() => ({ sessionId }), [sessionId]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionId() {
  return useContext(SessionContext).sessionId;
}
