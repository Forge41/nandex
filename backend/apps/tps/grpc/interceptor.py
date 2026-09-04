"""Validates the shared secret carried as gRPC metadata — the metadata equivalent of the
old X-TPS-Secret header, now that core reaches tps over gRPC instead of HTTP.
"""

import grpc

from apps.tps.config import settings

SECRET_METADATA_KEY = "x-tps-secret"


class SharedSecretInterceptor(grpc.aio.ServerInterceptor):
    async def intercept_service(self, continuation, handler_call_details):
        metadata = dict(handler_call_details.invocation_metadata or ())
        if metadata.get(SECRET_METADATA_KEY) != settings.tps_secret:

            async def deny(request, context):
                await context.abort(grpc.StatusCode.UNAUTHENTICATED, "Invalid tps secret")

            return grpc.unary_unary_rpc_method_handler(deny)

        return await continuation(handler_call_details)
