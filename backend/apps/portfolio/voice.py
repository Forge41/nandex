"""Voice on the portfolio: a join token for a fresh room, dispatching the same LiveKit
worker the interview room uses. The dispatch metadata's `mode` is what tells that worker
it is guiding a portfolio visitor rather than interviewing a candidate."""

import json
import secrets

from apps.core.services import room_service
from apps.portfolio.config import settings

AGENT_MODE = "portfolio"


async def mint_visitor_token() -> dict:
    """Room and identity are random and server-chosen, so a visitor can neither join
    someone else's conversation nor pose as the agent."""
    room = f"portfolio-{secrets.token_hex(8)}"
    identity = f"visitor-{secrets.token_hex(8)}"
    metadata = json.dumps({"mode": AGENT_MODE, "max_minutes": settings.voice_max_minutes})
    minted = await room_service.mint_join_token(
        settings.project_id,
        room,
        identity,
        ttl_seconds=settings.voice_token_ttl_seconds,
        agents=((settings.agent_name, metadata),),
    )
    return {
        "token": minted["token"],
        "ws_url": minted["ws_url"],
        "room_name": room,
        "identity": identity,
        "expires_in": minted["expires_in"],
        "max_minutes": settings.voice_max_minutes,
    }
