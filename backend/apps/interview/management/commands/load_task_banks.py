"""Loads the coding and SQL banks from their JSON into the database.

The files stay in the repository and remain the source the banks are authored in -- a
task's history belongs in git, where a diff is reviewable, and `build_sql_bank` proves a
SQL task runs before it is ever written. This is the step that makes them readable at
interview time.

Upserts by slug, so it is safe to run on every deploy. A task that has disappeared from
the files is retired rather than deleted: it may already have been set in an interview,
and a bank that cannot say what it used to contain cannot explain a past one.

    uv run python manage.py load_task_banks
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.interview import sql_bank, task_bank
from apps.interview.models import InterviewTask


def _row(task: dict, kind: str) -> dict:
    return {
        "kind": kind,
        "title": str(task.get("title") or ""),
        "payload": task,
        "languages": sorted(task.get("languages") or {}),
        "source": str(task.get("source") or ""),
        "licence": str(task.get("licence") or ""),
        "retired_at": None,
        "verified_at": parse_datetime(task["verifiedAt"]) if task.get("verifiedAt") else None,
    }


def _slug_of(task: dict, kind: str, index: int) -> str:
    """Imported coding tasks carry no slug of their own, so their title is the stable
    thing about them. Prefixed by kind, because a coding and a SQL task may share one."""
    named = task.get("slug") or task.get("title") or f"task-{index}"
    return f"{kind}:{str(named).strip().lower().replace(' ', '-')}"


class Command(BaseCommand):
    help = "Load the coding and SQL task banks into the database."

    @transaction.atomic
    def handle(self, *args, **options):
        seen = set()
        for kind, tasks in (("coding", task_bank.load()), ("sql", sql_bank.load())):
            for index, task in enumerate(tasks):
                slug = _slug_of(task, kind, index)
                seen.add(slug)
                InterviewTask.objects.update_or_create(slug=slug, defaults=_row(task, kind))
            self.stdout.write(f"  {kind:<7} {len(tasks)} tasks")

        retired = (
            InterviewTask.objects.filter(retired_at__isnull=True)
            .exclude(slug__in=seen)
            .update(retired_at=timezone.now())
        )
        live = InterviewTask.objects.filter(retired_at__isnull=True).count()
        self.stdout.write(self.style.SUCCESS(f"{live} live, {retired} newly retired"))
