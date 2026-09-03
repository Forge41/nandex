"""Loads integrations.yaml — the single source of truth for which third-party
integrations this project supports, at any stage (planned or built).
"""

import enum
from dataclasses import dataclass, field
from pathlib import Path

import yaml

MANIFEST_PATH = Path(__file__).resolve().parents[3] / "integrations.yaml"


class IntegrationStatus(enum.StrEnum):
    PLANNED = "planned"
    BUILT = "built"


@dataclass(frozen=True)
class IntegrationManifest:
    slug: str
    display_name: str
    category: str
    auth_type: str
    status: IntegrationStatus
    icon: str = ""
    keywords: tuple[str, ...] = ()
    form_fields: tuple[dict, ...] = field(default_factory=tuple)


def _load(path: Path = MANIFEST_PATH) -> dict[str, IntegrationManifest]:
    data = yaml.safe_load(path.read_text()) or {}
    manifests = {}
    for entry in data.get("integrations") or []:
        manifest = IntegrationManifest(
            slug=entry["slug"],
            display_name=entry["display_name"],
            category=entry["category"],
            auth_type=entry["auth_type"],
            status=IntegrationStatus(entry["status"]),
            icon=entry.get("icon", ""),
            keywords=tuple(entry.get("keywords", ())),
            form_fields=tuple(entry.get("form_fields", ())),
        )
        manifests[manifest.slug] = manifest
    return manifests


INTEGRATIONS: dict[str, IntegrationManifest] = _load()

IntegrationSlug = enum.Enum(
    "IntegrationSlug", {slug.upper(): slug for slug in INTEGRATIONS}, type=str
)
