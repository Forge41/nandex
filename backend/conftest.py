"""Env vars that must exist before Django imports apps.tps.config / apps.core.config —
both read env at module-import time, which happens during django.setup(), before any
fixture in a test file would get a chance to set them.
"""

import os

from cryptography.fernet import Fernet

os.environ.setdefault("TPS_FERNET_KEYS", Fernet.generate_key().decode())
os.environ.setdefault("TPS_TPS_SECRET", "test-tps-secret")
os.environ.setdefault("CORE_TPS_SECRET", "test-tps-secret")
os.environ.setdefault("CORE_TPS_GRPC_ADDRESS", "localhost:50052")
os.environ.setdefault("TPS_GRPC_PORT", "50052")
# Non-empty, and long enough for HS256: a test that a minted token verifies is vacuous
# against an empty signing secret.
os.environ.setdefault("TPS_LIVEKIT_API_KEY", "test-livekit-key")
os.environ.setdefault("TPS_LIVEKIT_API_SECRET", "test-livekit-secret-at-least-32-bytes")
# A test asserting a wrong signature is rejected proves nothing if both sides are "".
os.environ.setdefault("VAS_SERVICE_BEARER_TOKEN", "test-vas-bearer-token")
os.environ.setdefault("VAS_CALLBACK_SIGNING_SECRET", "test-vas-callback-secret-32-bytes-min")
os.environ.setdefault("CORE_VAS_SERVICE_BEARER_TOKEN", "test-vas-bearer-token")
os.environ.setdefault("CORE_VAS_CALLBACK_SIGNING_SECRET", "test-vas-callback-secret-32-bytes-min")


import anthropic
import pytest


@pytest.fixture(autouse=True)
def never_reach_the_real_model(request, monkeypatch):
    """Refuses to build a model client during tests.

    Every path to the model goes through `ai.client`, which constructs one per call, so
    this catches a caller no fixture happened to patch. That has now happened twice: a new
    module does `from ai.client import complete`, the fixture patches the bindings it knew
    about, and the new one quietly makes real API calls -- passing on a machine with a key
    in its .env and failing in CI with an authentication error that names nothing useful.

    Marked `e2e_real_model` opts back in.
    """
    if request.node.get_closest_marker("e2e_real_model"):
        return

    def refuse(*args, **kwargs):
        raise AssertionError(
            "This test reached the real model. Patch `complete` where the module under "
            "test binds it -- `from ai.client import complete` makes a new name per "
            "module, so patching one does not patch the others."
        )

    monkeypatch.setattr(anthropic, "AsyncAnthropic", refuse)
