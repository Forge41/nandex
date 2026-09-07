# nandex

An open-source RAG system: connect third-party apps, import their data, and query it.

[MIT licensed](LICENSE).

Four pipeline stages — see [AGENTS.md](AGENTS.md) for the full breakdown and hard rules:

- **`tps`** — third-party connection/credential broker. Proves a connection has a valid,
  refreshable token. Owns no sync logic. **Built.**
- **`importer`** — uses a `tps` connection's token to actually pull data, tracks sync cursors,
  writes documents. **Built** (Google Drive, orchestrated as Temporal workflows; a Temporal
  Schedule sweeps every active connection every couple of minutes, so a newly-connected app gets
  synced without anything having to trigger it directly).
- **`ingest`** — normalizes, chunks, and embeds imported documents. **Built** (parse → chunk →
  embed → index, orchestrated as Temporal workflows the same way as `importer` — its own sweep
  schedule picks up any not-yet-ingested `RawDocument`; `manage.py ingest_document`/`ingest_pending`
  still work for a manual one-off run).
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

Requires [uv](https://docs.astral.sh/uv/) and a local Postgres.

```bash
# once: create the dev role and database
psql postgres -c "CREATE ROLE ragdb LOGIN PASSWORD 'ragdb' CREATEDB;"
psql postgres -c "CREATE DATABASE ragdb OWNER ragdb;"

cp backend/.env.example backend/.env
# fill in TPS_FERNET_KEYS — generate one with:
uv run --project backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

make migrate
```

`importer`'s sync workflows and `ingest`'s ingestion workflows both run on
[Temporal](https://temporal.io) — for local dev, run a disposable dev server in its own terminal
(`brew install temporal` on macOS, then `temporal server start-dev`; the test suite doesn't need
this, it spins up its own ephemeral server per run).

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
| `make tps` | Run the Django dev server (`tps`'s HTTP API) |
| `make tps-grpc` | Run `tps`'s gRPC server (`core`/`importer` talk to `tps` only via this) |
| `make importer-worker` | Run the Temporal worker for `importer`'s sync workflows |
| `make ingest-worker` | Run the Temporal worker for `ingest`'s parse/chunk/embed workflows |
| `make asgi` | Run the whole API (`core`, marketplace, `chat`) under a real ASGI server |
| `make serve-all` | Alias for `make tps` — run `tps-grpc`/`importer-worker`/`ingest-worker` in their own terminals too |
| `make migrate` | Apply pending database migrations for every app |
| `make tps-migrate` / `importer-migrate` / `ingest-migrate` | Migrate just that one app |

`make tps` defaults to port 8000; if that's taken locally, run
`cd backend && uv run manage.py runserver <port>` directly. `importer-worker` needs a Temporal
server reachable (see Setup above) and `tps-grpc` running, since it fetches tokens through it.
Both `importer-worker` and `ingest-worker` register their own sweep schedule (`import-sweep`,
`ingest-sweep`) the first time they start, idempotently — a connection or document created while
neither worker is running just gets picked up on the next sweep once it is.

`chat`'s message endpoint streams its answer over SSE — Django's dev `runserver` (WSGI) buffers
that instead of flushing it incrementally, so use `make asgi` (`uvicorn`) whenever you're actually
testing streaming, not `make tps`. The marketplace endpoints (`core`'s gRPC calls into `tps` via
`apps.core.clients.tps_client`) need `make asgi` too, for a different reason: `tps_client` caches
one `grpc.aio` channel at module scope, and under WSGI `runserver` each request can land on a
different thread with its own event loop, breaking that cached channel with an "Event loop is
closed" 500 the moment a second request arrives on a different thread. `make tps` is fine for
`tps`'s own HTTP API and for a single one-off request, but treat `make asgi` as the default for
any real session against `core`, `chat`, or the marketplace.

## Running the frontend

```bash
cd frontend
pnpm install
cp .env.example .env    # BACKEND_ORIGIN, defaults to http://localhost:8000
pnpm dev
```

Every `/api/*` request from the browser is proxied straight to the Django backend
(`next.config.ts`'s `rewrites()`), same-origin, so the session cookie just works with no CORS
setup. Run the backend under `make asgi` (see the note above), plus `make tps-grpc` and
`make importer-worker`/`make ingest-worker` if you want a real end-to-end connect-and-sync test.

The marketplace (`GET /apps`, `GET/POST /connections`, `POST /apps/<name>/install|connect`,
`GET /oauth/callback`) and `chat` (`/chat/conversations`, `/chat/conversations/<id>/messages`)
endpoints are all under `core`'s session-cookie auth, not `tps`'s `X-TPS-Secret` header — log in
via `POST /auth/login` + `/auth/verify` first (see `apps/core/tests/test_marketplace_api.py` for
a working example against a mocked `tps_client`).

For a one-off manual run outside its Temporal worker, `ingest` can still be invoked directly
against one `RawDocument` with `cd backend && uv run manage.py ingest_document <raw_document_id>`,
or every not-yet-ingested one with `manage.py ingest_pending`.

`GET /auth/session` returns the logged-in user and their current workspace (401 if not
authenticated) — the cheap "am I logged in" check a frontend makes on page load, before hitting
anything else under `core`'s session-cookie auth.

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
