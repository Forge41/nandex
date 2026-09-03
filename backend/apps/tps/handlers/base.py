"""Handler protocols, split by auth type.

Every provider implements one of these two protocols (never both) depending on which
auth flow its connector uses.
"""

from typing import Protocol, runtime_checkable


@runtime_checkable
class AppHandler(Protocol):
    """Base protocol — every handler implements these two."""

    def get_app_name(self) -> str:
        """The app slug, e.g. 'github'."""
        ...

    async def get_user_info(self, config: dict) -> dict:
        """Fetch the authenticated user's profile. Return {} if the provider has none."""
        ...


@runtime_checkable
class OAuthHandler(AppHandler, Protocol):
    """OAuth2 / form-based-OAuth2 providers: install -> redirect -> callback -> exchange."""

    def get_authorize_url(
        self, redirect_uri: str, form_data: dict | None = None
    ) -> tuple[str, str]:
        """Return (authorize_url, state) for the OAuth redirect.

        form_data carries extra fields a form-based-OAuth2 provider needs (e.g. tenant URL).
        """
        ...

    async def exchange_code(
        self, code: str, redirect_uri: str, form_data: dict | None = None
    ) -> dict:
        """Exchange an authorization code for tokens. Returns the config dict to encrypt."""
        ...

    async def refresh_token(self, config: dict) -> dict:
        """Refresh an expired token. Returns the updated config dict."""
        ...

    def is_token_expired(self, config: dict) -> bool: ...

    async def revoke_token(self, config: dict) -> None:
        """Revoke the token at the provider. Best-effort — must never raise."""
        ...


@runtime_checkable
class CredentialHandler(AppHandler, Protocol):
    """API-key / basic-auth / mTLS providers: connect -> validate -> store."""

    async def validate_credentials(self, config: dict) -> bool:
        """Test whether the given credentials actually work."""
        ...
