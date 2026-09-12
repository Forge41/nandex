"use client";

import { useHydrated } from "@/lib/hooks/use-hydrated";

/** What can be known about screen sharing without prompting anybody.
 *
 * Capability only, never a verdict: sharing cannot be probed silently, so
 * whether it *works* is settled by the candidate actually sharing -- see
 * useScreenShareTest. Reporting "OK" here, as this once did, claimed a passed
 * check that had never run. */
export function useScreenShareSupport(): { supported: boolean; meta?: string } {
  const hydrated = useHydrated();

  // Server-rendered, the APIs are absent -- assuming unsupported would flash an
  // "unsupported" row at every candidate before hydration.
  if (!hydrated) return { supported: true };

  if (typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
    return { supported: false, meta: "unsupported" };
  }

  // Chromium-only, and gated behind the window-management permission, so treat
  // its absence as "we don't know" rather than "one display".
  const extended = (window.screen as Screen & { isExtended?: boolean }).isExtended;

  return {
    supported: true,
    // Terse on purpose: this sits in a narrow fixed column, and a truncated
    // "multiple displa…" says less than "2+ displays".
    meta: extended === undefined ? undefined : extended ? "2+ displays" : "1 display",
  };
}
