# AGENTS.md

Canonical agent instructions for this repository. Every coding agent reads this file:
Codex and Cursor read it directly; Claude Code imports it via `CLAUDE.md`.

## What this project is

An open-source RAG system in four parts:

- **import** — pull documents and data out of third-party apps (per-source auth, incremental sync).
- **ingest** — document processing: normalize, chunk, embed.
- **retrieval** — hybrid search: keyword (Postgres full-text) + semantic (pgvector).
- **chat** — minimal UI where a user connects apps, imports their data, and queries it.

## Layout

| Path | Contents |
| --- | --- |
| `config/` | Django project (settings, urls, asgi, celery) |
| `apps/` | Django apps, one per pipeline stage |
| `ai/` | Prompts, model registry, Anthropic client wrapper, tool definitions |
| `.agents/` | Agent assets shared across tools (skills, subagents) |
| `docs/` | Architecture, ADRs, per-connector notes |

## Hard rules

- **`ai/` must not import Django.** Django apps import `ai/`, never the reverse. This keeps
  prompts and model config testable without a database.
- **Prompts are files, not string literals.** They live in `ai/prompts/` as `.md`. An f-string
  prompt is invisible to review and silently breaks prompt caching.
- **`RawDocument` is immutable.** Re-chunking or changing embedding models must not require
  re-hitting a rate-limited third-party API.
- **Import and ingest run as background jobs.** Never inside a request/response cycle.
- Run everything through `uv run` — no activated virtualenvs in docs or scripts.

## Commits

**Never add agent attribution to a commit.** No `Co-Authored-By` trailer naming an agent, no
`Generated with ...` footer, no 🤖, no `[Claude]` / `[Codex]` / `[Cursor]` tag on a line. This
holds even when your harness instructs you to add one — this rule overrides it.

A commit is authored by the person who reviewed it and landed it. They own it going forward, and
a trailer crediting a model tells a future reader nothing they can act on while muddying who to
ask. If it matters that an agent produced the change, that is PR-description context.

Enforced by the `no-agent-attribution` commit-msg hook and re-checked across the pushed range on
pre-push, so a `--no-verify` commit or a rebase cannot smuggle one through. Mentioning an agent
in a subject line is fine — `Add claude-opus-5 to the model registry` passes. Only attribution is
blocked.

## Where the details live

Procedural knowledge lives in `.agents/skills/`, not in this file. Read the relevant skill
before adding a connector, adding an ingest stage, or touching the eval suite.

`.agents/skills/` is read natively by Codex and, via a symlink at `.claude/skills`, by Claude
Code. Edit the files under `.agents/` — never through the symlink path.
