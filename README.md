# nandex

An open-source RAG system: connect third-party apps, import their data, and query it.

[MIT licensed](LICENSE).

Four pipeline stages — see [AGENTS.md](AGENTS.md) for the full breakdown and hard rules:

- **`tps`** — third-party connection/credential broker. Proves a connection has a valid,
  refreshable token. Owns no sync logic. **Built.**
- **`importer`** — uses a `tps` connection's token to actually pull data, tracks sync cursors,
  writes documents; also owns direct document uploads (`POST /documents/upload`), since it's the
  only app allowed to write a `RawDocument`, connector-synced or not. **Built** (Google Drive,
  orchestrated as Temporal workflows). A sync starts the moment an app is connected — `core`
  starts `ImportInitiatorWorkflow` by name right after a successful connect, scoped to just that
  one connection — and nothing runs on any recurring schedule.
- **`ingest`** — normalizes, chunks, and embeds imported documents. **Built** (parse → chunk →
  embed → index, orchestrated as Temporal workflows the same way as `importer`). A document is
  ingested the instant it's written — a direct upload and a connector sync both start
  `IngesterWorkflow` by name right after creating the `RawDocument`, no polling involved;
  `manage.py ingest_document`/`ingest_pending` still work for a manual one-off run, and
  `IngestInitiatorWorkflow`/`ImportInitiatorWorkflow` remain manually startable full backfills
  for an ops/recovery scenario, just never on an automatic timer.
- **`retrieval`** — hybrid search (Postgres full-text + pgvector), fused with Reciprocal Rank
  Fusion and reranked with a free cross-encoder. **Built** — a plain Python function today, no
  HTTP layer yet.
- **`chat`** — ties `retrieval` to an LLM to generate a streamed, cited answer. **Built**
  (`Conversation`/`Message` models, a streaming REST API, sources attached as structured
  citations rather than parsed from the model's own text; a Next.js chat UI streams the answer
  live).

`backend/ai/` is a small, Django-free layer wrapping the Anthropic SDK (client, model registry,
prompts as `.md` files) that `chat` calls into — not one of the four pipeline stages itself.

A Next.js frontend (`frontend/`) covers the chat UI and an integrations marketplace for
connecting apps — see [Running the frontend](#running-the-frontend) below.

## Layout

```
frontend/          Next.js app: chat UI + integrations marketplace
backend/
  config/           Django project (settings, urls, asgi)
  ai/               Anthropic client, model registry, prompts as .md files -- no Django import
  apps/
    tps/            connector catalog, encrypted connections, OAuth/credential handlers
    importer/       Temporal-orchestrated sync; owns the immutable RawDocument
    ingest/         parse -> chunk -> embed -> index pipeline, Temporal-orchestrated
    retrieval/      hybrid search (pgvector + Postgres FTS) -> RRF fusion -> rerank
    chat/           Conversation/Message models; streams an ai/-generated, cited answer
```

## Setup

Requires [uv](https://docs.astral.sh/uv/), a local Postgres, and — for the frontend —
[pnpm](https://pnpm.io) with Node 22+.

```bash
# once: create the dev role and database
psql postgres -c "CREATE ROLE ragdb LOGIN PASSWORD 'ragdb' CREATEDB;"
psql postgres -c "CREATE DATABASE ragdb OWNER ragdb;"

cp backend/.env.example backend/.env
# fill in TPS_FERNET_KEYS — generate one with:
uv run --project backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

make migrate

# once: frontend dependencies + env (defaults are enough for local dev)
cd frontend && pnpm install && cp .env.example .env && cd ..
```

`importer`'s sync workflows and `ingest`'s ingestion workflows both run on
[Temporal](https://temporal.io) — install the CLI once (`brew install temporal` on macOS; the
test suite doesn't need this, it spins up its own ephemeral server per run). `make serve-all`
starts a disposable dev server itself; running `make importer-worker`/`make ingest-worker` on
their own still expects one already running in its own terminal (`temporal server start-dev`).

`apps.ingest`'s migration runs `CREATE EXTENSION vector`, so Postgres itself needs the
`pgvector` extension installed at the OS/package level (a separate step from the `pgvector`
Python package, which is just a Django field type):

```bash
brew install pgvector   # macOS; see https://github.com/pgvector/pgvector#installation for others
```

The role creating the extension needs `CREATEROLE`/superuser-equivalent privilege for that one
statement — for local dev, the simplest fix is `psql postgres -c "ALTER ROLE ragdb SUPERUSER;"`
(CI's Postgres container already runs as a superuser by default, so no extra step is needed
there).

`chat` needs a real `AI_ANTHROPIC_API_KEY` in your `.env` to generate answers — everything else
(retrieval, citations, persistence) works without one, but `ai.client.stream_answer` will fail
without a valid key.

## Running

| Command | What it does |
| --- | --- |
| `make up` | Everything, from nothing: containers, migrations, then every service |
| `make down` | Stop the containers `up` started (Ctrl-C already stopped the processes) |
| `make doctor` | Say what `backend/.env` is missing, and what stops working without it |
| `make serve-all` | Every service, assuming containers and migrations are already done |
| `make asgi` | Run just the backend, under a real ASGI server (needed for `core`/`chat`/marketplace to work) |
| `make tps` | Run the Django dev server under WSGI — only reliable for `tps`'s own HTTP API, see below |
| `make tps-grpc` | Run `tps`'s gRPC server (`core`/`importer` talk to `tps` only via this) |
| `make importer-worker` | Run the Temporal worker for `importer`'s sync workflows |
| `make ingest-worker` | Run the Temporal worker for `ingest`'s parse/chunk/embed workflows |
| `make interview-worker` | Run the Temporal worker that reads a resume and writes the interview plan |
| `make interviewer-agent` | Run the LiveKit agent that joins the room and talks to the candidate |
| `make vas-stack` | Start the containers `vas` needs: LiveKit, Egress, fake-GCS, Redis |
| `make frontend` | Run the Next.js dev server (proxies `/api/*` to the backend) |
| `make migrate` | Apply pending database migrations for every app |
| `make tps-migrate` / `importer-migrate` / `ingest-migrate` | Migrate just that one app |

`make up` is the cold-start command: it reports what your `.env` is missing, brings up the
containers (LiveKit, Egress, fake-GCS, Redis) and creates the recordings bucket, applies every
migration, and then hands over to `serve-all`. Run it the first time, after pulling a change that
adds a migration, or any time the containers are down. Day to day, `make serve-all` is the one you
want — the prerequisites are already in place and it starts in seconds.

`make serve-all` (`scripts/dev_serve.sh`) is genuinely a one-command "run everything": it starts
a local Temporal dev server itself (reusing one that's already running instead of erroring),
starts every application process, and tears the whole group down together — on Ctrl-C, or the
moment any single one of them exits on its own, so a crashed worker can't silently leave the rest
running half-broken. It does still need a local Postgres already running (see Setup above), and
`frontend/.env`/`frontend/node_modules` already set up (`cd frontend && pnpm install && cp
.env.example .env` once — see [Running the frontend](#running-the-frontend) below) — it checks
for both up front and fails with a clear message rather than a stack trace if either is missing.
For working on one piece at a time, run its target (`make asgi`, `make tps-grpc`, etc.) in its
own terminal instead.

`importer-worker` needs a Temporal server reachable and `tps-grpc` running, since it fetches
tokens through it. Neither worker registers a schedule of any kind — `importer-worker` needs to
be up when a connection is created (so it can pick up the immediate sync trigger), and
`ingest-worker` needs to be up when a document is written or uploaded, for the same reason.

`chat`'s message endpoint streams its answer over SSE — Django's dev `runserver` (WSGI) buffers
that instead of flushing it incrementally, so use `make asgi` (`uvicorn`) whenever you're actually
testing streaming, not `make tps`. The marketplace endpoints (`core`'s gRPC calls into `tps` via
`apps.core.clients.tps_client`) need `make asgi` too, for a different reason: `tps_client` caches
one `grpc.aio` channel at module scope, and under WSGI `runserver` each request can land on a
different thread with its own event loop, breaking that cached channel with an "Event loop is
closed" 500 the moment a second request arrives on a different thread. `make tps` is fine for
`tps`'s own HTTP API and for a single one-off request, but treat `make asgi` (or `make serve-all`,
which already uses it) as the default for any real session against `core`, `chat`, or the
marketplace.

## Running the frontend

Once Setup's one-time `pnpm install`/`cp .env.example .env` is done, `make frontend` (or
`make serve-all` for the whole stack) runs it — or `cd frontend && pnpm dev` directly.

Every `/api/*` request from the browser is proxied straight to the Django backend
(`next.config.ts`'s `rewrites()`), same-origin, so the session cookie just works with no CORS
setup. Run the backend under `make asgi` (see the note above), plus `make tps-grpc` and
`make importer-worker`/`make ingest-worker` if you want a real end-to-end connect-and-sync test —
or just `make serve-all` for all of it together.

The marketplace (`GET /apps`, `GET/POST /connections`, `POST /apps/<name>/install|connect`,
`GET /oauth/callback`), `chat` (`/chat/conversations`, `/chat/conversations/<id>/messages`), and
document upload (`POST /documents/upload`, `GET /documents/<id>/ingest-status`) endpoints are all
under `core`'s session-cookie auth, not `tps`'s `X-TPS-Secret` header. **There is no login** —
`AutoProvisionAnonymousUserMiddleware` (`apps/core/middleware.py`) transparently creates a
`User`/`Workspace`/`Project` for any request with no session cookie yet and logs it in, so a
session cookie alone is what makes a visitor "the same person" on a return visit (a year-long,
sliding-expiry cookie — see `config/settings.py`'s `SESSION_COOKIE_AGE`). The magic-link flow
(`POST /auth/login` + `/auth/verify`) still exists and is still tested, just unused by the
frontend — nothing currently links to it.

For a one-off manual run outside its Temporal worker, `ingest` can still be invoked directly
against one `RawDocument` with `cd backend && uv run manage.py ingest_document <raw_document_id>`,
or every not-yet-ingested one with `manage.py ingest_pending`.

`POST /documents/upload` (multipart, `project_id` + `file`) lets a user add a document directly
without connecting any third-party app — it creates a `RawDocument` the same way a connector sync
would (`connection_id="upload"`, plus a `project_id` connector-synced rows don't have, so
`apps.chat.scoping` can resolve it without a real `Connection`). It then starts `ingest`'s
`IngesterWorkflow` immediately — by its registered name as a plain string, the same
never-import-across-the-boundary convention as every other cross-app reference in this codebase
(`connection_id`, `raw_document_id`, ...), so `importer` never imports `apps.ingest`. A connector
sync (`apps.importer.sync.activities.write_raw_documents_activity`) triggers the same way for
every document it writes, and `core` triggers `ImportInitiatorWorkflow` the same way right after
a connection is created — nothing in this pipeline runs on a recurring schedule; if an immediate
trigger fails for any reason (Temporal briefly unreachable, etc.), it's logged and there's no
automatic retry today. `GET /documents/<id>/ingest-status` lets a frontend poll for "pending" →
"completed"/"failed" instead of blindly waiting. Accepted content types mirror
`apps.ingest.pipeline.parsers.PARSER_REGISTRY`
exactly (PDF, DOCX, XLSX, PPTX, plain text, Markdown, CSV); size is capped by
`IMPORTER_MAX_UPLOAD_BYTES` (default 20MB).

`GET /auth/session` returns the current user and workspace — always 200 now that every request
auto-provisions one, never 401. It's still the cheap "who is this" check a frontend makes on page
load, just no longer a login gate.

`retrieval` still has no HTTP endpoint of its own — it's a plain Python function,
`apps.retrieval.search.search(query, raw_document_ids, top_k)`, that `apps.chat.service.ask`
now calls in-process for every message.

Every `tps` endpoint requires an `X-TPS-Secret` header (`TPS_TPS_SECRET` in your `.env`), and
`/integrations/*` routes also require `X-User-ID`:

```bash
curl -H "X-TPS-Secret: <value>" http://localhost:8000/apps
```

## Contributing

Read [AGENTS.md](AGENTS.md) first — it's the canonical source for this repo's hard rules
(module boundaries, comment discipline, branch naming, commit conventions) and is read directly
by Codex and Cursor, imported by Claude Code via `CLAUDE.md`. Procedural how-tos live under
`.agents/skills/`.

`main` is protected: every change goes through a PR from a branch named
`<type>-<developer>-<short-title>` (`feat`/`fix`/`enhancement`/`hotfix`) — see AGENTS.md's
Branching section for the full convention.

## License

[MIT](LICENSE) — see the LICENSE file for the full text.
