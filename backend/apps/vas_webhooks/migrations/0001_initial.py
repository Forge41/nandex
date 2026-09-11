import apps.vas_webhooks.models
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='WebhookLog',
            fields=[
                ('id', models.CharField(default=apps.vas_webhooks.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('event_id', models.CharField(db_index=True, max_length=255, unique=True)),
                ('event_type', models.CharField(db_index=True, max_length=128)),
                ('room_name', models.CharField(blank=True, default='', max_length=255)),
                ('egress_id', models.CharField(blank=True, db_index=True, default='', max_length=255)),
                ('raw_payload', models.JSONField(default=dict)),
                ('processed', models.BooleanField(db_index=True, default=False)),
                ('processing_error', models.TextField(blank=True, default='')),
                ('received_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'vas_webhook_log',
            },
        ),
    ]
