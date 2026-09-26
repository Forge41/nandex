import type { ThemeName } from "./types";

export const THEME_VARS = [
  "--t-bg",
  "--t-panel",
  "--t-raise",
  "--t-fg",
  "--t-sub",
  "--t-muted",
  "--t-dim",
  "--t-border",
  "--t-accent",
  "--t-green",
  "--t-red",
  "--t-blue",
  "--t-violet",
  "--t-sel",
  "--t-hl",
] as const;

type ThemeVars = Record<(typeof THEME_VARS)[number], string>;

export const THEMES: Record<ThemeName, ThemeVars | null> = {
  default: null,
  dracula: {
    "--t-bg": "#282a36",
    "--t-panel": "#21222c",
    "--t-raise": "#343746",
    "--t-fg": "#f8f8f2",
    "--t-sub": "#c8cbe0",
    "--t-muted": "#8b93bf",
    "--t-dim": "#6272a4",
    "--t-border": "rgba(255,255,255,.1)",
    "--t-accent": "#bd93f9",
    "--t-green": "#50fa7b",
    "--t-red": "#ff5555",
    "--t-blue": "#8be9fd",
    "--t-violet": "#ff79c6",
    "--t-sel": "rgba(255,255,255,.08)",
    "--t-hl": "rgba(189,147,249,.16)",
  },
  gruvbox: {
    "--t-bg": "#282828",
    "--t-panel": "#1d2021",
    "--t-raise": "#32302f",
    "--t-fg": "#ebdbb2",
    "--t-sub": "#d5c4a1",
    "--t-muted": "#a89984",
    "--t-dim": "#7c6f64",
    "--t-border": "rgba(235,219,178,.12)",
    "--t-accent": "#fabd2f",
    "--t-green": "#b8bb26",
    "--t-red": "#fb4934",
    "--t-blue": "#83a598",
    "--t-violet": "#d3869b",
    "--t-sel": "rgba(235,219,178,.08)",
    "--t-hl": "rgba(250,189,47,.16)",
  },
  nord: {
    "--t-bg": "#2e3440",
    "--t-panel": "#272c36",
    "--t-raise": "#3b4252",
    "--t-fg": "#eceff4",
    "--t-sub": "#d8dee9",
    "--t-muted": "#9aa5b8",
    "--t-dim": "#6f7a8f",
    "--t-border": "rgba(236,239,244,.1)",
    "--t-accent": "#88c0d0",
    "--t-green": "#a3be8c",
    "--t-red": "#bf616a",
    "--t-blue": "#81a1c1",
    "--t-violet": "#b48ead",
    "--t-sel": "rgba(236,239,244,.08)",
    "--t-hl": "rgba(136,192,208,.16)",
  },
};

export const isTheme = (name: string): name is ThemeName => name in THEMES;

export const DEFAULT_BG = "hsl(30 7% 5%)";

export const VERBS = [
  "Grepping résumé…",
  "Compiling experience…",
  "Re-ranking memories…",
  "Chunking career…",
  "Embedding anecdotes…",
  "Consulting summary.md…",
  "Fusing BM25 and vibes…",
  "Awaiting Temporal…",
];

export const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

export const READY_STATUS = "ask me anything · / commands · ! shell";

export const SUGGESTIONS: string[] = [
  "what have you built with LiveKit?",
  "how does the Harvey RAG pipeline work?",
  "what are the Claude Code skills?",
  "what is GenAlpha?",
  "are you open to work?",
  "how many years of experience?",
  "how do you evaluate LLM outputs?",
  "tell me about the multi-agent engine",
  "!git log --author=nandisha",
  "!tree ~/career",
  "!ls projects/",
  "/fit",
  "!cat skills.json | jq",
  "what is nandex?",
  "!man nandisha",
  "/book",
  "/recruiter",
];

export const TOUR = [
  "!ls projects/",
  "!cat projects/harvey-rag.md",
  "!tree ~/career",
  "!git log --author=nandisha",
  "!cat skills.json | jq",
  "!grep livekit -r ~/",
  "!ps aux",
  "!uptime",
  "!man nandisha",
  "!curl nandisha.dev/contact",
  "!ping nandisha",
  "!history",
  "what have you built with LiveKit?",
];

export const COMMITS = [
  "feat(rag): re-rank with cross-encoder before context assembly",
  "fix(temporal): recover dead OAuth sessions on worker restart",
  "feat(mcp): expose OpenAPI routes as agent tools via AST parse",
  "perf(inference): enable Anthropic prompt caching on system blocks",
  "feat(voice): barge-in — cancel TTS when the user starts talking",
  "test(evals): LLM-as-judge regression suite for citation faithfulness",
  "feat(skills): claude-code skill for integration scaffolding",
  "chore(pgvector): HNSW index for 3072-dim embeddings",
  "fix(citations): dedupe overlapping chunk spans in footnotes",
  "feat(agents): branching tool-use with persisted state",
  "docs(nandex): interview-room architecture notes",
  "feat(ingest): Reducto OCR path for scanned documents",
  "refactor(retrieval): RRF fusion of BM25 + dense results",
  "fix(pii): redact emails before logging prompts",
  "feat(tps): mTLS provider for embedded iPaaS credentials",
];

export const ICONS: Record<string, string> = {
  Python: "python",
  TypeScript: "typescript",
  FastAPI: "fastapi",
  "Next.js": "nextdotjs",
  LangGraph: "langgraph",
  "Anthropic SDK": "anthropic",
  pgvector: "postgresql",
  Qdrant: "qdrant",
  MCP: "modelcontextprotocol",
  Temporal: "temporal",
  LiveKit: "livekit",
  Deepgram: "deepgram",
  Docker: "docker",
  Kubernetes: "kubernetes",
  OpenTelemetry: "opentelemetry",
  Prometheus: "prometheus",
};

export const SKILL_GRID = [
  { k: "languages & backend", items: ["Python", "TypeScript", "FastAPI", "Next.js"] },
  { k: "genai & rag", items: ["LangGraph", "Anthropic SDK", "pgvector", "Qdrant"] },
  { k: "agentic & voice", items: ["MCP", "Temporal", "LiveKit", "Deepgram"] },
  { k: "eval & infra", items: ["Docker", "Kubernetes", "OpenTelemetry", "Prometheus"] },
];

export const RECRUITER_TAGS = [
  "Python",
  "TypeScript",
  "FastAPI",
  "pgvector",
  "Temporal",
  "LiveKit",
  "MCP",
  "LangGraph",
  "Anthropic SDK",
  "Kubernetes",
];

export const TRACE_SRC = [
  "def mount(node, depth=0):",
  "    open(node)  # read",
  "    for child in node.children:",
  "        mount(child, depth + 1)",
  "    node.ready = True",
  "",
  'mount(fs["~/nandisha"])',
];

export type MountNode = { n: string; c?: MountNode[] };

export const MOUNT_TREE: MountNode = {
  n: "~/nandisha",
  c: [
    { n: "resume.pdf" },
    { n: "summary.md" },
    { n: "skills.json" },
    {
      n: "projects/",
      c: [
        { n: "harvey-rag.md" },
        { n: "workflow-engine.md" },
        { n: "voice-legal-rag.md" },
        { n: "genalpha-cli.md" },
        { n: "nandex.md" },
      ],
    },
    {
      n: "career/",
      c: [{ n: "think41/", c: [{ n: "intern" }, { n: "sde-i" }, { n: "sde-ii" }] }, { n: "forge41/" }, { n: "education/" }],
    },
    { n: "agent/", c: [{ n: "retrieval" }, { n: "citations" }, { n: "voice" }] },
  ],
};

export const BOOT_LOG = [
  "Mounting ~/nandisha",
  "Loading resume.pdf (1 page, 9 sections)",
  "Loading summary.md",
  "Embedding 11 chunks → pgvector",
  "Starting agent · model=claude · retrieval=hybrid(bm25+dense)",
  "Reached target portfolio.target",
];

export const CAREER_START = "2024-06-03";
export const CAREER_START_IST = "2024-06-03T09:00:00+05:30";

export const LINKS = {
  github: "https://github.com/NandishNaik01",
  linkedin: "https://linkedin.com/in/nandishd",
  email: "naik.nandishd@gmail.com",
  resume: "/resume.pdf",
  interview: "https://nandex.netlify.app/",
};

export const BOOTED_KEY = "nandisha_portfolio_booted";

// Matches PORTFOLIO_MAX_JD_CHARS on the backend; longer pastes are sent truncated.
export const MAX_JD_CHARS = 12000;
