"use client";

import { useEffect, useState } from "react";

/** Counts down from `fromSeconds`, stopping at zero.
 *
 * Tracks elapsed ticks rather than reading the clock during render, so the
 * first paint matches on the server and the render stays pure. */
export function useCountdown(fromSeconds: number): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return Math.max(0, fromSeconds - elapsed);
}
