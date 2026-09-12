"use client";

import { useEffect, useRef } from "react";
import { patchSession } from "@/lib/api/interview";
import type { InterviewSession } from "./types";

/** Mirrors the slice of session state the server owns back to it.
 *
 * The reducer stays the source of truth for what is on screen -- a candidate
 * ticking a box should not wait on a round trip -- and this follows behind it.
 * Without it a refresh would silently discard consent, which is the one thing
 * on that page that must survive.
 *
 * Failures are swallowed: the interview must not stall because a PATCH lost a
 * race, and the next change re-sends the whole slice anyway.
 */
export function useSessionPersistence(session: InterviewSession) {
  const { id, consent, activeStage, startedAt } = session;
  // What the server was last told. A ref rather than state: writing it must not
  // cause a render, and reading it only ever happens inside the effect.
  const sent = useRef<string | null>(null);

  useEffect(() => {
    // A draft has no id because it does not exist server-side yet -- there is
    // nothing to mirror to until the candidate creates it.
    if (!id) return;

    const snapshot = JSON.stringify({ consent, activeStage, started: startedAt !== null });

    // The first run is the state we just loaded from the server, so sending it
    // back would be a pointless write on every page load.
    if (sent.current === null) {
      sent.current = snapshot;
      return;
    }
    if (sent.current === snapshot) return;
    sent.current = snapshot;

    void patchSession(id, {
      consent,
      activeStage,
      start: startedAt !== null,
    }).catch(() => {});
  }, [id, consent, activeStage, startedAt]);
}
