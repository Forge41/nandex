from django.contrib import admin

from apps.core.models import Project, User, Workspace, WorkspaceMember

admin.site.register(User)
admin.site.register(Workspace)
admin.site.register(WorkspaceMember)
admin.site.register(Project)
