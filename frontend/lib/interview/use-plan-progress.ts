"use client";

import { useEffect, useState } from "react";
import { fetchPlanProgress, mintRoom, type PlanProgress, type PlanStep } from "@/lib/api/interview";

const POLL_MS = 1000;

/** The step the browser owns.
 *
 * Reserving the room is the one part of getting ready that the workflow cannot
 * do -- it needs the candidate's own session cookie -- so it is appended here
 * rather than declared by the server, and it runs only once the plan exists.
 */
const ROOM_STEP: PlanStep = {
  id: "room",
  label: "Opening the interview room",
  detail: "",
  state: "pending",
};

export interface PlanGate {
  steps: PlanStep[];
  /** True once the plan exists and the room has been reserved. */
  open: boolean;
  error: string;
}

/** Watches the workflow build the plan, then reserves the room.
 *
 * Polling rather than streaming: the wait is tens of seconds, the payload is a
 * handful of steps, and a server-sent stream would need its own reconnect story
 * for a page that is about to navigate anyway.
 */
export function usePlanGate(sessionId: string, initial: PlanProgress): PlanGate {
  const [progress, setProgress] = useState<PlanProgress>(initial);
  // Only the outcome is stored. "running" is derived from the plan being ready
  // with no outcome yet, so nothing has to be written at the moment the request
  // starts -- which would be a setState inside the effect that starts it.
  const [minted, setMinted] = useState<"done" | "failed" | null>(null);

  const planReady = progress.status === "ready";

  useEffect(() => {
    if (planReady || progress.status === "failed") return;

    let cancelled = false;
    const timer = setInterval(() => {
      fetchPlanProgress(sessionId)
        .then((next) => {
          if (!cancelled) setProgress(next);
        })
        // A poll that fails is not a failed plan: the next one is a second away.
        .catch(() => {});
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId, planReady, progress.status]);

  useEffect(() => {
    if (!planReady) return;

    let cancelled = false;
    mintRoom(sessionId)
      .then(() => {
        if (!cancelled) setMinted("done");
      })
      .catch(() => {
        if (!cancelled) setMinted("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, planReady]);

  const room: PlanStep["state"] = minted ?? "running";
  const steps = planReady ? [...progress.steps, { ...ROOM_STEP, state: room }] : progress.steps;

  return {
    steps,
    // A room that could not be reserved does not hold back a plan that exists.
    // The candidate can read it either way, and the room's own connection banner
    // reports the problem -- and offers a retry -- on the page itself.
    open: planReady && minted !== null,
    error: progress.status === "failed" ? progress.error || "We couldn't read that resume." : "",
  };
}
