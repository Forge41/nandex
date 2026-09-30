import { LINKS } from "@/lib/terminal/constants";
import type { Answer, Commit, Project, Role, Skills, StackGroup } from "@/lib/types";

export const sourceOrder = [
  "resume-summary",
  "resume-intern",
  "resume-sde1",
  "resume-sde2",
  "resume-autointerviewer",
  "resume-nantex",
  "resume-skills",
  "resume-edu",
  "summary-about",
  "summary-think41",
  "summary-autointerviewer",
  "summary-nantex",
  "resume-voice",
  "resume-genalpha",
  "resume-tps",
] as const;

export const answers: Answer[] = [
  {
    keys: ["livekit", "voice", "pipecat", "deepgram", "elevenlabs", "audio", "speech"],
    paras: [
      [
        {
          t: "AutoInterviewer runs live voice interviews on LiveKit: 1,000 concurrent interviews at 300ms live-audio round-trip latency",
        },
        { c: "resume-autointerviewer" },
        {
          t: ". Before that, as an intern I built MUCAI, a multi-persona voice bot with configurable STT/TTS (Deepgram, Cartesia, OpenAI, ElevenLabs, Sarvam, Gemini), scaled to 1,000+ concurrent sessions for JPMC use-cases",
        },
        { c: "resume-intern" },
        {
          t: ". I also built a voice-native legal RAG proof-of-concept for Harvey: a real-time audio pipeline on LiveKit + Pipecat, Google ADK for multi-agent orchestration, Deepgram STT and ElevenLabs TTS for low-latency turns",
        },
        { c: "resume-voice" },
        { t: "." },
      ],
      [
        {
          t: "The retrieval side used Reducto OCR for scanned documents, text-embedding-3-large in Turbopuffer, and hybrid BM25 + semantic search with citations surfaced in a Word add-in",
        },
        { c: "resume-voice" },
        { t: ". AutoInterviewer is open source" },
        { c: "summary-autointerviewer" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["rag", "retrieval", "pgvector", "embedding", "chunk", "bm25", "hybrid", "vector"],
    paras: [
      [
        {
          t: "At Harvey.ai I built the end-to-end RAG pipeline for document-grounded legal research, scaling to 1M+ documents (80K+ per sync session) across 300+ tenants: semantic chunking, OpenAI text-embedding-3-large, pgvector hybrid BM25 + vector retrieval, re-ranking and low-latency streaming inference, fed by an import pipeline that syncs documents from third-party apps",
        },
        { c: "resume-sde2" },
        { t: "." },
      ],
      [
        {
          t: "The open-source version lives in AutoInterviewer: parse → chunk → embed → index on Temporal, hybrid search fused with Reciprocal Rank Fusion and a cross-encoder reranker, answers streamed with structured citations",
        },
        { c: "summary-autointerviewer" },
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
        { c: "summary-think41" },
        {
          t: ". AutoInterviewer also runs on Temporal: a resume becomes a tailored interview plan in 5s",
        },
        { c: "resume-autointerviewer" },
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
        { c: "summary-think41" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["nantex", "latex", "overleaf"],
    paras: [
      [
        {
          t: "nantex is my open-source LaTeX live-preview CLI on PyPI: it watches your .tex, lints it locally, compiles remotely through latex-on-http so no TeX install is needed, and reloads the browser over Server-Sent Events. Its --mcp mode exposes compile_latex and get_compile_status so agents can compile LaTeX and read structured errors",
        },
        { c: "summary-nantex" },
        { t: ". It's on PyPI, and 30+ friends use it to compile their own resumes" },
        { c: "resume-nantex" },
        { t: ". Try it: /nantex." },
      ],
    ],
  },
  {
    keys: ["mcp", "genalpha", "model context protocol", "cli", "open source", "open-source"],
    paras: [
      [
        {
          t: "At Atomicwork I designed and built a Third-Party MCP Server Service hosting custom-built MCP servers, scaling to 20+ MCP servers with zero downtime",
        },
        { c: "resume-sde1" },
        {
          t: ". In open source, GenAlpha CLI converts any API repo into a production MCP server via OpenAPI detection and Python AST route extraction, so arbitrary APIs become tools for Claude, ChatGPT or Cursor; Temporal orchestrates Parse → Generate → Publish",
        },
        { c: "resume-genalpha" },
        {
          t: ". TPS is the companion embedded iPaaS that lets those MCP servers hold live OAuth 2.0 / API-key / mTLS credentials",
        },
        { c: "resume-tps" },
        { t: ". All open source, alongside AutoInterviewer and nantex" },
        { c: "summary-autointerviewer" },
        { c: "summary-nantex" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["harvey", "legal", "current", "now", "working on"],
    paras: [
      [
        {
          t: "Since Apr 2026 I'm SDE-II at Think41 embedded with Harvey.ai. I built their document-grounded RAG pipeline, now over 1M+ documents across 300+ tenants, and the import pipeline that syncs documents from third-party apps",
        },
        { c: "resume-sde2" },
        {
          t: ". I also integrated Ansarada DMS via Temporal durable workflows, architected the multi-agent workflow engine, and used Anthropic prompt caching to cut inference cost",
        },
        { c: "summary-think41" },
        { t: "." },
      ],
    ],
  },
  {
    keys: ["eval", "guardrail", "safety", "hallucination", "prompt injection", "pii", "judge"],
    paras: [
      [
        {
          t: "I treat prompts as production code — versioning, structured evals, regression testing, telemetry. At Harvey that became LLM-as-a-judge evals, PII redaction and prompt-injection defense",
        },
        { c: "summary-think41" },
        { t: ". Tooling: LangSmith, Ragas, LLM-as-a-judge and offline evals" },
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
          t: "Core stack: Python, TypeScript, FastAPI, Next.js, PostgreSQL/pgvector, Temporal. GenAI: LangChain, LangGraph, FastMCP, Anthropic and OpenAI SDKs. Infra: Docker, Kubernetes, AWS Bedrock, Azure OpenAI, GCP Vertex AI, CI/CD",
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
          t: "naik.nandishd@gmail.com · linkedin.com/in/nandishd · github.com/Nandisha-D. Status: open to interesting work",
        },
        { c: "summary-about" },
        { t: ". Or run " },
        { t: "/book", code: true },
        { t: " to schedule a call." },
      ],
    ],
  },
  {
    keys: ["autointerviewer", "interview"],
    paras: [
      [
        {
          t: "AutoInterviewer is my open-source AI interviewer, live at autointerviewer.nandish.online: a resume becomes a tailored interview plan, and a LiveKit voice agent runs the interview with sandboxed coding and SQL rounds. Underneath is a full RAG platform — credential broker, Temporal importers, pgvector ingestion, RRF-fused hybrid retrieval with reranking, and streamed cited chat",
        },
        { c: "summary-autointerviewer" },
        { t: ". It turns a resume into a tailored interview plan in 5s and has scaled to 1,000 concurrent interviews" },
        { c: "resume-autointerviewer" },
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
          t: ". As SDE-I I led a 5-engineer Integration Team that shipped 20+ third-party integrations (Workday, Keka, Rippling, ticketing, telecom)",
        },
        { c: "resume-sde1" },
        { t: ", running sprint planning and delivery: 16 work items across 47 merged PRs in 6 months, zero rollbacks" },
        { c: "summary-think41" },
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
    src: "summary-think41",
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
    src: "summary-think41",
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
    name: "autointerviewer",
    title: "AutoInterviewer",
    year: "2026",
    label: "AI interview room",
    one: "Resume → tailored interview plan in 5s; 1,000 concurrent live voice interviews.",
    src: "resume-autointerviewer",
    stack: ["Python", "Django", "Temporal", "pgvector", "Next.js", "LiveKit", "Terraform", "AWS"],
    live: { url: LINKS.autointerviewer, host: "autointerviewer.nandish.online", shot: "/shots/autointerviewer.jpg" },
    repo: "https://github.com/NandishNaik01/nandex",
    did: [
      "Turns a résumé into a tailored interview plan in 5 seconds, then runs it as a live LiveKit voice interview with sandboxed coding and SQL rounds.",
      "Scaled to 1,000 concurrent interviews at 300ms live-audio round-trip latency.",
      "A 35% interview-to-offer conversion lift for pilot recruiters.",
    ],
  },
  {
    name: "nantex",
    title: "nantex",
    year: "2026",
    label: "open source · CLI",
    one: "LaTeX live preview in the browser, no TeX install. CLI + MCP server on PyPI.",
    src: "resume-nantex",
    stack: ["Python", "Typer", "SSE", "FastMCP", "PyPI"],
    live: { url: LINKS.nantex, host: "nantex.nandish.online", shot: "/shots/nantex.jpg" },
    repo: "https://github.com/NandishNaik01/nantex",
    did: [
      "Live-compiles .tex to PDF in seconds with no local LaTeX install.",
      "Compiled 1,000+ page-equivalents in 5 minutes across users.",
      "Published to PyPI; adopted by 30+ friends to compile their own résumés.",
    ],
  },
  {
    name: "rq-mucai",
    title: "MUCAI & RQ",
    year: "2024",
    one: "Multi-persona voice bot: 100+ personas, 1,000+ concurrent sessions; plus a LangChain PRD generator.",
    src: "resume-intern",
    stack: ["Deepgram", "Cartesia", "ElevenLabs", "LangChain", "LiveKit", "Docker"],
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
    hash: "d4e7b21",
    date: "2026-08",
    msg: "feat(autointerviewer): AutoInterviewer — resume → interview plan in 5s, 1,000 concurrent voice interviews",
  },
  {
    hash: "e2c8a91",
    date: "2026-05",
    msg: "feat(harvey): end-to-end RAG over 1M+ docs, 300+ tenants — pgvector hybrid BM25+vector, re-ranking, streaming",
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
    msg: "feat(genalpha): GenAlpha CLI — API repo → MCP server via OpenAPI + AST; TPS iPaaS auth",
  },
  {
    hash: "f0a2c64",
    date: "2025-10",
    msg: "feat(atomicwork): third-party MCP server service — 20+ MCP servers, zero downtime",
  },
  {
    hash: "8a4c1d2",
    date: "2025-08",
    msg: "perf(atomicwork): 6 Claude Code skills; integration delivery weeks → <1 week",
  },
  {
    hash: "1e7f9b5",
    date: "2025-06",
    msg: "feat(atomicwork): lead 5-engineer Integration Team — 20+ integrations, 47 PRs, 0 rollbacks",
  },
  { hash: "b6d3e08", date: "2025-02", msg: "chore: promote to SDE-I, client Atomicwork", tag: "tag: sde-i" },
  {
    hash: "0c9a2f1",
    date: "2024-10",
    msg: "feat(think41): MUCAI multi-persona voice bot — 100+ personas, 1,000+ concurrent sessions",
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
  "│   │   └── mucai.md       multi-persona voice bot, 1,000+ sessions",
  "│   ├── sde-i@atomicwork/  (Feb 2025 – Mar 2026)",
  "│   │   ├── integration-team.md  5 engineers · 20+ integrations",
  "│   │   ├── mcp-server-service/  20+ MCP servers, zero downtime",
  "│   │   └── claude-code-skills/  6 skills, weeks → <1 week",
  "│   └── sde-ii@harvey.ai/  (Apr 2026 – Present)",
  "│       ├── rag-pipeline.md      1M+ docs · 300+ tenants",
  "│       ├── workflow-engine.md   sole architect, Temporal",
  "│       └── ansarada-dms.md      OAuth 2.0 durable workflows",
  "├── open-source/  (2025 – Present)",
  "│   ├── genalphacli/",
  "│   ├── tps/",
  "│   ├── autointerviewer/  AI interviewer",
  "│   └── nantex/",
  "└── education/",
  "    ├── be-cse-2020-2024.md",
  "    └── anthropic-academy-2026/  4 certifications",
  "",
  "5 directories, 15 files",
];

export const skills: Skills = {
  languages: ["Python", "TypeScript", "Java", "SQL"],
  backend: ["FastAPI", "Next.js", "React", "Django"],
  genai: [
    "LangChain",
    "LangGraph",
    "LlamaIndex",
    "FastMCP",
    "Anthropic SDK",
    "OpenAI SDK",
    "Hugging Face Transformers",
  ],
  rag: [
    "hybrid BM25+dense",
    "re-ranking",
    "semantic chunking",
    "pgvector",
    "Pinecone",
    "Qdrant",
    "FAISS",
  ],
  agentic: ["multi-agent", "MCP", "Google ADK", "tool use", "ReAct", "Temporal"],
  voice: ["LiveKit", "Deepgram", "Cartesia", "ElevenLabs", "Sarvam"],
  eval_infra: [
    "LangSmith",
    "Ragas",
    "LLM-as-a-judge",
    "offline evals",
    "PII redaction",
    "prompt-injection defense",
    "AWS Bedrock",
    "Azure OpenAI",
    "GCP Vertex AI",
    "Docker",
    "Kubernetes",
    "Terraform",
    "CI/CD",
  ],
};

export const ps: string[] = [
  "USER       PID  %CPU  %MEM  COMMAND",
  "nandisha  4201  38.0  12.1  harvey/workflow-engine --phase=production-hardening",
  "nandisha  4188  22.4   8.3  harvey/rag-pipeline --tune=reranker",
  "nandisha  3970  11.0   4.0  autointerviewer --scale=1000-concurrent",
  "nandisha  3811   9.2   3.1  nantex --watch resume.tex",
  "nandisha  3312   7.5   2.2  learn/anthropic-academy --course='Agent Skills'",
  "nandisha  2101   3.1   1.0  read/papers --topic='GraphRAG, A2A protocols'",
];

export const history: string[] = [
  "what have you built with LiveKit?",
  "tell me about the Harvey RAG pipeline",
  "what are the Claude Code skills?",
  "what is AutoInterviewer?",
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

export const experience: Role[] = [
  {
    id: "sde2",
    role: "SDE-II",
    org: "Think41",
    client: "Harvey.ai",
    when: "Apr 2026 – Present",
    current: true,
    one: "Built Harvey.ai's end-to-end RAG pipeline for document-grounded legal research, scaling to 1M+ documents across 300+ tenants.",
    src: "resume-sde2",
    stack: ["Python", "pgvector", "Anthropic SDK", "OpenAI SDK", "Temporal"],
    did: [
      "Semantic chunking, OpenAI text-embedding-3-large, pgvector hybrid BM25 + vector retrieval, re-ranking, low-latency streaming inference.",
      "1M+ documents and 80K+ docs per sync session, across 300+ tenants at 100+ users each.",
      "An import pipeline syncing documents from third-party apps, on-demand and scheduled, batched for scale.",
    ],
  },
  {
    id: "sde1",
    role: "SDE-I",
    org: "Think41",
    client: "Atomicwork",
    when: "Feb 2025 – Mar 2026",
    one: "Led a 5-engineer Integration Team and built a service hosting 20+ custom MCP servers with zero downtime.",
    src: "resume-sde1",
    stack: ["Python", "FastAPI", "MCP", "FastMCP", "Docker"],
    did: [
      "Shipped 20+ third-party integrations — HRMS (Workday, Keka, Rippling), ticketing, telecom.",
      "Designed and built a Third-Party MCP Server Service hosting custom-built MCP servers, scaling to 20+ with zero downtime.",
    ],
  },
  {
    id: "intern",
    role: "Intern",
    org: "Think41",
    when: "Jun 2024 – Jan 2025",
    one: "Designed and built MUCAI, a multi-persona conversational AI bot scaled to 100+ personas and 1,000+ concurrent sessions.",
    src: "resume-intern",
    stack: ["Python", "Deepgram", "Cartesia", "ElevenLabs", "LiveKit"],
    did: [
      "Configurable STT/TTS across Deepgram, Cartesia, OpenAI, ElevenLabs, Sarvam and Gemini behind one multi-provider integration layer.",
      "System-prompt-driven persona switching per SKU and use-case.",
      "100+ personas and 1,000+ concurrent sessions for JPMC use-cases, on-prem hosted, client-aware via conversation history and screen-aware via real-time frame processing.",
    ],
  },
];

export const stackGroups: StackGroup[] = [
  { label: "Languages & backend", items: [...skills.languages, ...skills.backend] },
  { label: "GenAI", items: skills.genai },
  { label: "RAG & retrieval", items: ["pgvector", "Pinecone", "Qdrant", "FAISS", "hybrid BM25+dense", "re-ranking"] },
  { label: "Agentic", items: skills.agentic },
  { label: "Voice", items: skills.voice },
  { label: "Eval & infra", items: ["LangSmith", "Ragas", "AWS Bedrock", "Azure OpenAI", "GCP Vertex AI", "Docker", "Kubernetes", "Terraform"] },
];
