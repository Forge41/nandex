"use client";

import { useState } from "react";
import { InterviewSessionProvider } from "@/lib/interview/session-provider";
import { RoomShell } from "@/components/interview/room-shell";
import { InterviewRoom } from "@/components/interview/interview-room";
import { draftSession } from "@/lib/interview/draft-session";

/** Until a real invitation flow exists, every interview is for this role. One
 * constant, so there is a single thing to replace when the role comes from
 * whoever set the interview up. */
const ROLE_TITLE = "Senior Backend Engineer — Payments";

/** The pre-flight, on a session that does not exist yet.
 *
 * Nothing is created on arrival: choosing a file and checking a microphone is
 * not starting a recorded interview, and a visitor who closes the tab should
 * leave nothing behind. The session is created when the candidate has a resume
 * and presses on -- which is also the first moment the server has anything
 * worth storing.
 */
export default function Home() {
  // useState, not a module constant: the draft is mutable session state, and a
  // shared instance would leak one visitor's consent into the next render.
  const [initialSession] = useState(() => draftSession(ROLE_TITLE));

  return (
    <InterviewSessionProvider initialSession={initialSession}>
      <RoomShell transcript={[]}>
        <InterviewRoom />
      </RoomShell>
    </InterviewSessionProvider>
  );
}
