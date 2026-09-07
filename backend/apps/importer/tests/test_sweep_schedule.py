"""Real end-to-end test against a real local Temporal test server -- proves
ensure_sweep_schedule is idempotent (safe to call every time the worker starts)."""

import pytest
from temporalio.testing import WorkflowEnvironment

from apps.importer.management.commands.run_importer_worker import (
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
