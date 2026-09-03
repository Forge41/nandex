---
name: expertise_tps
description: Architecture map and invariants for backend/apps/tps, the third-party connection/credential broker. Read before any change to this app.
---

# tps architecture

`tps` is modeled on (not copied from) `Forge41/genalphacli`'s `services/tps` — a credential
broker, not a sync engine. It proves a `Connection` has a valid, refreshable token and stops
there. See `.claude/plans/docs/architecture/repo-structure.md` (local planning doc, not shared
via git — may not exist on every machine) for how it fits into the full
`tps → importer → ingest → retrieval → chat` chain — `importer` (not yet built) is the app that
will actually use a connection's token to pull data.

## File map

| File | Role |
| --- | --- |
| `models.py` | `Connector` (catalog: one row per provider) and `Connection` (one row per user's credential for a provider). `AuthType`, `AppCategory`, `AppProvider`, `Connection.Status` are all Django `IntegerChoices`/`TextChoices` — never a bare string constant. |
| `config.py` | tps-only settings (Fernet keys, `TPS_TPS_SECRET`, per-provider OAuth creds), separate from Django's `config/settings.py`. Pydantic `BaseSettings`, env prefix `TPS_`. |
| `crypto.py` | `MultiFernet` encrypt/decrypt for `Connection.config_encrypted`. First key in `TPS_FERNET_KEYS` (comma-separated) encrypts; all keys are tried on decrypt, so key rotation doesn't break old rows. |
| `deps.py` | `require_tps_secret` / `require_user_id` — plain functions raising `TpsError`, checked at the top of every view. No FastAPI-style `Depends()` equivalent exists in Django, so this is deliberately simple. |
| `handlers/base.py` | `AppHandler` / `OAuthHandler` / `CredentialHandler` — `Protocol` classes, `runtime_checkable`. Every provider implements exactly one of `OAuthHandler` or `CredentialHandler`, never both. |
| `handlers/__init__.py` | `HANDLER_REGISTRY: dict[str, type]`, keyed by `app_name`. Empty until a real connector ships — do not add placeholder/example handlers. |
| `connection_service.py` | `get_or_refresh`, `create_connection`, `delete_connection`. See the concurrency note below before touching this file. |
| `api/errors.py` | `tps_view` decorator: catches `TpsError`/`ValueError`/`Exception` → JSON response, and applies `csrf_exempt`. Every tps view must use this decorator. |
| `api/apps_api.py`, `api/integrations_api.py` | The HTTP layer — thin, delegates to `connection_service` and `handlers`. |
| `urls.py` | Note `connection_detail` handles both GET and DELETE on the same path shape (`integrations/<id>`) via `request.method` — Django dispatches by URL pattern, not verb, so these can't be two separate `path()` entries. |

## Invariants (with why)

- **tps never writes `RawDocument` and has no cursor/sync state.** That's `apps.importer`'s job
  once it exists. Mixing them back into `tps` breaks the leaf-module dependency rule in
  `AGENTS.md`.
- **CSRF is exempted, deliberately, only via `tps_view`.** Every tps endpoint authenticates via
  the `X-TPS-Secret` header, not a session cookie, so Django's cookie-based CSRF protection is
  the wrong tool here — but exemption belongs in one shared decorator, not scattered
  `@csrf_exempt` on individual views.
- **Token refresh lock scope is intentionally narrow, not a full mutex.** In
  `connection_service.py`, `_read_and_maybe_flag_refresh` takes `select_for_update()`, but that
  lock is released before `handler.refresh_token(config)` is awaited (Django's ORM is
  synchronous; you can't hold a lock across an `await` to an async httpx call inside one
  transaction the way the FastAPI/SQLAlchemy reference does). `_write_refreshed_config`
  re-acquires the lock and writes unconditionally — it does not re-check expiry, so a rare
  double-refresh under real concurrency is a known, accepted gap, not a bug to silently "fix"
  by adding more locking without discussing the tradeoff first.
- **`identifier` on `Connection` is `blank=True, default=""`, not `null=True`.** Ruff's `DJ001`
  rule flags `null=True` on `CharField` — two representations of "empty" (`None` and `""`) is
  the thing being avoided. Coerce `None` to `""` at the point of assignment, don't add `null=True`
  back to make a `None` fit.

## Local dev setup

Postgres, via `uv`-managed Django — never a bare `python`/activated venv:

```bash
psql postgres -c "CREATE ROLE ragdb LOGIN PASSWORD 'ragdb' CREATEDB;"   # once, if the role doesn't exist
psql postgres -c "CREATE DATABASE ragdb OWNER ragdb;"                    # once
cd backend
uv run manage.py migrate
```

`TPS_FERNET_KEYS` must be set before any encrypt/decrypt call works:

```bash
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

See `backend/.env.example` for every env var tps reads.

## Smoke-testing a change

Run the dev server, then hit endpoints with the required headers — every tps route needs
`X-TPS-Secret`, and every `/integrations/*` route also needs `X-User-ID`:

```bash
cd backend && uv run manage.py runserver 8010 &
curl -s -H "X-TPS-Secret: <TPS_TPS_SECRET value>" http://localhost:8010/apps
curl -s -X POST -H "X-TPS-Secret: <...>" -H "Content-Type: application/json" \
  -d '{"state":"s1","redirect_uri":"http://localhost:3000/cb"}' \
  http://localhost:8010/integrations/<app_name>/install
```

Check both a success path and at least one error path (missing header → 400/403, unknown app →
404, wrong auth flow → 400) — the existing views all have these branches; a change that breaks
one of them silently is the most common regression here.
