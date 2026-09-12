import { apiFetch } from "./client";
import type { InterviewSession, TranscriptTurn } from "@/lib/interview/types";

/** The server's session payload. A superset of InterviewSession -- the extra
 * fields are the ones only the server knows. */
export interface SessionPayload extends InterviewSession {
  status: "created" | "active" | "ended";
  recordingState: string;
  transcript: TranscriptTurn[];
}

export async function createSession(roleTitle: string): Promise<SessionPayload> {
  return apiFetch<SessionPayload>("/interview/sessions", {
    method: "POST",
    body: JSON.stringify({ roleTitle }),
  });
}

export async function fetchSession(sessionId: string): Promise<SessionPayload> {
  return apiFetch<SessionPayload>(`/interview/sessions/${sessionId}`);
}

/** Partial update. Every field is optional because the caller sends only what
 * changed -- the server treats an absent key as "leave it alone". */
export async function patchSession(
  sessionId: string,
  changes: {
    consent?: Partial<InterviewSession["consent"]>;
    activeStage?: string;
    start?: boolean;
  }
): Promise<SessionPayload> {
  return apiFetch<SessionPayload>(`/interview/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}
