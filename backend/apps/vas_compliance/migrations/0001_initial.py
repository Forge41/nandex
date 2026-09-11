import apps.vas_compliance.models
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='ArtifactDeletion',
            fields=[
                ('id', models.CharField(default=apps.vas_compliance.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('session_id', models.CharField(db_index=True, max_length=24)),
                ('requested_by', models.CharField(max_length=255)),
                ('reason', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('pending', 'pending'), ('in_progress', 'in_progress'), ('complete', 'complete'), ('failed', 'failed')], default='pending', max_length=16)),
                ('gcs_deleted', models.BooleanField(default=False)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'vas_artifact_deletion',
            },
        ),
    ]
