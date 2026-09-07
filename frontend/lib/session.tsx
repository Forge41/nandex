"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

type User = { id: string; email: string };
type Workspace = { id: string; slug: string } | null;

// There is no login -- the backend auto-provisions an identity for any request with no
// session cookie yet (see backend's AutoProvisionAnonymousUserMiddleware), so /auth/session
// always resolves to a real user. "loading" only covers the moment before that first
// response lands.
type SessionState = { status: "loading" } | { status: "ready"; user: User; workspace: Workspace };

const SessionContext = createContext<SessionState>({ status: "loading" });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let ignore = false;
    api.get<{ user: User; workspace: Workspace }>("/auth/session").then((data) => {
      if (!ignore) setSession({ status: "ready", user: data.user, workspace: data.workspace });
    });
    return () => {
      ignore = true;
    };
  }, []);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

/** Renders nothing until the session resolves -- a moment's blank screen on first load,
 * never a login redirect. */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (session.status !== "ready") return null;
  return <>{children}</>;
}
