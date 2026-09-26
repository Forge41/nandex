from django.contrib import admin

from apps.portfolio.models import ContactMessage, PortfolioQuery


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("created_at", "name", "email", "notified")
    search_fields = ("email", "name", "text")
    readonly_fields = ("id", "name", "email", "text", "notified", "created_at")


@admin.register(PortfolioQuery)
class PortfolioQueryAdmin(admin.ModelAdmin):
    list_display = ("created_at", "kind", "outcome", "text", "latency_ms", "output_tokens")
    list_filter = ("kind", "outcome")
    search_fields = ("text",)
    readonly_fields = tuple(f.name for f in PortfolioQuery._meta.fields)
