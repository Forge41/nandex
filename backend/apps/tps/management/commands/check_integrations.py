from django.core.management.base import BaseCommand, CommandError

from apps.importer.providers import PROVIDER_REGISTRY
from apps.tps.catalog import INTEGRATIONS
from apps.tps.handlers import HANDLER_REGISTRY


class Command(BaseCommand):
    help = "Validate that tps.handlers and importer.providers only reference slugs declared in integrations.yaml"

    def handle(self, *args, **options):
        errors = []
        for registry_name, registry in (
            ("tps.handlers.HANDLER_REGISTRY", HANDLER_REGISTRY),
            ("importer.providers.PROVIDER_REGISTRY", PROVIDER_REGISTRY),
        ):
            for slug in registry:
                if slug not in INTEGRATIONS:
                    errors.append(
                        f"{registry_name} has '{slug}', not declared in integrations.yaml"
                    )

        if errors:
            raise CommandError("\n".join(errors))

        self.stdout.write(
            self.style.SUCCESS(
                f"integrations OK ({len(INTEGRATIONS)} declared in integrations.yaml)"
            )
        )
