"use client";

import { useEffect, useState } from "react";

/** Seconds since `startedAt`, re-rendering once a second.
 *
 * The clock lives in state rather than being read during render: `Date.now()`
 * in a render body is impure, and it would also make the server and the first
 * client render disagree. Reads 0 until the first tick. */
export function useElapsedSeconds(startedAt: string | null): number {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null || !startedAt) return 0;

  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}
