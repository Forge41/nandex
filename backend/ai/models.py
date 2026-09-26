# Every model this project may call, and the ceiling on what it may write.
#
# `fast` marks a model that supports the fast-mode beta -- Opus 5 and 4.8 only, and
# Claude API only, not Bedrock/Vertex/Foundry. It is a property of the model rather than
# a caller's choice, so a caller asking for speed on a model without it takes the
# ordinary path instead of a 400.
MODEL_REGISTRY = {
    "claude-haiku-4-5": {"id": "claude-haiku-4-5-20251001", "max_tokens": 8192},
    "claude-sonnet-4-5": {"id": "claude-sonnet-4-5-20250929", "max_tokens": 8192},
    "claude-opus-5": {"id": "claude-opus-5", "max_tokens": 8192, "fast": True},
}

FAST_MODE_BETA = "fast-mode-2026-02-01"
