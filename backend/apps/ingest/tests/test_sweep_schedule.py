"""Real end-to-end test against a real local Temporal test server -- proves
ensure_sweep_schedule is idempotent (safe to call every time the worker starts)."""

import asyncio

import pytest
from temporalio.testing import WorkflowEnvironment

from apps.ingest.management.commands.run_ingest_worker import (
    SWEEP_SCHEDULE_ID,
    ensure_sweep_schedule,
)


@pytest.fixture
async def temporal_env():
    env = await WorkflowEnvironment.start_local()
    yield env
    await env.shutdown()


async def test_ensure_sweep_schedule_is_idempotent(temporal_env):
    await ensure_sweep_schedule(temporal_env.client)
    await ensure_sweep_schedule(temporal_env.client)

    matching = [
        s async for s in await temporal_env.client.list_schedules() if s.id == SWEEP_SCHEDULE_ID
    ]
    assert len(matching) == 1


async def test_ensure_sweep_schedule_survives_a_concurrent_race(temporal_env):
    """list_schedules() is only eventually consistent -- two callers racing (e.g. a worker
    restarting while another instance's list hasn't yet caught up) can both miss a schedule
    that already exists and both attempt to create it. The loser must not raise."""
    await asyncio.gather(
        ensure_sweep_schedule(temporal_env.client),
        ensure_sweep_schedule(temporal_env.client),
    )

    matching = [
        s async for s in await temporal_env.client.list_schedules() if s.id == SWEEP_SCHEDULE_ID
    ]
    assert len(matching) == 1
