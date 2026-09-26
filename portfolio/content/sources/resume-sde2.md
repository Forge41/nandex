---
doc: resume.pdf
title: Think41 — SDE-II, client Harvey.ai (Apr 2026 – Present)
---

Built end-to-end RAG pipeline for document-grounded legal research: semantic chunking, OpenAI text-embedding-3-large, pgvector hybrid BM25 + vector retrieval, re-ranking, context assembly, and low-latency streaming LLM inference at production scale. Integrated Ansarada DMS via Temporal durable workflows (OAuth 2.0 lifecycle, Redis caching, dead-session recovery). Sole architect of Harvey's multi-agent workflow automation engine — led HLD, LLD, and first prototype within one week; orchestrates branching logic, tool use / function calling, and state persistence on Temporal. Engineered CoT prompting, structured output, LLM-as-a-judge evals, PII redaction, and prompt-injection defense; applied Anthropic prompt caching to cut per-request inference cost.
