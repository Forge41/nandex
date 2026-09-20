"""The question bank, editable by a person.

Deliberately narrow. The bank's promise is that every task in it was **proved runnable
before it was written** -- a coding exercise's reference solution passed its own tests in
the sandbox, a SQL task's reference query ran against its own schema and the rows it
returned became the expected result. Neither reference is kept afterwards, so a task
typed in here cannot be re-proved: `verified_at` stays empty, and that is the honest
record of it.

Use this to read the bank, retire a task, and correct wording. To add one that has been
run, author it as JSON and use `build_sql_bank` / `import_exercism`, then
`load_task_banks`.
"""

from django.contrib import admin
from django.utils import timezone

from apps.interview.models import InterviewTask


@admin.register(InterviewTask)
class InterviewTaskAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "slug", "offered_in", "state", "proved")
    list_filter = ("kind", "source")
    search_fields = ("slug", "title")
    ordering = ("kind", "slug")
    readonly_fields = ("id", "verified_at", "created_at", "updated_at")
    actions = ("retire", "restore")

    fieldsets = (
        (None, {"fields": ("slug", "kind", "title", "languages", "payload")}),
        ("Provenance", {"fields": ("source", "licence")}),
        (
            "Lifecycle",
            {
                "fields": ("retired_at", "verified_at", "id", "created_at", "updated_at"),
                "description": (
                    "A retired task is never set again but is kept: it may already be in "
                    "a finished interview, and a bank that cannot say what it used to "
                    "contain cannot explain one. <b>verified_at</b> is when this task's "
                    "reference solution last actually ran — empty means it has never "
                    "been proved solvable, which is the case for anything added here."
                ),
            },
        ),
    )

    @admin.display(description="Languages")
    def offered_in(self, task: InterviewTask) -> str:
        return ", ".join(task.languages) or "—"

    @admin.display(description="State")
    def state(self, task: InterviewTask) -> str:
        return "retired" if task.retired_at else "live"

    @admin.display(description="Reference last ran")
    def proved(self, task: InterviewTask) -> str:
        """Blank is "not recorded", which is not the same as "never proved".

        Everything imported from the files was run when it was built; only the SQL
        builder writes the timestamp down so far, so the older coding imports have
        nothing to show and must not be reported as unproven.
        """
        if task.verified_at:
            return task.verified_at.strftime("%Y-%m-%d")
        return "not recorded"

    def has_delete_permission(self, request, obj=None) -> bool:
        """Retired, never deleted -- the reason is in the Lifecycle help text."""
        return False

    @admin.action(description="Retire (stop setting these, keep them)")
    def retire(self, request, queryset):
        updated = queryset.filter(retired_at__isnull=True).update(retired_at=timezone.now())
        self.message_user(request, f"Retired {updated}.")

    @admin.action(description="Put back into rotation")
    def restore(self, request, queryset):
        updated = queryset.filter(retired_at__isnull=False).update(retired_at=None)
        self.message_user(request, f"Restored {updated}.")
