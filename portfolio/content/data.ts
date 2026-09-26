import type { Answer, Commit, Project, Skills } from "@/lib/types";

export const sourceOrder = [
  "resume-summary",
  "resume-intern",
  "resume-sde1",
  "resume-sde2",
  "resume-voice",
  "resume-genalpha",
  "resume-tps",
  "resume-skills",
  "resume-edu",
  "summary-about",
  "summary-nandex",
] as const;

export const answers: Answer[] = [
  {
    keys: ["livekit", "voice", "pipecat", "deepgram", "elevenlabs", "audio", "speech"],
    paras: [
      [
        {
          t: "Two things. At Think41 I architected RQ, a LangChain-based PRD generator with LiveKit real-time collaboration",
        },
        { c: "resume-intern" },
        {
          t: ". More recently I built a voice-native legal RAG proof-of-concept for Harvey: a real-time audio pipeline on LiveKit + Pipecat, Google ADK for multi-agent orchestration, Deepgram STT and ElevenLabs TTS for low-latency turns",
        },
        { c: "resume-voice" },
        { t: "." },
      ],
      [
        {
          t: "The retrieval side used Reducto OCR for scanned documents, text-embedding-3-large in Turbopuffer, and hybrid BM25 + semantic search with citations surfaced in a Word add-in",
        },
        { c: "resume-voice" },
        { t: ". nandex's interview room reuses the same LiveKit agent pattern" },
        { c: "summary-nandex" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["rag", "retrieval", "pgvector", "embedding", "chunk", "bm25", "hybrid", "vector"],
    paras: [
      [
        {
          t: "At Harvey.ai I built the end-to-end RAG pipeline for document-grounded legal research: semantic chunking, OpenAI text-embedding-3-large, pgvector hybrid BM25 + vector retrieval, re-ranking, context assembly, and streaming inference at production scale",
        },
        { c: "resume-sde2" },
        { t: "." },
      ],
      [
        {
          t: "The open-source version lives in nandex: parse → chunk → embed → index on Temporal, hybrid search fused with Reciprocal Rank Fusion and a cross-encoder reranker, answers streamed with structured citations",
        },
        { c: "summary-nandex" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["agent", "multi-agent", "workflow", "temporal", "orchestrat", "tool use", "function calling"],
    paras: [
      [
        {
          t: "I was sole architect of Harvey's multi-agent workflow automation engine — HLD, LLD and a first prototype in one week. It orchestrates branching logic, tool use / function calling and state persistence on Temporal",
        },
        { c: "resume-sde2" },
        {
          t: ". Earlier, MUCAI was a production multi-agent conversational AI for HR/IT/PM with per-domain memory isolation",
        },
        { c: "resume-intern" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["claude code", "skill", "atomicwork", "automation", "devin"],
    paras: [
      [
        {
          t: "For Atomicwork I authored 6 Claude Code skills — LLM-executable workflows encoding the full integration lifecycle. They cut per-integration delivery from weeks to under one week, were adopted team-wide and by the PM team for autonomous POC integrations via Devin and Claude Code, and were accepted into Atomicwork's official GitHub org",
        },
        { c: "resume-sde1" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["mcp", "genalpha", "model context protocol", "cli", "open source", "open-source", "forge41"],
    paras: [
      [
        {
          t: "GenAlpha CLI converts any API repo into a production MCP server via OpenAPI detection and Python AST route extraction, so arbitrary APIs become tools for Claude, ChatGPT or Cursor; Temporal orchestrates Parse → Generate → Publish",
        },
        { c: "resume-genalpha" },
        {
          t: ". TPS is the companion embedded iPaaS that lets those MCP servers hold live OAuth 2.0 / API-key / mTLS credentials",
        },
        { c: "resume-tps" },
        { t: ". Both are under Forge41, alongside nandex" },
        { c: "summary-nandex" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["harvey", "legal", "current", "now", "working on"],
    paras: [
      [
        {
          t: "Since Apr 2026 I'm SDE-II at Think41 embedded with Harvey.ai. I built their document-grounded RAG pipeline, integrated Ansarada DMS via Temporal durable workflows, and architected the multi-agent workflow engine",
        },
        { c: "resume-sde2" },
        {
          t: ". I also engineered CoT prompting, structured output, LLM-as-a-judge evals, PII redaction and prompt-injection defense, and used Anthropic prompt caching to cut inference cost",
        },
        { c: "resume-sde2" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["eval", "guardrail", "safety", "hallucination", "prompt injection", "pii", "judge"],
    paras: [
      [
        {
          t: "I treat prompts as production code — versioning, structured evals, regression testing, telemetry",
        },
        { c: "resume-sde1" },
        {
          t: ". At Harvey that became LLM-as-a-judge evals, PII redaction, prompt-injection defense and hallucination-mitigation guardrails around the RAG pipeline",
        },
        { c: "resume-sde2" },
        { t: ". Tooling: LangSmith, Langfuse, Ragas, Guardrails.ai" },
        { c: "resume-skills" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["experience", "years", "career", "background", "who are you", "about you", "yourself", "intro"],
    paras: [
      [
        {
          t: "I'm a Generative AI Engineer with 2+ years shipping production LLM systems, RAG pipelines, multi-agent workflows and MCP tooling",
        },
        { c: "resume-summary" },
        {
          t: ". I joined Think41 as an intern in Jun 2024 and progressed to SDE-I (client Atomicwork) and SDE-II (client Harvey.ai)",
        },
        { c: "resume-sde1" },
        { c: "resume-sde2" },
        { t: ". Based in Bangalore, open to interesting work" },
        { c: "summary-about" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["skill", "stack", "language", "python", "typescript", "framework", "tech"],
    paras: [
      [
        {
          t: "Core stack: Python, TypeScript, FastAPI, Next.js, PostgreSQL/pgvector, Temporal. GenAI: LangChain, LangGraph, FastMCP, Anthropic and OpenAI SDKs. Infra: Docker, Kubernetes, AWS Bedrock, Azure OpenAI, Vertex AI, OpenTelemetry",
        },
        { c: "resume-skills" },
        { t: ". Try " },
        { t: "!cat skills.json | jq", code: true },
        { t: " for the full list." },
      ],
    ],
  },
  {
    keys: ["education", "degree", "college", "university", "certif", "anthropic academy"],
    paras: [
      [
        {
          t: "B.E. in Computer Science & Engineering, 2020 – 2024, Shivamogga, Karnataka. Anthropic Academy certifications (Jul 2026): Intro to MCP, Intro to Agent Skills, Claude Code in Action, Building with the Claude API",
        },
        { c: "resume-edu" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["contact", "email", "linkedin", "github", "reach", "hire", "available", "open to"],
    paras: [
      [
        {
          t: "naik.nandishd@gmail.com · linkedin.com/in/nandishd · github.com/NandishNaik01. Status: open to interesting work",
        },
        { c: "summary-about" },
        { t: ". Or run " },
        { t: "/book", code: true },
        { t: " to schedule a call." },
      ],
    ],
  },
  {
    keys: ["nandex", "interview"],
    paras: [
      [
        {
          t: "nandex is Forge41's open-source RAG system — credential broker, Temporal importers, pgvector ingestion, RRF-fused hybrid retrieval with reranking, and streamed cited chat. It also runs an AI interview room where a LiveKit agent follows a resume-derived plan with sandboxed coding and SQL rounds",
        },
        { c: "summary-nandex" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["rating", "performance", "review", "sprint", "scrum", "lead"],
    paras: [
      [
        { t: "Rated Above Expectations (highest rating) across all performance reviews" },
        { c: "resume-summary" },
        {
          t: ". As SDE-I I led sprint planning and delivery for the Integration Pod: 16 work items across 47 merged PRs in 6 months, zero rollbacks",
        },
        { c: "resume-sde1" },
        { t: "." },
      ],
    ],
  },
];

export const projects: Project[] = [
  {
    name: "harvey-rag",
    title: "Harvey.ai RAG pipeline",
    year: "2026",
    one: "Document-grounded legal research: hybrid pgvector retrieval, re-ranking, streaming inference.",
    src: "resume-sde2",
    stack: ["Python", "pgvector", "OpenAI embeddings", "Temporal", "Redis"],
  },
  {
    name: "workflow-engine",
    title: "Multi-agent workflow automation engine",
    year: "2026",
    one: "Sole architect: HLD → LLD → prototype in one week; branching, tool use, Temporal state.",
    src: "resume-sde2",
    stack: ["Temporal", "Anthropic SDK", "Structured output", "LLM-as-judge"],
  },
  {
    name: "voice-legal-rag",
    title: "Voice-native legal RAG assistant",
    year: "2026",
    one: "LiveKit + Pipecat + Google ADK; Deepgram STT, ElevenLabs TTS; citations in Word add-in.",
    src: "resume-voice",
    stack: ["LiveKit", "Pipecat", "Google ADK", "Deepgram", "ElevenLabs", "Turbopuffer"],
  },
  {
    name: "claude-code-skills",
    title: "6 Claude Code skills for Atomicwork",
    year: "2025",
    one: "Integration lifecycle as LLM-executable workflows; weeks → under one week.",
    src: "resume-sde1",
    stack: ["Claude Code", "Devin", "Agile"],
  },
  {
    name: "genalpha-cli",
    title: "GenAlpha CLI",
    year: "2025",
    one: "Any API repo → production MCP server via OpenAPI + Python AST. Open source.",
    src: "resume-genalpha",
    stack: ["Python", "FastAPI", "Next.js", "Temporal", "FastMCP"],
  },
  {
    name: "nandex",
    title: "nandex",
    year: "2025",
    one: "Open-source RAG system + AI interview room (Forge41).",
    src: "summary-nandex",
    stack: ["Django", "pgvector", "Temporal", "LiveKit", "Next.js"],
  },
  {
    name: "rq-mucai",
    title: "RQ & MUCAI",
    year: "2024",
    one: "LangChain PRD generator with LiveKit collab; multi-agent HR/IT/PM assistant on Docker + NGINX.",
    src: "resume-intern",
    stack: ["LangChain", "LiveKit", "Docker", "NGINX"],
  },
];

export const gitlog: Commit[] = [
  {
    hash: "a7f3c2e",
    date: "2026-09",
    msg: "feat(harvey): multi-agent workflow engine — HLD, LLD, prototype in 1 week",
    tag: "HEAD -> main",
  },
  {
    hash: "9b1d0f4",
    date: "2026-07",
    msg: "feat(harvey): Ansarada DMS via Temporal durable workflows (OAuth 2.0, Redis, dead-session recovery)",
  },
  {
    hash: "e2c8a91",
    date: "2026-05",
    msg: "feat(harvey): end-to-end RAG — semantic chunking, pgvector hybrid BM25+vector, re-ranking, streaming",
  },
  { hash: "c41f7b3", date: "2026-04", msg: "chore: promote to SDE-II, client Harvey.ai", tag: "tag: sde-ii" },
  {
    hash: "5d9e6a0",
    date: "2026-02",
    msg: "feat(voice): LiveKit + Pipecat + Google ADK legal RAG POC with Deepgram/ElevenLabs",
  },
  {
    hash: "3f2b8c7",
    date: "2025-11",
    msg: "feat(forge41): GenAlpha CLI — API repo → MCP server via OpenAPI + AST; TPS iPaaS auth",
  },
  {
    hash: "8a4c1d2",
    date: "2025-08",
    msg: "perf(atomicwork): 6 Claude Code skills; integration delivery weeks → <1 week",
  },
  {
    hash: "1e7f9b5",
    date: "2025-06",
    msg: "feat(atomicwork): lead Integration Pod — 16 items, 47 PRs, 0 rollbacks",
  },
  { hash: "b6d3e08", date: "2025-02", msg: "chore: promote to SDE-I, client Atomicwork", tag: "tag: sde-i" },
  {
    hash: "0c9a2f1",
    date: "2024-10",
    msg: "feat(think41): MUCAI multi-agent HR/IT/PM assistant, per-domain memory isolation",
  },
  {
    hash: "7e1b4d6",
    date: "2024-07",
    msg: "feat(think41): RQ — LangChain PRD generator with LiveKit real-time collab",
  },
  { hash: "4a8f0c3", date: "2024-06", msg: "init: join Think41 as intern", tag: "tag: intern" },
];

export const tree: string[] = [
  "~/career",
  "├── think41/  (Jun 2024 – Present)",
  "│   ├── intern/  (Jun 2024 – Jan 2025)",
  "│   │   ├── rq.md          LangChain PRD generator + LiveKit",
  "│   │   └── mucai.md       multi-agent HR/IT/PM assistant",
  "│   ├── sde-i@atomicwork/  (Feb 2025 – Mar 2026)",
  "│   │   ├── claude-code-skills/  6 skills, weeks → <1 week",
  "│   │   └── integration-pod.md   16 items · 47 PRs · 0 rollbacks",
  "│   └── sde-ii@harvey.ai/  (Apr 2026 – Present)",
  "│       ├── rag-pipeline.md      pgvector hybrid + streaming",
  "│       ├── workflow-engine.md   sole architect, Temporal",
  "│       └── ansarada-dms.md      OAuth 2.0 durable workflows",
  "├── forge41/  (2025 – Present, open source)",
  "│   ├── genalphacli/",
  "│   ├── tps/",
  "│   └── nandex/",
  "└── education/",
  "    ├── be-cse-2020-2024.md",
  "    └── anthropic-academy-2026/  4 certifications",
  "",
  "5 directories, 13 files",
];

export const skills: Skills = {
  languages: ["Python", "TypeScript", "JavaScript", "Java", "SQL"],
  backend: ["FastAPI", "Next.js", "React", "Spring Boot", "Django"],
  genai: [
    "LangChain",
    "LangGraph",
    "LlamaIndex",
    "CrewAI",
    "AutoGen",
    "FastMCP",
    "Anthropic SDK",
    "OpenAI SDK",
    "DSPy",
  ],
  rag: [
    "hybrid BM25+dense",
    "re-ranking",
    "semantic chunking",
    "query rewriting",
    "pgvector",
    "Pinecone",
    "Weaviate",
    "Qdrant",
    "FAISS",
  ],
  agentic: ["MCP", "Google ADK", "tool use", "ReAct", "Temporal", "A2A"],
  voice: ["LiveKit", "Pipecat", "Deepgram", "ElevenLabs"],
  eval_infra: [
    "LangSmith",
    "Langfuse",
    "Ragas",
    "Guardrails.ai",
    "AWS Bedrock",
    "Azure OpenAI",
    "Vertex AI",
    "vLLM",
    "Docker",
    "Kubernetes",
    "OpenTelemetry",
  ],
  finetune: ["LoRA", "QLoRA", "PEFT", "RLHF", "DPO", "PyTorch"],
};

export const ps: string[] = [
  "USER       PID  %CPU  %MEM  COMMAND",
  "nandisha  4201  38.0  12.1  harvey/workflow-engine --phase=production-hardening",
  "nandisha  4188  22.4   8.3  harvey/rag-pipeline --tune=reranker",
  "nandisha  3970  11.0   4.0  forge41/nandex --branch=feat-interview-room",
  "nandisha  3312   7.5   2.2  learn/anthropic-academy --course='Agent Skills'",
  "nandisha  2101   3.1   1.0  read/papers --topic='GraphRAG, A2A protocols'",
];

export const history: string[] = [
  "what have you built with LiveKit?",
  "tell me about the Harvey RAG pipeline",
  "what are the Claude Code skills?",
  "what is GenAlpha?",
  "are you open to work?",
  "how many years of experience?",
];

export const manpage: string[] = [
  "NANDISHA(1)                    User Commands                   NANDISHA(1)",
  "",
  "NAME",
  "       nandisha - generative AI engineer; ships LLM systems that hold up in production",
  "",
  "SYNOPSIS",
  "       nandisha [--rag] [--agents] [--mcp] [--voice] <problem>",
  "",
  "DESCRIPTION",
  "       Takes an ambiguous product problem and returns a shipped, cited, observable",
  "       system. Defaults to hybrid retrieval, Temporal for anything durable, and",
  "       evals before prompts. Prefers small teams and hard problems.",
  "",
  "OPTIONS",
  "       --rag      pgvector / Turbopuffer, BM25 + dense, re-ranking, streaming",
  "       --agents   multi-agent orchestration, tool use, state on Temporal",
  "       --mcp      turns any API into agent tools (see genalpha(1))",
  "       --voice    LiveKit + Pipecat, Deepgram STT, ElevenLabs TTS",
  "",
  "EXIT STATUS",
  "       Rated Above Expectations on every review to date.",
  "",
  "SEE ALSO",
  "       !ls projects/, !git log, /book",
  "",
  "Think41 / Harvey.ai              September 2026                     NANDISHA(1)",
];
