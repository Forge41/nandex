from django.contrib import admin

from apps.tps.models import Connection, Connector

admin.site.register(Connector)
admin.site.register(Connection)
