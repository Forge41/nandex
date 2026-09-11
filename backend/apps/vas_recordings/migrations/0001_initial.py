import apps.vas_recordings.models
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='VideoSession',
            fields=[
                ('id', models.CharField(default=apps.vas_recordings.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('external_session_id', models.CharField(db_index=True, max_length=255, unique=True)),
                ('room_name', models.CharField(db_index=True, max_length=255, unique=True)),
                ('status', models.CharField(choices=[('created', 'created'), ('active', 'active'), ('ended', 'ended')], default='created', max_length=16)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'vas_video_session',
            },
        ),
        migrations.CreateModel(
            name='Recording',
            fields=[
                ('id', models.CharField(default=apps.vas_recordings.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('egress_id', models.CharField(db_index=True, max_length=255, unique=True)),
                ('status', models.CharField(choices=[('starting', 'starting'), ('active', 'active'), ('ending', 'ending'), ('complete', 'complete'), ('failed', 'failed'), ('aborted', 'aborted'), ('limit_reached', 'limit_reached'), ('deleted', 'deleted')], default='starting', max_length=16)),
                ('gcs_bucket', models.CharField(blank=True, default='', max_length=255)),
                ('gcs_object_key', models.CharField(blank=True, default='', max_length=1024)),
                ('duration_seconds', models.FloatField(blank=True, null=True)),
                ('file_size_bytes', models.BigIntegerField(blank=True, null=True)),
                ('content_type', models.CharField(default='video/mp4', max_length=128)),
                ('checksum', models.CharField(blank=True, default='', max_length=128)),
                ('failure_reason', models.TextField(blank=True, default='')),
                ('retain_until', models.DateTimeField(blank=True, null=True)),
                ('egress_ended_at', models.DateTimeField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='recordings', to='vas_recordings.videosession')),
            ],
            options={
                'db_table': 'vas_recording',
                'indexes': [models.Index(fields=['session', 'status'], name='vas_recordi_session_f9ca66_idx'), models.Index(fields=['retain_until'], name='vas_recordi_retain__42bac8_idx')],
            },
        ),
    ]
