"""Neither model stores an IP address or user agent: rate limiting keeps a salted hash in
the cache only, and nothing here can be joined back to a visitor."""

import secrets

from django.db import models


def generate_id() -> str:
    return secrets.token_hex(12)


class PortfolioQuery(models.Model):
    class Kind(models.TextChoices):
        ASK = "ask", "ask"
        FIT = "fit", "fit"

    class Outcome(models.TextChoices):
        ANSWERED = "answered", "answered"
        FAILED = "failed", "failed"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    kind = models.CharField(max_length=8, choices=Kind.choices)
    text = models.TextField()
    retrieved = models.JSONField(default=list, blank=True)
    answer = models.TextField(blank=True, default="")
    outcome = models.CharField(max_length=16, choices=Outcome.choices)
    latency_ms = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "portfolio_query"
        verbose_name_plural = "portfolio queries"

    def __str__(self) -> str:
        return f"{self.kind}:{self.text[:60]}"


class ContactMessage(models.Model):
    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    name = models.CharField(max_length=200, blank=True, default="")
    email = models.EmailField()
    text = models.TextField()
    notified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "portfolio_contact_message"

    def __str__(self) -> str:
        return f"{self.email}: {self.text[:60]}"
