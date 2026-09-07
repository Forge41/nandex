"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "./api";

type User = { id: string; email: string };
type Workspace = { id: string; slug: string } | null;

type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; user: User; workspace: Workspace }
  | { status: "unauthenticated" };

type SessionContextValue = {
  session: SessionState;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchSession(): Promise<SessionState> {
  try {
    const data = await api.get<{ user: User; workspace: Workspace }>("/auth/session");
    return { status: "authenticated", user: data.user, workspace: data.workspace };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { status: "unauthenticated" };
    throw err;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  const refresh = async () => setSession(await fetchSession());

  useEffect(() => {
    let ignore = false;
    fetchSession().then((next) => {
      if (!ignore) setSession(next);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const logout = async () => {
    await api.post("/auth/logout");
    setSession({ status: "unauthenticated" });
  };

  return (
    <SessionContext.Provider value={{ session, refresh, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}

/** Redirects to /login once the session resolves to unauthenticated. Renders nothing
 * (not even children) until the session is known, to avoid a flash of protected content. */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.status === "unauthenticated") router.replace("/login");
  }, [session.status, router]);

  if (session.status !== "authenticated") return null;
  return <>{children}</>;
}
