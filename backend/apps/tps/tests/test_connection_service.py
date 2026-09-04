import time

import pytest

from apps.tps.connection_service import (
    create_connection,
    delete_connection,
    get_or_refresh,
    mark_reauth_required,
)
from apps.tps.models import Connection


@pytest.mark.django_db(transaction=True)
async def test_create_connection_upserts_rather_than_duplicates(stub_connector):
    first = await create_connection("proj1", "stubapp", {"access_token": "a"}, identifier="u1")
    second = await create_connection("proj1", "stubapp", {"access_token": "b"}, identifier="u1")

    assert first.id == second.id
    assert await Connection.objects.filter(project_id="proj1", app_name="stubapp").acount() == 1


@pytest.mark.django_db(transaction=True)
async def test_get_or_refresh_skips_refresh_when_not_expiring(stub_connector, stub_handler):
    connection = await create_connection(
        "proj1", "stubapp", {"access_token": "a"}, expires_at=time.time() + 3600
    )

    config = await get_or_refresh(connection.id, "proj1")

    assert config["access_token"] == "a"
    assert stub_handler.refresh_calls == 0


@pytest.mark.django_db(transaction=True)
async def test_get_or_refresh_refreshes_when_expiring_soon(stub_connector, stub_handler):
    connection = await create_connection(
        "proj1", "stubapp", {"access_token": "a"}, expires_at=time.time() + 10
    )

    config = await get_or_refresh(connection.id, "proj1")

    assert config["access_token"] == "refreshed-token"
    assert stub_handler.refresh_calls == 1

    reloaded = await Connection.objects.aget(id=connection.id)
    assert reloaded.expires_at == config["expires_at"]


@pytest.mark.django_db(transaction=True)
async def test_get_or_refresh_unknown_connection_raises(stub_connector):
    with pytest.raises(ValueError):
        await get_or_refresh("does-not-exist", "proj1")


@pytest.mark.django_db(transaction=True)
async def test_delete_connection_revokes_and_wipes_config(stub_connector):
    connection = await create_connection("proj1", "stubapp", {"access_token": "a"})

    deleted = await delete_connection(connection.id, "proj1")

    assert deleted is True
    reloaded = await Connection.objects.aget(id=connection.id)
    assert reloaded.status == Connection.Status.REVOKED


@pytest.mark.django_db(transaction=True)
async def test_delete_connection_missing_returns_false(stub_connector):
    assert await delete_connection("does-not-exist", "proj1") is False


@pytest.mark.django_db(transaction=True)
async def test_mark_reauth_required_flips_status(stub_connector):
    connection = await create_connection("proj1", "stubapp", {"access_token": "a"})

    ok = await mark_reauth_required(connection.id, "proj1")

    assert ok is True
    reloaded = await Connection.objects.aget(id=connection.id)
    assert reloaded.status == Connection.Status.REAUTH_REQUIRED
