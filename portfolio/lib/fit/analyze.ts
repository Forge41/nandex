import type { FitCard, FitMatch } from "@/lib/terminal/types";

const SKILL_SRC: Record<string, string> = {
  livekit: "resume-autointerviewer",
  terraform: "resume-autointerviewer",
  aws: "resume-autointerviewer",
  django: "resume-autointerviewer",
  "next.js": "resume-autointerviewer",
  temporal: "resume-autointerviewer",
  deepgram: "resume-intern",
  elevenlabs: "resume-intern",
  gemini: "resume-intern",
  pipecat: "resume-voice",
  "google adk": "resume-voice",
  turbopuffer: "resume-voice",
  pgvector: "resume-sde2",
  rag: "resume-sde2",
  openai: "resume-sde2",
  embeddings: "resume-sde2",
  mcp: "resume-sde1",
  redis: "summary-think41",
  oauth: "summary-think41",
  "claude code": "summary-think41",
  anthropic: "summary-think41",
  "multi-agent": "summary-think41",
  evals: "summary-think41",
  scrum: "summary-think41",
  agile: "summary-think41",
  langchain: "summary-think41",
  docker: "summary-think41",
  nginx: "summary-think41",
  fastmcp: "resume-genalpha",
  fastapi: "resume-genalpha",
};

const KNOWN = ["python", "typescript", "javascript", "java", "sql", "go", "rust", "c++", "scala", "kotlin", "swift", "fastapi", "django", "flask", "next.js", "react", "node", "spring", "rails", "graphql", "grpc", "rest", "postgres", "pgvector", "mysql", "mongodb", "redis", "kafka", "rabbitmq", "temporal", "airflow", "spark", "snowflake", "dbt", "langchain", "langgraph", "llamaindex", "crewai", "autogen", "dspy", "mcp", "rag", "embeddings", "vector", "pinecone", "weaviate", "qdrant", "faiss", "elasticsearch", "opensearch", "anthropic", "openai", "claude", "gpt", "gemini", "llama", "bedrock", "azure", "vertex", "gcp", "aws", "kubernetes", "docker", "terraform", "ci/cd", "github actions", "prometheus", "grafana", "opentelemetry", "datadog", "livekit", "pipecat", "deepgram", "elevenlabs", "whisper", "twilio", "webrtc", "pytorch", "tensorflow", "lora", "qlora", "rlhf", "dpo", "fine-tuning", "evals", "langsmith", "langfuse", "ragas", "guardrails", "multi-agent", "agents", "tool use", "function calling", "streaming", "oauth", "security", "unity", "flutter", "react native", "ios", "android", "php", "laravel", ".net", "c#", "ruby", "elixir", "haskell", "blockchain", "solidity", "sap", "salesforce", "tableau", "power bi", "excel", "agile", "scrum"];

const MINE = new Set(["python", "typescript", "javascript", "java", "sql", "fastapi", "django", "next.js", "react", "spring", "postgres", "pgvector", "redis", "temporal", "langchain", "langgraph", "llamaindex", "crewai", "autogen", "dspy", "mcp", "rag", "embeddings", "vector", "pinecone", "weaviate", "qdrant", "faiss", "anthropic", "openai", "claude", "gpt", "bedrock", "azure", "vertex", "gcp", "aws", "kubernetes", "docker", "terraform", "ci/cd", "prometheus", "grafana", "opentelemetry", "livekit", "pipecat", "deepgram", "elevenlabs", "webrtc", "pytorch", "tensorflow", "lora", "qlora", "rlhf", "dpo", "fine-tuning", "evals", "langsmith", "langfuse", "ragas", "guardrails", "multi-agent", "agents", "tool use", "function calling", "streaming", "oauth", "rest", "grpc", "agile", "scrum", "claude code", "google adk", "turbopuffer", "nginx"]);

const PROOF: Record<string, string> = {
  livekit: "AutoInterviewer, which runs 1,000 concurrent live voice interviews on LiveKit",
  pgvector: "Harvey.ai's production RAG pipeline over 100K+ documents across 300+ tenants",
  temporal: "a multi-agent workflow engine with durable state on Temporal",
  mcp: "a third-party MCP server service hosting 20+ MCP servers with zero downtime",
  "claude code": "6 Claude Code skills that cut integration delivery from weeks to under one week",
  rag: "Harvey.ai's document-grounded RAG pipeline over 100K+ documents",
};

export function coverNote(matches: string[], gaps: string[]) {
  const top = matches.slice(0, 5).join(", ");
  const proof = Object.keys(PROOF)
    .filter((k) => matches.includes(k))
    .slice(0, 2)
    .map((k) => PROOF[k]);
  const ramp = gaps.length
    ? ` On ${gaps.slice(0, 2).join(" and ")} I'd be ramping up rather than leading on day one; I learn fast and would say so in an interview.`
    : "";
  return `Hi,\n\nYour role lines up closely with what I've been shipping: ${top}. Most recently I built ${proof[0] || "Harvey.ai's production RAG pipeline"}${proof[1] ? ", and architected " + proof[1] : ""}.\n\nI treat prompts as production code — versioned, evaluated, observable — and I've been rated Above Expectations in every review so far.${ramp}\n\nHappy to talk — my calendar is at /book, or reply here.\n\nNandisha D\nnaik.nandishd@gmail.com · linkedin.com/in/nandishd`;
}

export type FitResult = { card: FitCard; noteText: string };

export function analyzeFit(jd: string): FitResult | null {
  const jl = jd.toLowerCase();
  const found = KNOWN.filter((k) => new RegExp("(^|[^a-z])" + k.replace(/[.+/#]/g, "\\$&") + "([^a-z]|$)").test(jl));
  if (!found.length) return null;
  const matches = found.filter((k) => MINE.has(k));
  const gaps = found.filter((k) => !MINE.has(k));

  const order: string[] = [];
  const M: FitMatch[] = matches.map((k) => {
    const id = SKILL_SRC[k] || "resume-skills";
    let i = order.indexOf(id);
    if (i < 0) {
      order.push(id);
      i = order.length - 1;
    }
    return { t: k, n: i + 1, id };
  });
  const score = Math.round((100 * matches.length) / found.length);

  return {
    noteText: coverNote(matches, gaps),
    card: {
      meta: `${jd.split(/\s+/).length} words · ${found.length} skills detected · sources: ${order.join(", ")}`,
      score,
      matches: M,
      gaps,
      note: gaps.length
        ? "Gaps are things the JD names that neither document mentions — not a claim I can't do them. Ask me about any of them, or /message."
        : "Everything the JD names is backed by a source. Ask about any match to see the passage.",
    },
  };
}
