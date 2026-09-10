"use client";

import { useHydrated } from "@/lib/hooks/use-hydrated";
import type { DeviceStatus } from "../types";

/** Screen sharing can't be probed without prompting the candidate to pick a
 * surface, so this only reports capability -- never a fake "1 display" when
 * the browser won't tell us. */
export function useScreenShareSupport(): { status: DeviceStatus; meta?: string } {
  const hydrated = useHydrated();

  if (!hydrated) return { status: "untested" };

  const supported = typeof navigator.mediaDevices?.getDisplayMedia === "function";
  if (!supported) return { status: "fail", meta: "unsupported" };

  // Chromium-only, and gated behind the window-management permission, so treat
  // its absence as "we don't know" rather than "one display".
  const extended = (window.screen as Screen & { isExtended?: boolean }).isExtended;

  return {
    status: "ok",
    meta: extended === undefined ? undefined : extended ? "multiple displays" : "1 display",
  };
}
