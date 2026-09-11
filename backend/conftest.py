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
