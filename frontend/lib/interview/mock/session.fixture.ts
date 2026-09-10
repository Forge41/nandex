import { DEFAULT_ROUNDS } from "../agenda";
import type { InterviewSession, ResumeDoc, TranscriptTurn } from "../types";

/** Stands in for GET /api/interview/:id until the backend exists. The shape
 * here is the contract -- keep it and the server in step. */

export const MOCK_RESUME: ResumeDoc = {
  fileName: "Priya_Raghunathan_Resume.pdf",
  sizeBytes: 219_136,
  pageCount: 2,
  entityCount: 18,
  candidate: {
    name: "Priya Raghunathan",
    title: "Senior Backend Engineer",
    location: "Bengaluru",
    email: "priya@example.com",
    yearsExperience: 6,
  },
  citations: [
    { id: 1, quote: "1.4M transactions a day", source: "Experience, Northwind" },
    { id: 2, quote: "Kafka-backed event pipeline", source: "Experience, Northwind" },
    { id: 3, quote: "by 40%", source: "Experience, Northwind" },
    { id: 4, quote: "March to August 2024 has no listed role", source: "Experience, gap" },
    { id: 5, quote: "deep SQL performance work", source: "Skills" },
  ],
  sections: [
    {
      id: "experience",
      label: "Experience",
      paragraphs: [
        [
          { text: "Staff-track backend engineer on the payments platform at Northwind. Owned the double-entry ledger service handling " },
          { text: "1.4M transactions a day", citation: 1 },
          { text: ". Led the migration from a single Postgres writer to a " },
          { text: "Kafka-backed event pipeline", citation: 2 },
          { text: ", cutting settlement latency " },
          { text: "by 40%", citation: 3 },
          { text: "." },
        ],
        [
          { text: "Previously at Velo, 2018 to 2021 — idempotency and retry infrastructure on the card authorisation path. " },
          { text: "March to August 2024 has no listed role", citation: 4 },
          { text: "." },
        ],
      ],
    },
    {
      id: "skills",
      label: "Skills as written",
      paragraphs: [
        [
          { text: "Go · Python · Postgres · Kafka · gRPC · Terraform · " },
          { text: "“deep SQL performance work”", citation: 5 },
          { text: " · Kubernetes, basic" },
        ],
      ],
    },
  ],
  probes: [
    { id: "p1", title: "The 40% latency figure", note: "No measurement method stated", citation: 3, round: "behavioral" },
    { id: "p2", title: "Kafka at 1.4M/day", note: "Scale claim worth grounding", citation: 1, round: "coding" },
    { id: "p3", title: "Five-month gap", note: "Asked once, answer taken as given", citation: 4, round: "behavioral" },
    { id: "p4", title: "“Deep SQL performance”", note: "Tested by task, not conversation", citation: 5, round: "sql" },
    { id: "p5", title: "Ledger correctness", note: "Core to the role, not yet evidenced", round: "coding" },
  ],
};

export const MOCK_SESSION: InterviewSession = {
  id: "demo",
  candidateName: MOCK_RESUME.candidate.name,
  roleTitle: "Senior Backend Engineer — Payments",
  totalDurationMin: 75,
  rounds: DEFAULT_ROUNDS,
  resume: null,
  activeStage: "preflight",
  progressIndex: 0,
  consent: { recording: true, aiInterviewer: true, integrityMonitoring: true },
  startedAt: null,
};

export const MOCK_TRANSCRIPT: TranscriptTurn[] = [
  {
    id: "t1",
    speaker: "interviewer",
    atSeconds: 492,
    text: "Before the migration — what was the failure mode that actually paged you?",
  },
  {
    id: "t2",
    speaker: "candidate",
    atSeconds: 511,
    text: "Write amplification during end-of-day settlement. We were holding a row lock on the account balance for the whole batch, so authorisations queued behind reporting. The page was p99 auth latency, not the ledger itself — which is what made it take us two quarters to find.",
    assessments: [
      { label: "specific failure mode", tone: "success" },
      { label: "quantify next", tone: "gold" },
    ],
  },
  {
    id: "t3",
    speaker: "interviewer",
    atSeconds: 544,
    text: "Two quarters is a long detection window. What instrumentation was missing?",
  },
  {
    id: "t4",
    speaker: "candidate",
    atSeconds: 562,
    text: "We had per-endpoint latency but nothing tying lock waits back to a caller, so",
    inProgress: true,
  },
];
