import { DEFAULT_ROUNDS } from "../agenda";
import { MOCK_ROUND_CONTENT } from "./rounds.fixture";
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
  sections: [
    {
      id: "experience",
      label: "Experience",
      paragraphs: [
        "Staff-track backend engineer on the payments platform at Northwind. Owned the double-entry ledger service handling 1.4M transactions a day. Led the migration from a single Postgres writer to a Kafka-backed event pipeline, cutting settlement latency by 40%.",
        "Previously at Velo, 2018 to 2021 — idempotency and retry infrastructure on the card authorisation path. March to August 2024 has no listed role.",
      ],
    },
    {
      id: "skills",
      label: "Skills as written",
      paragraphs: [
        "Go · Python · Postgres · Kafka · gRPC · Terraform · “deep SQL performance work” · Kubernetes, basic",
      ],
    },
  ],
  probes: [
    { id: "p1", title: "The 40% latency figure", note: "No measurement method stated", round: "behavioral" },
    { id: "p2", title: "Kafka at 1.4M/day", note: "Scale claim worth grounding", round: "coding" },
    { id: "p3", title: "Five-month gap", note: "Asked once, answer taken as given", round: "behavioral" },
    { id: "p4", title: "“Deep SQL performance”", note: "Tested by task, not conversation", round: "sql" },
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
  // Unchecked. A pre-ticked box is not consent, and these terms cover being
  // recorded and monitored -- the candidate has to actually agree. Matches the
  // server, where every consent field defaults to false.
  consent: { recording: false, aiInterviewer: false, integrityMonitoring: false },
  startedAt: null,
  content: MOCK_ROUND_CONTENT,
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
