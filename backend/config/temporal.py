"""One place that knows how to reach Temporal.

Every app keeps its own task queue and its own address setting -- those are genuinely
per-app -- but namespace and credentials are a property of the deployment, not of the
app doing the connecting. Eleven call sites each growing their own TLS handling is
eleven chances to get one of them wrong.

Reading the environment directly rather than through a pydantic Settings class is
deliberate: this module is imported by apps that must not import each other, so it
belongs to no app and depends on none.
"""

import os

from temporalio.client import Client


async def connect(address: str) -> Client:
    """Connects to `address`, adding namespace and credentials where configured.

    With TEMPORAL_API_KEY unset this is a plain local connection, so `temporal server
    start-dev` keeps working untouched. With it set, TLS is implied -- Temporal Cloud
    refuses an API key over plaintext, and making that implicit removes a way to
    misconfigure it.

    `address` must be Temporal Cloud's *regional* endpoint when using an API key --
    `ap-southeast-1.aws.api.temporal.io:7233`, not the per-namespace
    `<namespace>.<account>.tmprl.cloud:7233`, which only accepts mTLS. Both are listed
    on the namespace, and using the wrong one fails as "Request unauthorized", which
    reads like a permissions problem and is not one.
    """
    namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")
    api_key = os.environ.get("TEMPORAL_API_KEY", "")

    if not api_key:
        return await Client.connect(address, namespace=namespace)

    return await Client.connect(
        address,
        namespace=namespace,
        api_key=api_key,
        tls=True,
    )
