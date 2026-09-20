"use client";

import { useState } from "react";
import Link from "next/link";
import { InterviewSessionProvider } from "@/lib/interview/session-provider";
import { RoomShell } from "@/components/interview/room-shell";
import { InterviewRoom } from "@/components/interview/interview-room";
import { armOffline, forgetAttempts } from "@/lib/dev/offline";
import { findScreen, findState, sessionFor, transcriptFor } from "@/lib/dev/screens";
import { HarnessOverlay } from "./harness-overlay";

/** One screen, one state, and no network.
 *
 * The offline seams are installed during render rather than in an effect: effects run
 * child-first, so a stage's own fetch would have gone out before a parent effect could
 * have stopped it. Uninstalled on unmount, because both seams are module-level and a
 * leaked one would follow the user to the next page. */
export function ScreenHarness({
  screenId,
  stateId,
}: {
  screenId: string;
  stateId: string | null;
}) {
  const screen = findScreen(screenId);
  const state = screen ? findState(screen, stateId) : null;
  // Once per mount, before anything below can call. A lazy initialiser rather than an
  // effect: effects run child-first, so clearing from one would wipe the calls the
  // stages below had already made. The route keys this component on screen and state,
  // so a different state is a different mount and a fresh log.
  useState(forgetAttempts);
  if (state) armOffline(state.answers ?? {}, state.run);

  if (!screen || !state) return <UnknownScreen id={screenId} />;

  const overlay = <HarnessOverlay screen={screen} state={state} />;

  if (state.standalone) {
    return (
      <>
        {state.standalone}
        {overlay}
      </>
    );
  }

  const session = sessionFor(screen, state);

  return (
    <InterviewSessionProvider initialSession={session}>
      {/* The real room, not just the stage: the chrome around a screen is part of
          what there is to look at, and a second layout here would be a second thing
          to keep in step. No SessionSync, which only polls for rounds still being
          written, and none here are. */}
      <RoomShell transcript={transcriptFor(state)}>
        <InterviewRoom />
      </RoomShell>
      {overlay}
    </InterviewSessionProvider>
  );
}

function UnknownScreen({ id }: { id: string }) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-2 bg-surface text-content">
      <p className="t-body">No screen called &ldquo;{id}&rdquo;.</p>
      <Link href="/dev/screens" className="t-small text-content-muted underline">
        Back to the list
      </Link>
    </main>
  );
}
