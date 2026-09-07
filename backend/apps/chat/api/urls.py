from django.urls import path

from apps.chat.api import views

app_name = "chat"

urlpatterns = [
    path("chat/conversations", views.conversations),
    path("chat/conversations/<str:conversation_id>", views.conversation_detail),
    path("chat/conversations/<str:conversation_id>/messages", views.post_message),
]
