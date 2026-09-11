"use client";

import { useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api/client";

/** Tells the server the interview is over.
 *
 * Two paths, because a candidate can leave two ways. The explicit one is a
 * normal request. The closed-tab one is a beacon, which the browser will still
 * deliver after the page is gone -- but sendBeacon cannot set headers, so that
 * request carries no CSRF token and the endpoint is csrf_exempt accordingly.
 *
 * Neither path is trusted as the only signal: a browser that is killed outright
 * sends nothing, so the server also learns the room emptied from the provider's
 * own participant_left webhook. */
export function useSessionEnd(sessionId: string, active: boolean) {
  const endSession = useCallback(async () => {
    try {
      await apiFetch(`/interview/sessions/${sessionId}/end`, { method: "POST" });
    } catch {
      // Ending is idempotent and the provider webhook is the backstop, so a
      // failure here must not block the candidate from leaving the page.
    }
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;

    const onPageHide = () => {
      // pagehide rather than beforeunload: it fires for a backgrounded tab on
      // mobile, which beforeunload does not.
      navigator.sendBeacon?.(`/api/interview/sessions/${sessionId}/end`);
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [sessionId, active]);

  return endSession;
}
