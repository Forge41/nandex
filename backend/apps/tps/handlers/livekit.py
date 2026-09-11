"""LiveKit realtime handler — implements the RealtimeHandler protocol.

Token minting is pure local signing: no network call, so it is safe inside a request
cycle. Only validate_credentials talks to the server.
"""

import datetime
import logging

from livekit import api

from apps.tps.catalog import IntegrationSlug
from apps.tps.config import settings
from apps.tps.handlers.base import RoomGrants, RoomToken

logger = logging.getLogger(__name__)


class LiveKitHandler:
    def get_app_name(self) -> IntegrationSlug:
        return IntegrationSlug.LIVEKIT

    def platform_config(self) -> dict:
        return {
            "host": settings.livekit_host,
            "api_key": settings.livekit_api_key,
            "api_secret": settings.livekit_api_secret,
        }

    def get_ws_url(self, config: dict) -> str:
        # The LiveKit SDKs rewrite ws->http themselves for API calls, so one stored URL
        # serves both the browser's WebSocket and our server-side Twirp calls.
        return config.get("host") or settings.livekit_host

    def mint_room_token(
        self, config: dict, *, room: str, identity: str, grants: RoomGrants
    ) -> RoomToken:
        api_key = config.get("api_key")
        api_secret = config.get("api_secret")
        if not api_key or not api_secret:
            raise ValueError("LiveKit api_key and api_secret are not configured")

        token = (
            api.AccessToken(api_key, api_secret)
            .with_identity(identity)
            .with_ttl(datetime.timedelta(seconds=grants.ttl_seconds))
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room,
                    can_publish=grants.can_publish,
                    can_subscribe=grants.can_subscribe,
                    can_publish_data=grants.can_publish,
                    hidden=grants.hidden,
                )
            )
        )

        # Explicit agent dispatch: the claim travels in the JWT, so the agent is
        # requested by the act of joining rather than by a separate server call the
        # caller could forget to make.
        if grants.agents:
            token = token.with_room_config(
                api.RoomConfiguration(
                    agents=[
                        api.RoomAgentDispatch(agent_name=agent.name, metadata=agent.metadata)
                        for agent in grants.agents
                    ]
                )
            )

        return RoomToken(
            token=token.to_jwt(),
            ws_url=self.get_ws_url(config),
            expires_in=grants.ttl_seconds,
        )

    async def validate_credentials(self, config: dict) -> bool:
        try:
            self.mint_room_token(
                config, room="__validate__", identity="__validate__", grants=RoomGrants()
            )
        except ValueError:
            return False

        client = api.LiveKitAPI(
            self.get_ws_url(config), config["api_key"], config["api_secret"]
        )
        try:
            await client.room.list_rooms(api.ListRoomsRequest())
            return True
        except Exception:
            logger.warning("LiveKit credential validation failed", exc_info=True)
            return False
        finally:
            await client.aclose()

    async def get_user_info(self, config: dict) -> dict:
        return {}
