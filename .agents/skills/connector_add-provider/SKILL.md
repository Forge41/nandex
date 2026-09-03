---
name: connector_add-provider
description: Steps to add a new third-party provider handler to backend/apps/tps — OAuth or credential flow, catalog seed migration, config, and verification.
---

# Adding a tps provider

Read `.agents/skills/expertise_tps/SKILL.md` first for the file map and invariants this
checklist assumes. Every step below happens inside `backend/apps/tps/`.

## 1. Pick the protocol

Decide which of the two `handlers/base.py` protocols the provider implements — never both:

- **`OAuthHandler`** — the provider uses a browser redirect flow (install → redirect → callback
  → exchange). Implement `get_authorize_url`, `exchange_code`, `refresh_token`,
  `is_token_expired`, `revoke_token`, plus the shared `get_app_name`/`get_user_info`.
- **`CredentialHandler`** — the provider uses API key / basic auth / mTLS (connect → validate →
  store). Implement `validate_credentials`, plus `get_app_name`/`get_user_info`.

If the provider genuinely needs both (rare), that's two separate `Connector` catalog rows with
two different `app_name`s, not one handler implementing both protocols.

## 2. Write `handlers/<app_name>.py`

One file per provider, `app_name` matching the catalog slug (e.g. `handlers/notion.py` for
`app_name="notion"`). Use `httpx.AsyncClient` for outbound calls — every handler method the
protocol defines as `async def` must actually be async; `connection_service.py` awaits them
directly. Add `httpx` back to `backend/pyproject.toml` via `uv add httpx` if it isn't already a
dependency (it was deliberately removed when the last example handler was removed — don't leave
it as dead weight if you're only stubbing, add it when you write the real handler).

## 3. Register it

Add one line to `HANDLER_REGISTRY` in `handlers/__init__.py`:

```python
HANDLER_REGISTRY: dict[str, type] = {
    "notion": NotionHandler,
}
```

## 4. Seed the catalog

Write a migration (`uv run manage.py makemigrations tps --empty --name seed_<app_name>_connector`)
with a `RunPython` operation that `get_or_create`s a `Connector` row — `app_code` (next unused
integer), `app_name`, `display_name`, `auth_type` (`AuthType.OAUTH2` etc.), `category`,
`meta` (icon/description/keywords, and `form_fields` if it's a `CredentialHandler`),
`is_install_required` (`True` for OAuth, `False` for credential flow). Include the matching
`unseed_<app_name>` reverse function. Do not hand-write raw SQL — Django's ORM inside
`RunPython` is the existing convention (see git history before the mock GitHub example was
removed, or just follow the pattern in `0001_initial.py`'s model definitions).

## 5. Add config

If the provider needs OAuth client credentials, add fields to `Settings` in `config.py`
(`<provider>_client_id`, `<provider>_client_secret`, etc. — `TPS_` prefixed via
`model_config`), and document them in `backend/.env.example`.

## 6. Verify

1. `uv run --project backend manage.py makemigrations tps` — should show no further changes.
2. `uv run --project backend manage.py migrate`.
3. `uvx ruff check backend/ --config ruff.toml && uvx ruff format --check backend/ --config ruff.toml`.
4. Smoke-test per `expertise_tps/SKILL.md`'s curl pattern: list the new connector in `GET /apps`,
   run `/install` (OAuth) or `/connect` (credential) against it. A real OAuth exchange needs live
   provider credentials — at minimum verify the authorize-URL/validation logic that doesn't
   require a live round trip.
