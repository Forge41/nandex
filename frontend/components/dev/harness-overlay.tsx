"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { attemptedCalls, subscribeAttempts } from "@/lib/dev/offline";
import type { Screen, ScreenState } from "@/lib/dev/screens";

const EMPTY: ReturnType<typeof attemptedCalls> = [];

/** What this screen is, what else it could be, and what it tried to call.
 *
 * The call list is the part that is not decoration. A screen here has no server, so
 * every request it makes is a dependency it is carrying -- and reading it off the page
 * beats finding it by grep. */
export function HarnessOverlay({ screen, state }: { screen: Screen; state: ScreenState }) {
  const [open, setOpen] = useState(false);
  const calls = useSyncExternalStore(subscribeAttempts, attemptedCalls, () => EMPTY);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
      <div className="pointer-events-auto w-full max-w-[860px] rounded-lg border border-line bg-surface-subtle/95 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <Link href="/dev/screens" className="text-xs text-content-muted underline">
            screens
          </Link>
          <span className="text-xs font-medium">{screen.label}</span>

          <div className="flex flex-wrap gap-1">
            {screen.states.map((option) => (
              <Link
                key={option.id}
                href={`/dev/screens/${screen.id}?state=${option.id}`}
                title={option.note}
                className={`rounded px-2 py-0.5 text-2xs ${
                  option.id === state.id
                    ? "bg-content text-surface"
                    : "border border-line text-content-muted hover:border-line-interactive"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto rounded border border-line px-2 py-0.5 text-2xs text-content-muted"
          >
            {calls.length} call{calls.length === 1 ? "" : "s"}
          </button>
        </div>

        <p className="px-3 pb-2 text-2xs text-content-muted">{state.note}</p>

        {open && (
          <ul className="max-h-40 overflow-y-auto border-t border-line px-3 py-2">
            {calls.length === 0 && (
              <li className="text-2xs text-content-muted">
                Nothing has tried to reach the network.
              </li>
            )}
            {calls.map((call) => (
              <li key={call.id} className="font-mono text-2xs text-content-muted">
                <span className={call.answered ? "text-success" : "text-warning"}>
                  {call.answered ? "answered" : "refused "}
                </span>{" "}
                {call.method} {call.path}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
