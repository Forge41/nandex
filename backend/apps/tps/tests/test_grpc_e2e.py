"""End-to-end tests over the real wire: a live grpc.aio server, a real channel, real
protobuf (de)serialization — not calling TpsServicer methods directly in-process.
"""

import json

import grpc
import pytest

from apps.tps.grpc import tps_pb2, tps_pb2_grpc
from apps.tps.grpc.interceptor import SharedSecretInterceptor
from apps.tps.grpc.servicer import TpsServicer
from apps.tps.handlers import HANDLER_REGISTRY
from apps.tps.models import Connector

TEST_ADDRESS = "localhost:50053"
TEST_SECRET = "e2e-test-secret"


class StubCredentialHandler:
    def get_app_name(self) -> str:
        return "e2eapp"

    async def get_user_info(self, config: dict) -> dict:
        return {}

    async def validate_credentials(self, config: dict) -> bool:
        return config.get("api_token") == "valid-key"


@pytest.fixture
async def grpc_server():
    server = grpc.aio.server(interceptors=[SharedSecretInterceptor()])
    tps_pb2_grpc.add_TpsServiceServicer_to_server(TpsServicer(), server)
    server.add_insecure_port(TEST_ADDRESS)
    await server.start()
    yield
    await server.stop(grace=None)


@pytest.fixture
async def channel(grpc_server):
    async with grpc.aio.insecure_channel(TEST_ADDRESS) as ch:
        yield ch


def _metadata(secret: str = TEST_SECRET):
    return (("x-tps-secret", secret),)


@pytest.mark.django_db(transaction=True)
async def test_wrong_secret_is_rejected_over_the_wire(channel):
    from apps.tps.config import settings as tps_settings

    tps_settings.tps_secret = TEST_SECRET

    stub = tps_pb2_grpc.TpsServiceStub(channel)
    with pytest.raises(grpc.aio.AioRpcError) as exc_info:
        await stub.ListApps(tps_pb2.ListAppsRequest(), metadata=_metadata("wrong-secret"))
    assert exc_info.value.code() == grpc.StatusCode.UNAUTHENTICATED


@pytest.mark.django_db(transaction=True)
async def test_list_and_get_app_over_the_wire(channel):
    from apps.tps.config import settings as tps_settings

    tps_settings.tps_secret = TEST_SECRET

    await Connector.objects.acreate(
        app_code=1001,
        app_name="e2eapp",
        display_name="E2E App",
        auth_type=2,  # API_KEY
        category=1,
        meta={"keywords": "e2e"},
        is_install_required=False,
        active=True,
    )

    stub = tps_pb2_grpc.TpsServiceStub(channel)

    list_resp = await stub.ListApps(tps_pb2.ListAppsRequest(), metadata=_metadata())
    assert [a.app_name for a in list_resp.apps] == ["e2eapp"]

    get_resp = await stub.GetApp(tps_pb2.GetAppRequest(identifier="e2eapp"), metadata=_metadata())
    assert get_resp.display_name == "E2E App"
    assert json.loads(get_resp.meta_json) == {"keywords": "e2e"}


@pytest.mark.django_db(transaction=True)
async def test_full_connection_lifecycle_over_the_wire(channel):
    from apps.tps.config import settings as tps_settings

    tps_settings.tps_secret = TEST_SECRET
    HANDLER_REGISTRY["e2eapp"] = StubCredentialHandler

    try:
        await Connector.objects.acreate(
            app_code=1002,
            app_name="e2eapp",
            display_name="E2E App",
            auth_type=2,
            category=1,
            is_install_required=False,
            active=True,
        )

        stub = tps_pb2_grpc.TpsServiceStub(channel)

        connect_resp = await stub.ConnectCredentials(
            tps_pb2.ConnectCredentialsRequest(
                app_name="e2eapp",
                project_id="proj-e2e",
                credentials_json=json.dumps({"api_token": "valid-key"}),
            ),
            metadata=_metadata(),
        )
        connection_id = connect_resp.id
        assert connect_resp.status == "active"

        list_resp = await stub.ListConnections(
            tps_pb2.ListConnectionsRequest(project_id="proj-e2e"), metadata=_metadata()
        )
        assert [c.id for c in list_resp.connections] == [connection_id]

        get_resp = await stub.GetConnection(
            tps_pb2.GetConnectionRequest(project_id="proj-e2e", identifier="e2eapp"),
            metadata=_metadata(),
        )
        assert get_resp.id == connection_id

        token_resp = await stub.GetToken(
            tps_pb2.GetTokenRequest(project_id="proj-e2e", connection_id=connection_id),
            metadata=_metadata(),
        )
        assert token_resp.access_token == "valid-key"

        delete_resp = await stub.DeleteConnection(
            tps_pb2.DeleteConnectionRequest(project_id="proj-e2e", connection_id=connection_id),
            metadata=_metadata(),
        )
        assert delete_resp.ok is True

        empty_list = await stub.ListConnections(
            tps_pb2.ListConnectionsRequest(project_id="proj-e2e"), metadata=_metadata()
        )
        assert list(empty_list.connections) == []
    finally:
        del HANDLER_REGISTRY["e2eapp"]


@pytest.mark.django_db(transaction=True)
async def test_connect_credentials_rejects_invalid_credentials(channel):
    from apps.tps.config import settings as tps_settings

    tps_settings.tps_secret = TEST_SECRET
    HANDLER_REGISTRY["e2eapp"] = StubCredentialHandler

    try:
        await Connector.objects.acreate(
            app_code=1003,
            app_name="e2eapp",
            display_name="E2E App",
            auth_type=2,
            category=1,
            is_install_required=False,
            active=True,
        )

        stub = tps_pb2_grpc.TpsServiceStub(channel)
        with pytest.raises(grpc.aio.AioRpcError) as exc_info:
            await stub.ConnectCredentials(
                tps_pb2.ConnectCredentialsRequest(
                    app_name="e2eapp",
                    project_id="proj-e2e",
                    credentials_json=json.dumps({"api_token": "wrong"}),
                ),
                metadata=_metadata(),
            )
        assert exc_info.value.code() == grpc.StatusCode.INVALID_ARGUMENT
    finally:
        del HANDLER_REGISTRY["e2eapp"]
