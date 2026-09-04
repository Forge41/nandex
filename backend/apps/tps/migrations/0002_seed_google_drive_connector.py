from django.db import migrations


def seed_google_drive(apps, schema_editor):
    Connector = apps.get_model("tps", "Connector")
    Connector.objects.get_or_create(
        app_name="google_drive",
        defaults={
            "app_code": 1,
            "display_name": "Google Drive",
            "auth_type": 1,  # AuthType.OAUTH2
            "category": 5,  # AppCategory.STORAGE
            "provider": 1,  # AppProvider.NATIVE
            "meta": {
                "icon": "https://cdn.simpleicons.org/googledrive",
                "description": "Connect Google Drive to import your documents",
                "keywords": "Google Drive, storage, documents",
            },
            "is_install_required": True,
            "active": True,
        },
    )


def unseed_google_drive(apps, schema_editor):
    Connector = apps.get_model("tps", "Connector")
    Connector.objects.filter(app_name="google_drive").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("tps", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_google_drive, unseed_google_drive),
    ]
