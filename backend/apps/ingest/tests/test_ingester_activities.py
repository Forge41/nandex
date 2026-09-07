import pytest

from apps.ingest.ingester import activities as activities_module
from apps.ingest.ingester.activities import ingest_document_activity
from apps.ingest.models import IngestRun
from apps.ingest.pipeline.run import IngestAlreadyInFlightError


class _FakeRun:
    status = IngestRun.Status.COMPLETED


@pytest.mark.asyncio
async def test_returns_run_status(monkeypatch):
    monkeypatch.setattr(
        activities_module, "ingest_raw_document", lambda raw_document_id: _FakeRun()
    )

    status = await ingest_document_activity("doc-1")

    assert status == IngestRun.Status.COMPLETED


@pytest.mark.asyncio
async def test_already_in_flight_is_not_a_failure(monkeypatch):
    def _raise(raw_document_id):
        raise IngestAlreadyInFlightError(raw_document_id)

    monkeypatch.setattr(activities_module, "ingest_raw_document", _raise)

    status = await ingest_document_activity("doc-1")

    assert status == "already_in_flight"
