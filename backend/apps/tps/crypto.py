"""MultiFernet encryption for connection credentials.

Supports key rotation via the comma-separated TPS_FERNET_KEYS env var: the first key
is used for new encryptions, but decryption tries every key so old ciphertexts stay
readable until they're next rewritten.
"""

import json
import logging

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from apps.tps.config import settings

logger = logging.getLogger(__name__)

_fernet: MultiFernet | None = None


def get_fernet() -> MultiFernet:
    global _fernet
    if _fernet is None:
        if not settings.fernet_keys:
            raise RuntimeError(
                "TPS_FERNET_KEYS not set. Generate one with: "
                'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            )
        keys = [k.strip() for k in settings.fernet_keys.split(",") if k.strip()]
        _fernet = MultiFernet([Fernet(k.encode()) for k in keys])
    return _fernet


def encrypt_config(config: dict) -> str:
    plaintext = json.dumps(config)
    return get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_config(ciphertext: str) -> dict:
    try:
        plaintext = get_fernet().decrypt(ciphertext.encode()).decode()
        return json.loads(plaintext)
    except InvalidToken:
        logger.error("Failed to decrypt connection config — invalid key or corrupted data")
        raise ValueError("Failed to decrypt connection config") from None
