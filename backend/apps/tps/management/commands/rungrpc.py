import asyncio

import grpc
from django.core.management.base import BaseCommand

from apps.tps.config import settings
from apps.tps.grpc import tps_pb2_grpc
from apps.tps.grpc.interceptor import SharedSecretInterceptor
from apps.tps.grpc.servicer import TpsServicer


class Command(BaseCommand):
    help = "Run tps's gRPC server — the only way apps.core talks to tps"

    def add_arguments(self, parser):
        parser.add_argument("--port", type=int, default=settings.grpc_port)

    def handle(self, *args, **options):
        asyncio.run(self._serve(options["port"]))

    async def _serve(self, port: int) -> None:
        server = grpc.aio.server(interceptors=[SharedSecretInterceptor()])
        tps_pb2_grpc.add_TpsServiceServicer_to_server(TpsServicer(), server)
        server.add_insecure_port(f"[::]:{port}")
        self.stdout.write(self.style.SUCCESS(f"tps gRPC server listening on :{port}"))
        await server.start()
        await server.wait_for_termination()
