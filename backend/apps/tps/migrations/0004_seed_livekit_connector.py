from django.db import migrations


def seed_livekit(apps, schema_editor):
    Connector = apps.get_model("tps", "Connector")
    Connector.objects.get_or_create(
        app_name="livekit",
        defaults={
            "app_code": 2,
            "display_name": "LiveKit",
            "auth_type": 2,  # AuthType.API_KEY
            "category": 6,  # AppCategory.REALTIME
            "provider": 1,  # AppProvider.NATIVE
            "meta": {
                "icon": "https://cdn.simpleicons.org/livekit",
                "description": "Host live audio and video rooms",
                "keywords": "LiveKit, realtime, video, audio, rooms",
                "form_fields": [
                    {
                        "reference_key": "host",
                        "type": "text",
                        "display_name": "Server URL",
                        "required": True,
                    },
                    {
                        "reference_key": "api_key",
                        "type": "text",
                        "display_name": "API key",
                        "required": True,
                    },
                    {
                        "reference_key": "api_secret",
                        "type": "password",
                        "display_name": "API secret",
                        "required": True,
                    },
                ],
            },
            "is_install_required": False,
            "active": True,
        },
    )


def unseed_livekit(apps, schema_editor):
    Connector = apps.get_model("tps", "Connector")
    Connector.objects.filter(app_name="livekit").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("tps", "0003_widen_connector_category_to_realtime"),
    ]

    operations = [
        migrations.RunPython(seed_livekit, unseed_livekit),
    ]
