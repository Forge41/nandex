# nandex

An open-source RAG system: connect third-party apps, import their data, and query it.

[MIT licensed](LICENSE).

Four pipeline stages — see [AGENTS.md](AGENTS.md) for the full breakdown and hard rules:

- **`tps`** — third-party connection/credential broker. Proves a connection has a valid,
  refreshable token. Owns no sync logic. **Built.**
- **`importer`** — uses a `tps` connection's token to actually pull data, tracks sync cursors,
  writes documents. **Built** (Google Drive, orchestrated as Temporal workflows).
- **`ingest`** — normalizes, chunks, and embeds imported documents. **Pipeline built**
  (parse → chunk → embed → index, runnable via `manage.py ingest_document`); Temporal
  orchestration for it is not yet built.
- **`retrieval`** — hybrid search (Postgres full-text + pgvector), fused with Reciprocal Rank
  Fusion and reranked with a free cross-encoder. **Built** — a plain Python function today, no
  HTTP layer yet.
- **`chat`** — the UI tying it all together. Not yet built.

## Layout

```
frontend/          Next.js app (not yet built)
backend/
  config/           Django project (settings, urls, asgi)
  apps/
    tps/            connector catalog, encrypted connections, OAuth/credential handlers
    importer/       Temporal-orchestrated sync; owns the immutable RawDocument
    ingest/         parse -> chunk -> embed -> index pipeline (not yet Temporal-orchestrated)
    retrieval/      hybrid search (pgvector + Postgres FTS) -> RRF fusion -> rerank
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

`importer`'s sync workflows and `ingest`'s future orchestration both run on
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

## Running

| Command | What it does |
| --- | --- |
| `make tps` | Run the Django dev server (`tps`'s HTTP API) |
| `make tps-grpc` | Run `tps`'s gRPC server (`core`/`importer` talk to `tps` only via this) |
| `make importer-worker` | Run the Temporal worker for `importer`'s sync workflows |
| `make serve-all` | Alias for `make tps` — run `tps-grpc`/`importer-worker` in their own terminals too |
| `make migrate` | Apply pending database migrations for every app |
| `make tps-migrate` / `importer-migrate` / `ingest-migrate` | Migrate just that one app |

`make tps` defaults to port 8000; if that's taken locally, run
`cd backend && uv run manage.py runserver <port>` directly. `importer-worker` needs a Temporal
server reachable (see Setup above) and `tps-grpc` running, since it fetches tokens through it.

`ingest` has no Temporal worker yet (see its entry above) — run it directly against one
`RawDocument` with `cd backend && uv run manage.py ingest_document <raw_document_id>`, or sweep
every not-yet-ingested one with `manage.py ingest_pending`.

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
