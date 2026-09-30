/**
 * Which stack items have a brand mark and which fall back to a monogram.
 *
 * Simple Icons carries no slug for several of these (LlamaIndex, the OpenAI SDK, Pinecone,
 * Cartesia, Sarvam, Ragas, LangSmith, Bedrock, Azure — checked against cdn.simpleicons.org),
 * so the choice is made here rather than by letting a request 404 and swapping the tile at
 * runtime. A tile's size and label never depend on the network.
 */
export type Mark = { slug: string } | { mono: string };

const MARKS: Record<string, Mark> = {
  Python: { slug: "python" },
  TypeScript: { slug: "typescript" },
  Java: { slug: "openjdk" },
  SQL: { mono: "SQ" },
  FastAPI: { slug: "fastapi" },
  "Next.js": { slug: "nextdotjs" },
  React: { slug: "react" },
  Django: { slug: "django" },

  LangChain: { slug: "langchain" },
  LangGraph: { slug: "langgraph" },
  LlamaIndex: { mono: "LI" },
  FastMCP: { slug: "modelcontextprotocol" },
  "Anthropic SDK": { slug: "anthropic" },
  "OpenAI SDK": { mono: "AI" },
  "Hugging Face Transformers": { slug: "huggingface" },

  pgvector: { slug: "postgresql" },
  Pinecone: { mono: "PC" },
  Qdrant: { slug: "qdrant" },
  FAISS: { slug: "meta" },
  "hybrid BM25+dense": { mono: "BM" },
  "re-ranking": { mono: "RR" },

  "multi-agent": { mono: "MA" },
  MCP: { slug: "modelcontextprotocol" },
  "Google ADK": { slug: "googlecloud" },
  "tool use": { mono: "TU" },
  ReAct: { mono: "RA" },
  Temporal: { slug: "temporal" },

  LiveKit: { slug: "livekit" },
  Deepgram: { slug: "deepgram" },
  Cartesia: { mono: "CA" },
  ElevenLabs: { slug: "elevenlabs" },
  Sarvam: { mono: "SA" },

  LangSmith: { slug: "langchain" },
  Ragas: { mono: "RG" },
  "AWS Bedrock": { mono: "AW" },
  "Azure OpenAI": { mono: "AZ" },
  "GCP Vertex AI": { slug: "googlecloud" },
  Docker: { slug: "docker" },
  Kubernetes: { slug: "kubernetes" },
  Terraform: { slug: "terraform" },
};

const monogram = (label: string) => label.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();

export const markFor = (label: string): Mark => MARKS[label] ?? { mono: monogram(label) };

/** Short display labels; the tiles are narrow and a few names do not fit. */
const SHORT: Record<string, string> = {
  "Hugging Face Transformers": "Hugging Face",
  "hybrid BM25+dense": "BM25+dense",
  "Anthropic SDK": "Anthropic",
  "OpenAI SDK": "OpenAI",
  "GCP Vertex AI": "Vertex AI",
  "AWS Bedrock": "Bedrock",
  "Azure OpenAI": "Azure",
};

export const shortLabel = (label: string) => SHORT[label] ?? label;

/** `!grep <skill> -r ~/` — the query the stack tiles run. */
export const grepFor = (label: string) => `!grep ${label.split(" ")[0].toLowerCase().replace(/[^a-z0-9.+-]/g, "")} -r ~/`;
