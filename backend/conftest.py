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
