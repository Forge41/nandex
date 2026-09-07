"""chat models -- project_id/user_id stay plain ids, not Django ForeignKeys, matching every
other cross-app reference in this codebase (see apps.importer.RawDocument.connection_id).
Message.conversation is a real FK since both models live in this same app.
"""

import secrets

from django.db import models


def generate_id() -> str:
    return secrets.token_hex(12)


class Conversation(models.Model):
    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    project_id = models.CharField(db_index=True, max_length=24)
    user_id = models.CharField(db_index=True, max_length=24)
    title = models.CharField(max_length=256, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_conversation"

    def __str__(self) -> str:
        return self.title or self.id


class Message(models.Model):
    class Role(models.TextChoices):
        USER = "user", "user"
        ASSISTANT = "assistant", "assistant"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    citations = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_message"

    def __str__(self) -> str:
        return f"{self.conversation_id}:{self.role}"
