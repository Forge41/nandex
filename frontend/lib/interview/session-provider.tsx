"use client";

import { createContext, useContext, useReducer, useMemo } from "react";
import { sessionReducer, type SessionAction } from "./reducer";
import { useSessionPersistence } from "./use-session-persistence";
import type { InterviewSession } from "./types";

type SessionContextValue = {
  session: InterviewSession;
  dispatch: React.Dispatch<SessionAction>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function InterviewSessionProvider({
  initialSession,
  children,
}: {
  initialSession: InterviewSession;
  children: React.ReactNode;
}) {
  const [session, dispatch] = useReducer(sessionReducer, initialSession);
  // Consent, stage and start time are the server's to keep; the reducer stays
  // ahead of it so nothing on screen waits for a round trip.
  useSessionPersistence(session);
  const value = useMemo(() => ({ session, dispatch }), [session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useInterviewSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useInterviewSession must be used inside InterviewSessionProvider");
  return value;
}
