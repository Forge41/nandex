"use client";

import { createContext, useContext, useReducer, useMemo } from "react";
import { sessionReducer, type SessionAction } from "./reducer";
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
  const value = useMemo(() => ({ session, dispatch }), [session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useInterviewSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useInterviewSession must be used inside InterviewSessionProvider");
  return value;
}
