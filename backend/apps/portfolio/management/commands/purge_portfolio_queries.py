from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.portfolio.config import settings
from apps.portfolio.models import PortfolioQuery


class Command(BaseCommand):
    help = "Delete logged portfolio questions older than the retention window."

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=settings.query_retention_days)
        deleted, _ = PortfolioQuery.objects.filter(created_at__lt=cutoff).delete()
        self.stdout.write(f"deleted={deleted}")
