"""Magic link token generation and verification using Django's own signing."""

from django.core.signing import BadSignature, SignatureExpired, TimestampSigner

_signer = TimestampSigner(salt="magic-link-v1")


def create_magic_token(email: str) -> str:
    return _signer.sign(email)


def verify_magic_token(token: str, max_age: int) -> str | None:
    try:
        return _signer.unsign(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
