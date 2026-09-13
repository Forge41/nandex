"use client";

import { useEffect } from "react";
import { fetchSession } from "@/lib/api/interview";
import { useInterviewSession } from "@/lib/interview/session-provider";

const POLL_MS = 3000;
/** Ten minutes of asking. A coding round is generated per language and each one is
 * verified by actually compiling and running it, so a few minutes is ordinary. Past
 * that the round is not being written -- and a poll with no end is worse than an
 * empty round. */
const MAX_POLLS = 200;

/** Folds in rounds the server is still writing, while the candidate reads.
 *
 * Slower than the plan poll and stops entirely once nothing is outstanding: the
 * rounds ahead are generated on a two-round lookahead, so there is only ever
 * something to wait for just after arriving somewhere new.
 */
export function SessionSync() {
  const { session, dispatch } = useInterviewSession();

  // The round the candidate is looking at, and the one after it. The active round
  // matters most: a candidate who arrives before their task is written is staring at
  // the one screen on which nothing else will tell them it is coming. The ones beyond
  // these are being prepared too, but nothing on screen is waiting for them -- and
  // watching every round would mean watching the stages that have no generator, forever.
  const index = session.rounds.findIndex((round) => round.id === session.activeStage);
  const watched = index >= 0 ? [session.rounds[index], session.rounds[index + 1]] : [];
  const waiting = watched.some(
    (round) => round?.contentState === "pending" || round?.contentState === "generating"
  );

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
