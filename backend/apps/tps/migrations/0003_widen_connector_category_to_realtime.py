from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tps", "0002_seed_google_drive_connector"),
    ]

    operations = [
        migrations.AlterField(
            model_name="connector",
            name="category",
            field=models.IntegerField(
                choices=[
                    (1, "source_control"),
                    (2, "hosting"),
                    (3, "distribution"),
                    (4, "coming_soon"),
                    (5, "storage"),
                    (6, "realtime"),
                ]
            ),
        ),
    ]
