from apps.core.models import Project, Workspace


def list_projects(workspace: Workspace):
    return Project.objects.filter(workspace=workspace)


def create_project(workspace: Workspace, name: str, description: str = "") -> Project:
    return Project.objects.create(
        workspace=workspace, name=name.strip(), description=description.strip()
    )


def update_project(
    project: Project, name: str | None = None, description: str | None = None
) -> Project:
    if name is not None:
        project.name = name.strip()
    if description is not None:
        project.description = description.strip()
    project.save()
    return project
