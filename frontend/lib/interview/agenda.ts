import type { Round } from "./types";

/** The rounds a candidate actually sits, and the fallback for a session the
 * server has not planned yet. A real session gets its rounds from the server,
 * generated from the candidate's resume; this is the static metadata for each
 * one (label, kind, duration).
 *
 * Mirrors backend/apps/interview/rounds.py, which is the authority. A round
 * ships once it is real end to end -- content generated or imported, and what
 * the screen says happened is what happened. The debug, design, knowledge-check,
 * candidate-questions and wrap-up screens are built but have nothing honest
 * behind them yet, so they are not offered. */
export const DEFAULT_ROUNDS: Round[] = [
  { id: "preflight", label: "Pre-flight & resume", kind: "setup", durationMin: 4 },
  { id: "resume", label: "Resume review & plan", kind: "setup", durationMin: 6 },
  {
    id: "behavioral",
    label: "Behavioral — ownership",
    kind: "conversation",
    durationMin: 10,
  },
  {
    id: "coding",
    label: "Live coding + terminal",
    kind: "task",
    durationMin: 25,
  },
  {
    id: "sql",
    label: "SQL — settlement report",
    kind: "task",
    durationMin: 10,
  },
  { id: "wrap", label: "Wrap-up", kind: "setup", durationMin: 3 },
];
