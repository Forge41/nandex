"use client";

import { useEffect } from "react";
import { fetchSession } from "@/lib/api/interview";
import { useInterviewSession } from "@/lib/interview/session-provider";

const POLL_MS = 3000;
/** Two minutes of asking. Past that the round is not being written -- six stages
 * still have no generator, and a poll with no end is worse than an empty round. */
const MAX_POLLS = 40;

/** Folds in rounds the server is still writing, while the candidate reads.
 *
 * Slower than the plan poll and stops entirely once nothing is outstanding: the
 * rounds ahead are generated on a two-round lookahead, so there is only ever
 * something to wait for just after arriving somewhere new.
 */
export function SessionSync() {
  const { session, dispatch } = useInterviewSession();

  // Only the round the candidate is about to start. The ones beyond it are being
  // prepared too, but nothing on screen is waiting for them -- and watching every
  // round would mean watching the six that have no generator, forever.
  const index = session.rounds.findIndex((round) => round.id === session.activeStage);
  const next = index >= 0 ? session.rounds[index + 1] : undefined;
  const waiting = next?.contentState === "pending" || next?.contentState === "generating";

  useEffect(() => {
    if (!waiting || !session.id) return;

    let cancelled = false;
    let polls = 0;
    const timer = setInterval(() => {
      if (++polls > MAX_POLLS) {
        clearInterval(timer);
        return;
      }
      fetchSession(session.id)
        .then((server) => {
          if (!cancelled) dispatch({ type: "SYNC", server });
        })
        // Silent: this only ever adds detail to a page that already works.
        .catch(() => {});
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session.id, waiting, dispatch]);

  return null;
}
