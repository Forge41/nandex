"""Writes the frontend's coding and SQL task fixture from the real task bank.

The fixture has to be a copy, not a likeness. A hand-written task shaped nearly like a
bank task is how a screen comes to render correctly against a shape the server never
sends, so this exports through the same two functions the API uses -- the dev bypass's
task selection and the serializer's hidden-file filter -- and the output is generated
rather than edited.

    uv run python manage.py export_task_fixture
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.interview.api.dev import _SQL_TASK, _bank_content
from apps.interview.serializers import _visible_content

DESTINATION = (
    Path(__file__).resolve().parents[4].parent / "frontend/lib/interview/mock/tasks.fixture.json"
)

# The coding round's header reads "Task 1 of 2", so one task would leave the task
# switcher unexercised -- which is one of the things the harness exists to look at.
TASK_COUNT = 2


class Command(BaseCommand):
    help = "Export coding and SQL round content as a frontend fixture."

    def add_arguments(self, parser):
        parser.add_argument("--out", default=str(DESTINATION))

    def handle(self, *args, **options):
        coding = _bank_content(TASK_COUNT, "python")
        if coding is None:
            raise SystemExit("The task bank returned nothing; run import_exercism first.")

        payload = {
            "coding": _visible_content(coding),
            "sql": _visible_content(_SQL_TASK),
        }

        out = Path(options["out"])
        out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
        titles = ", ".join(task["title"] for task in payload["coding"]["tasks"])
        self.stdout.write(self.style.SUCCESS(f"Wrote {out} ({titles})"))
