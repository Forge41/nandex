"use client";

import { useCallback, useEffect } from "react";
import { apiFetch, beacon } from "@/lib/api/client";

/** How often a tab says it is still here, and how stale a claim may be before it is
 * treated as a tab that is gone rather than one that is watching. */
const CLAIM_MS = 2000;
const CLAIM_STALE_MS = 6000;

function claimKey(sessionId: string): string {
  return `interview:open:${sessionId}`;
}

/** Whether another tab has this interview open right now.
 *
 * Two tabs of one interview are one session -- every request is the same cookie -- so
 * closing either used to end it for both. Each tab stamps a claim while it is open and
 * a closing tab checks for a fresher one from somebody else before saying the candidate
 * has left. Read synchronously, because `pagehide` has no time for anything else.
 */
function anotherTabIsOpen(sessionId: string, self: string): boolean {
  try {
    const raw = window.localStorage.getItem(claimKey(sessionId));
    if (!raw) return false;
    const [owner, at] = raw.split("@");
    return owner !== self && Date.now() - Number(at) < CLAIM_STALE_MS;
  } catch {
    // Private browsing, blocked storage. Falling through means the old behaviour, which
    // is ending a session that may still be open elsewhere -- worse than not knowing,
    // but not worse than not checking.
    return false;
  }
}

/** Tells the server the interview is over.
 *
 * Two triggers with different guarantees. Clicking End is an ordinary request. The one
 * for a tab that is going away is a beacon, which the browser will still deliver after
 * the page is gone -- but sendBeacon cannot set headers, so that is why the path is
 * cookie-authenticated.
 *
 * What it deliberately does *not* treat as leaving:
 *
 * - **A backgrounded tab.** `pagehide` fires when a phone backgrounds a tab, which is
 *   why it was chosen over `beforeunload`; it is also why a candidate taking a call
 *   used to lose their interview. `event.persisted` is true in exactly that case and
 *   when the page enters the back/forward cache, and false for a real close or reload.
 * - **A close while another tab is still open.** See `anotherTabIsOpen`.
 *
 * The room emptying is what covers anything this misses: the provider reports it after
 * its own empty timeout, and the session's workflow ends it as a last resort.
 */
export function useSessionEnd(sessionId: string, active: boolean) {
  const endSession = useCallback(async () => {
    try {
      await apiFetch(`/interview/sessions/${sessionId}/end`, { method: "POST" });
    } catch {
      // Ending is idempotent and the provider callback is the backstop, so a failure
      // here must not block the candidate from leaving the page.
    }
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;

    const self = Math.random().toString(36).slice(2);
    const key = claimKey(sessionId);
    const claim = () => {
      try {
        window.localStorage.setItem(key, `${self}@${Date.now()}`);
      } catch {
        // Nothing to do: anotherTabIsOpen fails the same way and answers false.
      }
    };
    claim();
    const heartbeat = setInterval(claim, CLAIM_MS);

    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      if (anotherTabIsOpen(sessionId, self)) return;
      beacon(`/interview/sessions/${sessionId}/end`);
    };

    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [sessionId, active]);

  return endSession;
}
