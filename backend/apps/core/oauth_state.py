"""Signed OAuth state blob core hands to tps's stateless install/exchange flow.

tps never validates this — it just carries it through the redirect and echoes it back on
exchange. Core is the only party that ever decodes it.
"""

from django.core import signing

OAUTH_STATE_MAX_AGE = 15 * 60


def encode_state(*, project_id: str, app_name: str, callback_path: str) -> str:
    return signing.dumps(
        {"project_id": project_id, "app_name": app_name, "callback_path": callback_path}
    )


def decode_state(state: str) -> dict:
    return signing.loads(state, max_age=OAUTH_STATE_MAX_AGE)
