"""Writes dev/gcs-fake-credentials.json for the local Egress container.

Egress refuses to start without a credentials file that parses, but it never
authenticates with it: STORAGE_EMULATOR_HOST sends its traffic to fake-gcs. The key is
generated here rather than committed so the repo holds no private key, real or fake.
"""

import json
import pathlib

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

TARGET = pathlib.Path(__file__).resolve().parents[1] / "dev" / "gcs-fake-credentials.json"


def main() -> None:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    TARGET.write_text(
        json.dumps(
            {
                "type": "service_account",
                "project_id": "local-dev",
                "private_key_id": "local-dev",
                "private_key": pem,
                "client_email": "egress@local-dev.iam.gserviceaccount.com",
                "client_id": "000000000000000000000",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            },
            indent=2,
        )
        + "\n"
    )
    print(f"wrote {TARGET}")


if __name__ == "__main__":
    main()
