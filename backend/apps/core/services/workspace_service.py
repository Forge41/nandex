from apps.core.models import User, Workspace


def current_workspace_for(user: User) -> Workspace | None:
    """The workspace a user acts in. Single-workspace-per-user for now — no switching yet."""
    return Workspace.objects.filter(members__user=user).first()
