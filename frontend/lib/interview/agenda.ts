import type { Round } from "./types";

/** The default ten-round shape. A real session gets its rounds from the server
 * -- generated from the candidate's resume -- so treat this as the fallback and
 * the source of each round's static metadata (label, kind, duration). */
export const DEFAULT_ROUNDS: Round[] = [
  { id: "preflight", label: "Pre-flight & resume", kind: "setup", durationMin: 4 },
  { id: "resume", label: "Resume review & plan", kind: "setup", durationMin: 6 },
  {
    id: "behavioral",
    label: "Behavioral — ownership",
    kind: "conversation",
    durationMin: 10,
    citation: 2,
    summary: "Probe the ledger migration decision and rollback plan.",
  },
  {
    id: "coding",
    label: "Live coding + terminal",
    kind: "task",
    durationMin: 25,
    citation: 1,
    summary: "Retry-safe transfer applier, in Go or Python.",
  },
  {
    id: "sql",
    label: "SQL — settlement report",
    kind: "task",
    durationMin: 10,
    citation: 5,
    summary: "Tests the “deep SQL performance” claim.",
  },
  { id: "debug", label: "Debug drill", kind: "task", durationMin: 8, summary: "A live P1: double-charged payments." },
  {
    id: "design",
    label: "System design canvas",
    kind: "task",
    durationMin: 15,
    citation: 1,
    summary: "Scaled from the 1.4M/day figure.",
  },
  { id: "quiz", label: "Knowledge check", kind: "task", durationMin: 5, summary: "Eight calibrated questions." },
  { id: "qa", label: "Your questions", kind: "conversation", durationMin: 8, summary: "Sourced answers, or routed to a human." },
  { id: "wrap", label: "Wrap-up & feedback", kind: "setup", durationMin: 3 },
];
