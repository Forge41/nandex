import type { RoundContent } from "../types";

/** Round content standing in for the generated plan's output. Replaced by
 * GET /api/interview/:id once rounds are produced server-side. */

const CHARGE_PY = `def charge(order_id, cents):
    lock = redis.setnx(f"lock:{order_id}", 1)
    if not lock:
        return CACHED[order_id]
    redis.expire(f"lock:{order_id}", 30)   # set after acquire
    receipt = gateway.charge(order_id, cents)
    CACHED[order_id] = receipt
    redis.delete(f"lock:{order_id}")
    return receipt

# CACHED is per-process. Three workers.
`;

export const MOCK_ROUND_CONTENT: RoundContent = {
  behavioral: {
    questionNumber: 2,
    questionTotal: 4,
    question:
      "You moved the ledger from a single Postgres writer to Kafka. Walk me through the moment you knew the old design would not hold — and what you would have needed to see to abandon the migration.",
    derivedFrom: ["resume line 4", "your answer to Q1"],
    citation: 2,
  },

  debug: {
    prompt:
      "This service is in production and double-charging roughly one in nine thousand payments. You have the failing test and the trace. Find it, explain it, then fix it.",
    badgeLabel: "P1 incident sim",
    secondsRemaining: 461,
    startLine: 41,
    faultLine: 5,
    file: { name: "charge.py", language: "python", content: CHARGE_PY },
    trace: [
      { kind: "command", text: "$ pytest -k double_charge" },
      { kind: "error", text: "FAILED test_double_charge_under_race" },
      { kind: "muted", text: "  gateway.charge called 2x for ord_88f1" },
      { kind: "output", text: "worker-1  t=0.000  setnx -> 1" },
      { kind: "error", text: "worker-2  t=0.001  setnx -> 1  (!)" },
      { kind: "muted", text: "          ^ redis restarted between" },
      { kind: "muted", text: "            setnx and expire" },
    ],
  },

  design: {
    prompt:
      "Design a per-merchant rate limiter for 50k requests/second across three regions. Talk while you draw.",
    // y and height are chosen so the three connectors come out perfectly
    // orthogonal: pop, bucket and api all centre on y=88.
    nodes: [
      { id: "pop", label: "Edge PoP", detail: "3 regions", x: 56, y: 62, width: 120, height: 52, variant: "solid" },
      {
        id: "bucket",
        label: "Local token bucket",
        detail: "in-process, 10ms sync",
        x: 272,
        y: 62,
        width: 136,
        height: 52,
        variant: "filled",
      },
      {
        id: "redis",
        label: "Redis cell",
        detail: "quota lease, per merchant",
        x: 272,
        y: 164,
        width: 136,
        height: 52,
        variant: "dashed",
      },
      { id: "api", label: "Payments API", x: 496, y: 68, width: 112, height: 40, variant: "solid" },
    ],
    edges: [
      { id: "e1", from: "pop", to: "bucket" },
      { id: "e2", from: "bucket", to: "redis" },
      { id: "e3", from: "bucket", to: "api" },
    ],
    candidateNote:
      "Leases are 50ms of quota. Region loses Redis → fail open at 80% of last known rate, alarm after 2s.",
    probes: [
      { id: "d1", question: "What happens to in-flight leases when a PoP is cut off?", answered: true },
      { id: "d2", question: "Why token bucket over sliding window here?", answered: true },
      { id: "d3", question: "How do you bound the error of the 10ms sync at 50k rps?", answered: false },
    ],
  },

  quiz: {
    id: "q4",
    index: 4,
    total: 8,
    secondsRemaining: 200,
    prompt:
      "A consumer group rebalances mid-batch and your handler is not idempotent. Which mitigation removes the duplicate effect rather than the duplicate delivery?",
    options: [
      { id: "a", label: "Reduce max.poll.records so batches finish faster" },
      { id: "b", label: "Write the effect and the consumed offset in one transaction, keyed by event id" },
      { id: "c", label: "Switch to at-most-once commits before processing" },
      { id: "d", label: "Increase session.timeout.ms to avoid rebalances" },
    ],
  },

  qa: {
    suggestions: [
      "What does the first 90 days look like?",
      "How is on-call shared?",
      "Who decides roadmap?",
      "Compensation band",
    ],
    messages: [
      {
        id: "qa1",
        role: "candidate",
        text: "How much of the payments platform work is greenfield versus keeping the ledger alive?",
      },
      {
        id: "qa2",
        role: "agent",
        text: "Roughly 60/40 toward existing systems this year. The team's stated goal is to retire the legacy settlement job by Q3, and the two open headcount are both attached to that programme. Greenfield work sits mostly in the new payout rails project.",
        citations: [1, 2, 3],
        sources: [{ label: "Role brief · §2" }, { label: "Eng blog, Jun 2026" }],
      },
      { id: "qa3", role: "candidate", text: "Why did the last person in this role leave?" },
      {
        id: "qa4",
        role: "agent",
        text: "I don't have a sourced answer to that, and I won't guess. I've sent it to the hiring manager — you'll get a written reply with your decision.",
        routedTo: { name: "Maya Okonjo", replyWithin: "replies within 2 days" },
      },
    ],
  },
};
