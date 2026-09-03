# AGENTS.md

Canonical agent instructions for this repository. Every coding agent reads this file:
Codex and Cursor read it directly; Claude Code imports it via `CLAUDE.md`.

## What this project is

An open-source RAG system in four parts:

- **import** — split into two apps: `tps` (connection/credential broker only — per-source auth,
  no sync logic) and `importer` (owns sync/orchestration: uses a `tps` connection's token to pull
  data, tracks cursors, writes documents).
- **ingest** — document processing: normalize, chunk, embed.
- **retrieval** — hybrid search: keyword (Postgres full-text) + semantic (pgvector).
- **chat** — minimal UI where a user connects apps, imports their data, and queries it.

## Layout

The repo splits into a Next.js frontend and a Django backend, both under the root tooling below.

| Path | Contents |
| --- | --- |
| `frontend/` | Next.js app: connect-app OAuth flows, import status, chat UI |
| `backend/config/` | Django project (settings, urls, asgi, celery) |
| `backend/apps/` | Django apps, one per pipeline stage (`tps`, `importer`, `ingest`, `retrieval`, `chat`) |
| `backend/ai/` | Prompts, model registry, Anthropic client wrapper, tool definitions |
| `.agents/` | Agent assets shared across tools (skills, subagents) |

Longer-form architecture rationale and directory-tree planning docs are not checked into git —
they live locally under `.claude/plans/docs/` (gitignored) as developer planning material, not
shared canonical reference.

## Hard rules

- **`ai/` must not import Django.** Django apps import `ai/`, never the reverse. This keeps
  prompts and model config testable without a database.
- **Prompts are files, not string literals.** They live in `ai/prompts/` as `.md`. An f-string
  prompt is invisible to review and silently breaks prompt caching.
- **`RawDocument` is immutable, and owned by `importer`.** Re-chunking or changing embedding
  models must not require re-hitting a rate-limited third-party API. `tps` never writes it;
  `ingest` only reads it.
- **`tps` never depends on anything above it.** `importer`, `ingest`, `retrieval`, and `chat` may
  depend on `tps`; `tps` must not import any of them. It exposes connections and tokens, nothing
  else.
- **Import and ingest run as Temporal workflows/activities.** Never inside a request/response
  cycle, and never on a bare task queue without Temporal's retry/replay guarantees.
- **Minimize comments.** Default to none. Well-named code explains itself; a comment repeating
  what the next line already says is noise, not documentation. Add one only where the code
  genuinely cannot speak for itself — a non-obvious invariant, a concurrency/locking constraint,
  a workaround for a specific external limitation, a "why," never a "what." Where a comment is
  warranted, keep it minimal and precise: one line stating the constraint, not a paragraph. This
  applies to every language and every file in this repo, no exceptions for "just this once."
- Run everything through `uv run` — no activated virtualenvs in docs or scripts.

## Branching

`main` is protected — no direct pushes, every change lands through a PR. Name branches:

```
<type>-<developer>-<short-kebab-title>
```

`<type>` is one of:

- `feat` — a new feature or capability
- `fix` — a bug fix
- `enhancement` — an improvement to existing behavior that is neither a new feature nor a fix
- `hotfix` — an urgent fix, typically branched straight from `main`

`<developer>` is the author's name or handle. `<short-kebab-title>` is a few hyphenated words,
not a sentence. Examples: `feat-nandisha-tps-provider-registry`,
`fix-nandisha-token-refresh-race`, `hotfix-nandisha-csrf-exempt-missing`.

### Opening a PR

```
git checkout -b <type>-<developer>-<short-title>
# make the change, commit it (see Commits below)
git push -u origin <type>-<developer>-<short-title>
gh pr create   # or open the PR from the GitHub UI
```

GitHub fills the PR description from `.github/PULL_REQUEST_TEMPLATE.md` — fill in the Summary
and Test plan, don't leave the checklist unchecked without reason. `main` only accepts merges
through a PR; there is no direct-push path around this.

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
