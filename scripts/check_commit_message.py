#!/usr/bin/env python3
"""Reject agent attribution in commit messages.

Commits are authored by the person who reviewed and landed them. Agent attribution
trailers and generator footers add no information a reader can act on, and they
misattribute responsibility for the change.

Two invocation modes:
    <path>      commit-msg hook — validate the message being written.
    --range     pre-push hook — validate every commit about to be pushed, which
                catches history created with --no-verify, by a rebase, or by a tool
                that does not run hooks.

What is rejected is attribution, not the words themselves: a commit that legitimately
mentions Claude, Codex, or Cursor in its subject passes. Only trailers, generator
footers, and bracket tags are blocked, so nobody has a reason to reach for --no-verify.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys

AGENT = r"(claude|anthropic|codex|openai|cursor|copilot|gemini|devin|\[bot\]|-bot\b)"

VIOLATIONS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(rf"^\s*co-authored-by:.*{AGENT}", re.IGNORECASE | re.MULTILINE),
        "Co-Authored-By trailer crediting an agent",
    ),
    (
        re.compile(rf"^\s*(signed-off-by|assisted-by|generated-by):.*{AGENT}",
                   re.IGNORECASE | re.MULTILINE),
        "attribution trailer crediting an agent",
    ),
    (
        re.compile(rf"generated with.*{AGENT}", re.IGNORECASE),
        "generator footer",
    ),
    (
        re.compile(r"🤖", re.IGNORECASE),
        "robot emoji footer",
    ),
    (
        re.compile(rf"^\s*\[\s*{AGENT}[^\]]*\]", re.IGNORECASE | re.MULTILINE),
        "agent name tag at the start of a line",
    ),
]

GUIDANCE = """
Commits are authored by the person who landed them. Remove the offending line and
amend:  git commit --amend

If an agent wrote the change, that belongs in the PR description as context, not in
the commit trailer. See the Commits section of AGENTS.md.
"""


def check(message: str, label: str) -> list[str]:
    errors = []
    for pattern, description in VIOLATIONS:
        match = pattern.search(message)
        if match:
            offending = match.group(0).strip().splitlines()[0]
            errors.append(f"{label}: {description}\n    {offending}")
    return errors


def commits_to_push() -> list[str]:
    """Commit SHAs about to be pushed, or all commits when there is no upstream."""
    for revspec in ("@{upstream}..HEAD", "origin/main..HEAD", "HEAD"):
        result = subprocess.run(
            ["git", "rev-list", "--max-count=50", revspec],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return result.stdout.split()
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", help="commit message file (commit-msg hook)")
    parser.add_argument("--range", action="store_true", help="check commits about to be pushed")
    args = parser.parse_args()

    errors: list[str] = []

    if args.range:
        for sha in commits_to_push():
            message = subprocess.run(
                ["git", "log", "-1", "--format=%B", sha],
                capture_output=True,
                text=True,
                check=True,
            ).stdout
            errors += check(message, f"commit {sha[:8]}")
    elif args.path:
        errors += check(open(args.path, encoding="utf-8").read(), "commit message")
    else:
        parser.error("pass a commit message path or --range")

    if errors:
        print("Agent attribution is not allowed in commit messages.\n", file=sys.stderr)
        for error in errors:
            print(f"  {error}", file=sys.stderr)
        print(GUIDANCE, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
