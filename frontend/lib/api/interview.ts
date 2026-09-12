import { apiFetch, apiUpload } from "./client";
import type { InterviewSession, TranscriptTurn } from "@/lib/interview/types";

/** The server's session payload. A superset of InterviewSession -- the extra
 * fields are the ones only the server knows. */
export interface SessionPayload extends InterviewSession {
  status: "created" | "active" | "ended";
  recordingState: string;
  transcript: TranscriptTurn[];
}

export type PlanState = "idle" | "processing" | "ready" | "failed";

export interface PlanStep {
  id: string;
  label: string;
  /** What this step established -- a page count, a probe count. Empty until it has. */
  detail: string;
  state: "pending" | "running" | "done" | "failed";
}

/** The steps are the workflow's own account of itself, so this type describes
 * their shape and nothing about which steps there are. */
export interface PlanProgress {
  status: PlanState;
  error: string;
  steps: PlanStep[];
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

/** Hands over the file itself and returns immediately: reading it and planning
 * from it happen in a workflow, watched through fetchPlanProgress. */
export async function uploadResume(sessionId: string, file: File): Promise<SessionPayload> {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<SessionPayload>(`/interview/sessions/${sessionId}/resume`, form);
}

export async function fetchPlanProgress(sessionId: string): Promise<PlanProgress> {
  return apiFetch<PlanProgress>(`/interview/sessions/${sessionId}/plan`);
}

/** Reserves the room before the candidate lands on a page that claims to be
 * live, and arms recording. The room provider mints its own token on mount;
 * this one exists so a failure is visible while there is still a step to fail. */
export async function mintRoom(sessionId: string): Promise<void> {
  await apiFetch(`/interview/sessions/${sessionId}/token`, { method: "POST" });
}

export function resumeFileUrl(sessionId: string): string {
  return `/api/interview/sessions/${sessionId}/resume/file`;
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
