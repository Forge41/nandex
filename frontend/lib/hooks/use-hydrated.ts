"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR and the first client render, true afterwards.
 *
 * Use it to gate anything that can't match on the server -- a stored theme, a
 * media device list -- instead of a setState-in-effect mount flag, which
 * cascades a second render and trips react-hooks/set-state-in-effect. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
