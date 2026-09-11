"""Handler protocols, split by auth type.

Every provider implements exactly one of OAuthHandler / CredentialHandler depending on
which auth flow its connector uses. RealtimeHandler narrows CredentialHandler further:
same auth flow, plus the ability to mint a room token.
"""

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from apps.tps.catalog import IntegrationSlug


@runtime_checkable
class AppHandler(Protocol):
    """Base protocol — every handler implements these two."""

    def get_app_name(self) -> IntegrationSlug:
        """The app slug, e.g. IntegrationSlug.GOOGLE_DRIVE."""
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


@dataclass(frozen=True)
class AgentDispatch:
    """An automation to pull into the room when the token's holder joins."""

    name: str
    metadata: str = ""


@dataclass(frozen=True)
class RoomGrants:
    """What one identity may do in one room. Provider-neutral on purpose: tps must not
    learn what the room is for, only what the holder is allowed to do in it."""

    can_publish: bool = True
    can_subscribe: bool = True
    hidden: bool = False
    ttl_seconds: int = 900
    agents: tuple[AgentDispatch, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class RoomToken:
    token: str
    ws_url: str
    expires_in: int


@runtime_checkable
class RealtimeHandler(CredentialHandler, Protocol):
    """Providers that host live audio/video rooms. Credentials validate like any other
    API-key connector; the extra capability is minting a short-lived, scoped join token
    for one identity in one room.
    """

    def platform_config(self) -> dict:
        """The platform-level credentials from tps settings, in this provider's own key
        names. Used when a project has no Connection of its own."""
        ...

    def mint_room_token(
        self, config: dict, *, room: str, identity: str, grants: RoomGrants
    ) -> RoomToken: ...

    def get_ws_url(self, config: dict) -> str: ...
