"""Imports Exercism exercises into the task bank, proving each one runs before storing it.

Run at build time, never during an interview: the network is not on the path of a round,
and every exercise is executed here so that a task which cannot be passed is never set.

    uv run manage.py import_exercism --slugs acronym,anagram --tracks python,java

The bank is JSON under `apps/interview/task_bank/`, checked into the repository rather than
seeded into a table: it is content, it should be reviewable in a diff, and an interview
should not depend on a migration having been run to have something to set.
"""

import asyncio
import json

from django.core.management.base import BaseCommand

from apps.interview import exercism
from apps.interview.coding_generation import TaskUnusable
from apps.interview.task_bank import BANK_DIR, DIFFICULTY

TRACKS = ("python", "java", "c", "cpp")


class Command(BaseCommand):
    help = "Import Exercism exercises into the coding task bank, verifying each one runs."

    def add_arguments(self, parser):
        parser.add_argument("--slugs", required=True, help="Comma-separated exercise slugs")
        parser.add_argument("--tracks", default=",".join(TRACKS))
        parser.add_argument(
            "--skip-verify",
            action="store_true",
            help="Store without running the reference solution. Only for offline work: an "
            "unverified exercise can set a task nobody is able to pass.",
        )

    def handle(self, *args, **options):
        slugs = [s.strip() for s in options["slugs"].split(",") if s.strip()]
        tracks = [t.strip() for t in options["tracks"].split(",") if t.strip()]
        BANK_DIR.mkdir(parents=True, exist_ok=True)

        for slug in slugs:
            try:
                task = asyncio.run(self._import(slug, tracks, options["skip_verify"]))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"{slug}: {e}"))
                continue
            path = BANK_DIR / f"{slug}.json"
            path.write_text(json.dumps(task, indent=2, sort_keys=True) + "\n")
            self.stdout.write(
                self.style.SUCCESS(f"{slug}: {', '.join(task['languages'])} -> {path.name}")
            )

    async def _import(self, slug: str, tracks: list[str], skip_verify: bool) -> dict:
        from apps.interview import coding_generation

        brief = await asyncio.to_thread(exercism.instructions, slug)
        if not brief:
            raise TaskUnusable("the exercise has no usable instructions")

        task = {
            "source": "exercism",
            "slug": slug,
            "licence": exercism.LICENCE,
            "title": exercism.title(slug),
            "difficulty": DIFFICULTY,
            "difficultyLabel": "Medium",
            "brief": brief,
            "example": "",
            "constraints": [],
            "complexity": [],
            "attemptsAllowed": 3,
            "tests": [],
            "languages": {},
        }

        for track in tracks:
            try:
                variant = await asyncio.to_thread(exercism.variant, track, slug)
            except exercism.ExerciseUnavailable as e:
                self.stdout.write(f"  {slug}/{track}: not available ({e})")
                continue

            if skip_verify:
                self.stdout.write(f"  {slug}/{track}: stored unverified")
                continue

            tests = await self._verify(coding_generation, track, variant)
            if isinstance(tests, str):
                self.stdout.write(f"  {slug}/{track}: {tests}")
                continue

            task["languages"][track] = {
                "files": variant["files"],
                # Per language: an Exercism track names and counts its cases its own way,
                # and the panel has to list the ones that will actually run.
                "tests": tests,
            }

        if not task["languages"]:
            raise TaskUnusable("no track could be imported and verified")
        task["tests"] = next(iter(task["languages"].values()))["tests"]
        task["defaultLanguage"] = next(iter(task["languages"]))
        return task

    async def _verify(self, coding_generation, track, variant) -> object:
        """Runs the exercise's own reference solution against its own tests.

        The whole reason importing is safe, and where the case list comes from: an
        exercise whose reference does not pass here would set a task nobody can pass, and
        the candidate would see real failures and a false verdict.
        """
        files = {f["name"]: f["content"] for f in variant["files"]}
        solution = next(f["name"] for f in variant["files"] if not f.get("readOnly"))
        files[solution] = variant["reference"]
        for override in variant.get("referenceExtra") or []:
            files[override["name"]] = override["content"]

        try:
            ran = await coding_generation.verify_files(track, files)
        except TaskUnusable as e:
            return f"rejected: {e}"
        # The cases the run reported, in the order it reported them. Nothing is hidden
        # from an imported exercise: the track chose its cases and they are all visible.
        return [{"name": case["name"], "hidden": False} for case in ran]
