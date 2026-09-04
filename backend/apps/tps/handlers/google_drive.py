"""Google Drive OAuth handler — implements the OAuthHandler protocol.

Requests offline access + forces consent on every authorize call: Google only reliably
reissues a refresh token on the first grant, so skipping prompt=consent means a
re-authorizing user can silently end up with no refresh token at all.
"""

import logging
import secrets
import time
from urllib.parse import urlencode

import httpx

from apps.tps.config import settings

logger = logging.getLogger(__name__)


class GoogleDriveHandler:
    AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
    REVOKE_URL = "https://oauth2.googleapis.com/revoke"

    def get_app_name(self) -> str:
        return "google_drive"

    def get_authorize_url(
        self, redirect_uri: str, form_data: dict | None = None
    ) -> tuple[str, str]:
        # secrets.token_urlsafe's alphabet needs no escaping, so the state substring
        # tps's install endpoint swaps in for the caller's own state stays a plain match.
        state = secrets.token_urlsafe(32)
        query = urlencode(
            {
                "client_id": settings.google_drive_client_id,
                "redirect_uri": redirect_uri,
                "scope": settings.google_drive_scopes,
                "response_type": "code",
                "access_type": "offline",
                "prompt": "consent",
                "state": state,
            }
        )
        return f"{self.AUTHORIZE_URL}?{query}", state

    async def exchange_code(
        self, code: str, redirect_uri: str, form_data: dict | None = None
    ) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": settings.google_drive_client_id,
                    "client_secret": settings.google_drive_client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            # Google's token errors (invalid_grant, etc.) come back as a 400 with a JSON
            # body worth surfacing — check that before raise_for_status would swallow it.
            data = response.json()
            if "error" in data:
                raise ValueError(
                    f"Google OAuth error: {data.get('error_description', data['error'])}"
                )
            response.raise_for_status()

            if "refresh_token" not in data:
                logger.warning(
                    "Google exchange returned no refresh_token — access_type=offline and "
                    "prompt=consent should always produce one on first consent"
                )

            return {
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token", ""),
                "token_type": data.get("token_type", "Bearer"),
                "scope": data.get("scope", ""),
                "expires_at": time.time() + data.get("expires_in", 3600),
            }

    async def refresh_token(self, config: dict) -> dict:
        refresh_token = config.get("refresh_token")
        if not refresh_token:
            raise ValueError("No refresh_token stored for this connection — user must reconnect")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": settings.google_drive_client_id,
                    "client_secret": settings.google_drive_client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            data = response.json()
            if "error" in data:
                raise ValueError(
                    f"Google refresh error: {data.get('error_description', data['error'])}"
                )
            response.raise_for_status()

            return {
                **config,
                "access_token": data["access_token"],
                # Google only returns a new refresh_token if the old one was rotated —
                # keep the existing one otherwise.
                "refresh_token": data.get("refresh_token", refresh_token),
                "expires_at": time.time() + data.get("expires_in", 3600),
            }

    def is_token_expired(self, config: dict) -> bool:
        expires_at = config.get("expires_at")
        return not expires_at or time.time() >= expires_at

    async def revoke_token(self, config: dict) -> None:
        access_token = config.get("access_token")
        if not access_token:
            return
        try:
            async with httpx.AsyncClient() as client:
                await client.post(self.REVOKE_URL, data={"token": access_token}, timeout=5.0)
        except (httpx.HTTPError, httpx.TimeoutException):
            logger.warning("Failed to revoke Google token — continuing with local cleanup")

    async def get_user_info(self, config: dict) -> dict:
        access_token = config["access_token"]
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            info = response.json()
            return {
                "id": info.get("sub"),
                "email": info.get("email"),
                "name": info.get("name"),
            }
