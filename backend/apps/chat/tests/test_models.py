import pytest

from apps.chat.models import Conversation, Message


@pytest.mark.django_db
def test_conversation_and_message_round_trip():
    conversation = Conversation.objects.create(project_id="proj-1", user_id="user-1")
    message = Message.objects.create(
        conversation=conversation, role=Message.Role.USER, content="hello"
    )

    assert Conversation.objects.get(id=conversation.id).project_id == "proj-1"
    assert list(conversation.messages.all()) == [message]
    assert message.citations == []
