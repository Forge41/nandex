# nandex

An open-source RAG system: connect third-party apps, import their data, and query it.

[MIT licensed](LICENSE).

Four pipeline stages — see [AGENTS.md](AGENTS.md) for the full breakdown and hard rules:

- **`tps`** — third-party connection/credential broker. Proves a connection has a valid,
  refreshable token. Owns no sync logic. **Built.**
- **`importer`** — uses a `tps` connection's token to actually pull data, tracks sync cursors,
  writes documents. Not yet built.
- **`ingest`** — normalizes, chunks, and embeds imported documents. Not yet built.
- **`retrieval`** — hybrid search (Postgres full-text + pgvector) over ingested content. Not yet
  built.
- **`chat`** — the UI tying it all together. Not yet built.

## Layout

```
frontend/          Next.js app (not yet built)
backend/
  config/           Django project (settings, urls, asgi)
  apps/
    tps/            connector catalog, encrypted connections, OAuth/credential handlers
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

make tps-migrate
```

## Running

| Command | What it does |
| --- | --- |
| `make tps` | Run the Django dev server (`tps` is currently its only app) |
| `make serve-all` | Start every backend service — today that's just `tps` |
| `make tps-migrate` | Apply pending database migrations for the `tps` app |

`make tps` defaults to port 8000; if that's taken locally, run
`cd backend && uv run manage.py runserver <port>` directly.

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
