#!/usr/bin/env python3
"""Generate per-tool agent permission configs from .agents/permissions.toml.

Source of truth: .agents/permissions.toml
Targets:
    .claude/settings.json       (merge-write — preserves `hooks` and any other keys)
    .codex/rules/default.rules
    .cursor/cli.json

Modes:
    (default)   Write all target files.
    --check     Print a diff and exit 1 if any target is stale. Used in pre-commit.

Stdlib only (tomllib, Python 3.11+) — run it through `uv run python` so it gets the
project-pinned interpreter rather than whatever `python3` resolves to. macOS ships 3.9.
"""

from __future__ import annotations

import argparse
import difflib
import json
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / ".agents" / "permissions.toml"
CLAUDE_SETTINGS = REPO_ROOT / ".claude" / "settings.json"
CODEX_RULES = REPO_ROOT / ".codex" / "rules" / "default.rules"
CURSOR_CLI = REPO_ROOT / ".cursor" / "cli.json"

HEADER = (
    "# AUTO-GENERATED from .agents/permissions.toml by scripts/gen_agent_permissions.py. "
    "Do not edit."
)


@dataclass(frozen=True)
class Rule:
    pattern: tuple[str, ...]
    decision: str
    justification: str | None


def load() -> list[Rule]:
    data = tomllib.loads(SOURCE.read_text())
    rules = []
    for entry in data.get("shell", []):
        pattern = tuple(entry["pattern"])
        decision = entry.get("decision", "allow")
        justification = entry.get("justification")
        if decision not in ("allow", "deny"):
            raise SystemExit(f"{SOURCE}: unknown decision {decision!r} for {' '.join(pattern)}")
        if decision == "deny" and not justification:
            # A deny without a reason gets deleted by the next person who trips over it.
            raise SystemExit(f"{SOURCE}: deny rule {' '.join(pattern)!r} needs a justification")
        rules.append(Rule(pattern, decision, justification))
    return rules


def _glob(pattern: tuple[str, ...]) -> str:
    """Render a token prefix as the trailing-wildcard glob both Claude and Cursor expect."""
    return " ".join(pattern) + ":*"


def render_claude(rules: list[Rule]) -> str:
    permissions: dict[str, list[str]] = {"allow": [], "deny": []}
    for rule in rules:
        permissions[rule.decision].append(f"Bash({_glob(rule.pattern)})")

    # Merge-write: this file also carries hooks and editor settings that are not generated.
    existing: dict[str, Any] = {}
    if CLAUDE_SETTINGS.exists():
        existing = json.loads(CLAUDE_SETTINGS.read_text())
    existing.pop("permissions", None)
    merged: dict[str, Any] = {
        "$schema": "https://json.schemastore.org/claude-code-settings.json",
        "permissions": permissions,
    }
    existing.pop("$schema", None)
    merged.update(existing)
    return json.dumps(merged, indent=4) + "\n"


def render_cursor(rules: list[Rule]) -> str:
    permissions: dict[str, list[str]] = {"allow": [], "deny": []}
    for rule in rules:
        permissions[rule.decision].append(f"Shell({_glob(rule.pattern)})")
    return json.dumps({"permissions": permissions}, indent=4) + "\n"


def render_codex(rules: list[Rule]) -> str:
    lines = [
        HEADER,
        "# Codex execution policy. See https://developers.openai.com/codex/rules/",
        "",
    ]
    for decision, label in (("deny", "FORBIDDEN"), ("allow", "ALLOWED")):
        selected = [r for r in rules if r.decision == decision]
        if not selected:
            continue
        lines += ["# " + "=" * 72, f"# {label}", "# " + "=" * 72, ""]
        for rule in selected:
            tokens = ", ".join(f'"{token}"' for token in rule.pattern)
            lines.append("prefix_rule(")
            lines.append(f"    pattern = [{tokens}],")
            lines.append(f'    decision = "{"forbidden" if decision == "deny" else "allowed"}",')
            if rule.justification:
                lines.append(f'    justification = "{rule.justification}",')
            lines.append(")")
            lines.append("")
    return "\n".join(lines)


def generate() -> dict[Path, str]:
    rules = load()
    return {
        CLAUDE_SETTINGS: render_claude(rules),
        CODEX_RULES: render_codex(rules),
        CURSOR_CLI: render_cursor(rules),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if any target is stale")
    args = parser.parse_args()

    generated = generate()

    if not args.check:
        for path, content in generated.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
            print(f"wrote {path.relative_to(REPO_ROOT)}")
        return 0

    stale = False
    for path, expected in generated.items():
        actual = path.read_text() if path.exists() else ""
        if actual == expected:
            continue
        stale = True
        rel = path.relative_to(REPO_ROOT)
        print(f"--- stale: {rel}")
        sys.stdout.writelines(
            difflib.unified_diff(
                actual.splitlines(keepends=True),
                expected.splitlines(keepends=True),
                fromfile=f"{rel} (on disk)",
                tofile=f"{rel} (expected)",
            )
        )
    if stale:
        print("\nRun `make agent-permissions` to regenerate.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
