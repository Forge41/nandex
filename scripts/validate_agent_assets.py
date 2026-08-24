#!/usr/bin/env python3
"""Validate the shared agent asset tree under .agents/.

Checks:
    1. Every skill directory name uses an approved prefix.
    2. Every skill has a SKILL.md with `name` and `description` frontmatter.
    3. The `name` in frontmatter matches the directory name.
    4. Every per-tool symlink into .agents/ still resolves.

Check 4 catches the Windows failure mode, where a committed symlink is checked out as a
text file containing its target path. Both Claude and Codex then see zero skills and say
nothing about it.

Stdlib only — run it through `uv run python` so it gets the project-pinned interpreter.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS = REPO_ROOT / ".agents" / "skills"

VALID_PREFIXES = ("connector_", "evals_", "expertise_", "test_", "utility_")

EXPECTED_LINKS = {
    REPO_ROOT / ".claude" / "skills": REPO_ROOT / ".agents" / "skills",
    REPO_ROOT / ".claude" / "agents": REPO_ROOT / ".agents" / "subagents",
    REPO_ROOT / ".codex" / "skills": REPO_ROOT / ".agents" / "skills",
    REPO_ROOT / ".cursor" / "skills": REPO_ROOT / ".agents" / "skills",
}

FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)


def check_skills() -> list[str]:
    errors = []
    for path in sorted(SKILLS.iterdir()):
        if path.name.startswith("."):
            continue
        if not path.is_dir():
            errors.append(f"{path.relative_to(REPO_ROOT)}: loose file, skills must be directories")
            continue

        if not path.name.startswith(VALID_PREFIXES):
            errors.append(
                f"{path.name}: name must start with one of {', '.join(VALID_PREFIXES)}"
            )

        skill_md = path / "SKILL.md"
        if not skill_md.exists():
            errors.append(f"{path.name}: missing SKILL.md")
            continue

        match = FRONTMATTER.match(skill_md.read_text())
        if not match:
            errors.append(f"{path.name}/SKILL.md: missing --- frontmatter block")
            continue

        fields = dict(
            (k.strip(), v.strip())
            for k, _, v in (line.partition(":") for line in match.group(1).splitlines())
            if k.strip()
        )
        for required in ("name", "description"):
            if not fields.get(required):
                errors.append(f"{path.name}/SKILL.md: frontmatter missing `{required}`")

        if (declared := fields.get("name")) and declared != path.name:
            errors.append(
                f"{path.name}/SKILL.md: frontmatter name `{declared}` "
                f"does not match directory name `{path.name}`"
            )
    return errors


def check_symlinks() -> list[str]:
    errors = []
    for link, target in EXPECTED_LINKS.items():
        rel = link.relative_to(REPO_ROOT)
        if not link.is_symlink():
            errors.append(
                f"{rel}: not a symlink. On Windows, enable Developer Mode and "
                f"`git config core.symlinks true`, then re-checkout."
            )
        elif link.resolve() != target.resolve():
            errors.append(f"{rel}: resolves to {link.resolve()}, expected {target}")
    return errors


def main() -> int:
    errors = check_skills() + check_symlinks()
    for error in errors:
        print(f"error: {error}", file=sys.stderr)
    if errors:
        print(f"\n{len(errors)} problem(s) in the agent asset tree.", file=sys.stderr)
        return 1
    print("agent assets OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
