"""The same worker, dispatched onto the portfolio: a voice guide that answers as Nandisha
from the portfolio's own retrieval, instead of an interviewer reading a candidate's plan.

No transcript is saved here -- core logs each lookup, which is what the portfolio keeps.
"""

import asyncio
import logging

from livekit.agents import Agent, JobContext, function_tool

from interviewer import core_client, voice
from interviewer.briefing import load_prompt
from interviewer.dispatch import Dispatch

logger = logging.getLogger("interviewer.portfolio")


def format_passages(passages: list[dict]) -> str:
    if not passages:
        return "Nothing in the portfolio matches that."
    return "\n\n".join(f"{p.get('title', '')}: {p.get('content', '')}" for p in passages)


class PortfolioGuide(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=load_prompt("portfolio_guide.md"))

    @function_tool
    async def search_portfolio(self, question: str) -> str:
        """Look up Nandisha's resume and projects. Call this before answering any question
        about experience, projects, skills, education or availability.

        Args:
            question: The visitor's question, in their own words.
        """
        return format_passages(await core_client.portfolio_passages(question))


async def run(ctx: JobContext, dispatch: Dispatch) -> None:
    modality = voice.available()
    if not modality.voice:
        logger.warning("Portfolio guide in %s", modality.describe())
    session = voice.build_session(ctx.proc.userdata["vad"], modality)

    room_input, room_output = voice.room_options(modality)
    await session.start(
        agent=PortfolioGuide(),
        room=ctx.room,
        room_input_options=room_input,
        room_output_options=room_output,
    )
    await session.generate_reply(
        instructions="Say hello in one short sentence and invite a question."
    )

    # A public page: the room ends on a timer so an open tab can't run up speech bills.
    await asyncio.sleep(dispatch.max_minutes * 60)
    await session.generate_reply(
        instructions="Say, in one sentence, that you have to go, and that they can keep typing in the terminal."
    )
    # Deleting the room disconnects the visitor too, which is what tells the page the
    # conversation is over.
    await ctx.delete_room()
