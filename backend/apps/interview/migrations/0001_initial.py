import apps.interview.models
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='InterviewSession',
            fields=[
                ('id', models.CharField(default=apps.interview.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('project_id', models.CharField(db_index=True, max_length=24)),
                ('user_id', models.CharField(db_index=True, max_length=24)),
                ('candidate_name', models.CharField(blank=True, default='', max_length=255)),
                ('role_title', models.CharField(max_length=255)),
                ('total_duration_min', models.IntegerField(default=0)),
                ('status', models.CharField(choices=[('created', 'created'), ('active', 'active'), ('ended', 'ended')], default='created', max_length=16)),
                ('recording_state', models.CharField(choices=[('off', 'off'), ('armed', 'armed'), ('recording', 'recording'), ('failed', 'failed'), ('stopped', 'stopped')], default='off', max_length=16)),
                ('consent_recording', models.BooleanField(default=False)),
                ('consent_ai_interviewer', models.BooleanField(default=False)),
                ('consent_integrity_monitoring', models.BooleanField(default=False)),
                ('active_stage', models.CharField(default='preflight', max_length=32)),
                ('progress_index', models.IntegerField(default=0)),
                ('room_name', models.CharField(max_length=255, unique=True)),
                ('vas_session_id', models.CharField(blank=True, db_index=True, default='', max_length=24)),
                ('resume_document_id', models.CharField(blank=True, db_index=True, default='', max_length=24)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('ended_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'interview_session',
            },
        ),
        migrations.CreateModel(
            name='ResumeFacts',
            fields=[
                ('id', models.CharField(default=apps.interview.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('file_name', models.CharField(max_length=512)),
                ('size_bytes', models.BigIntegerField(default=0)),
                ('page_count', models.IntegerField(blank=True, null=True)),
                ('entity_count', models.IntegerField(default=0)),
                ('candidate_name', models.CharField(blank=True, default='', max_length=255)),
                ('candidate_title', models.CharField(blank=True, default='', max_length=255)),
                ('candidate_location', models.CharField(blank=True, default='', max_length=255)),
                ('candidate_email', models.CharField(blank=True, default='', max_length=320)),
                ('candidate_years_experience', models.IntegerField(blank=True, null=True)),
                ('sections', models.JSONField(blank=True, default=list)),
                ('probes', models.JSONField(blank=True, default=list)),
                ('citations', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('session', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='resume_facts', to='interview.interviewsession')),
            ],
            options={
                'db_table': 'interview_resume_facts',
            },
        ),
        migrations.CreateModel(
            name='TranscriptTurn',
            fields=[
                ('id', models.CharField(default=apps.interview.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('speaker', models.CharField(choices=[('interviewer', 'interviewer'), ('candidate', 'candidate')], max_length=16)),
                ('text', models.TextField()),
                ('at_seconds', models.IntegerField(default=0)),
                ('assessments', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transcript', to='interview.interviewsession')),
            ],
            options={
                'db_table': 'interview_transcript_turn',
                'ordering': ('at_seconds', 'created_at'),
            },
        ),
        migrations.CreateModel(
            name='InterviewRound',
            fields=[
                ('id', models.CharField(default=apps.interview.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('stage_id', models.CharField(max_length=32)),
                ('label', models.CharField(max_length=255)),
                ('kind', models.CharField(choices=[('setup', 'setup'), ('conversation', 'conversation'), ('task', 'task')], max_length=16)),
                ('duration_min', models.IntegerField(default=0)),
                ('order', models.IntegerField()),
                ('citation', models.IntegerField(blank=True, null=True)),
                ('summary', models.TextField(blank=True, default='')),
                ('content', models.JSONField(blank=True, default=dict)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rounds', to='interview.interviewsession')),
            ],
            options={
                'db_table': 'interview_round',
                'ordering': ('order',),
                'constraints': [models.UniqueConstraint(fields=('session', 'stage_id'), name='uniq_round_per_stage')],
            },
        ),
        migrations.CreateModel(
            name='SessionRecording',
            fields=[
                ('id', models.CharField(default=apps.interview.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('vas_recording_id', models.CharField(max_length=24)),
                ('egress_id', models.CharField(blank=True, default='', max_length=255)),
                ('status', models.CharField(blank=True, default='', max_length=16)),
                ('gcs_bucket', models.CharField(blank=True, default='', max_length=255)),
                ('gcs_object_key', models.CharField(blank=True, default='', max_length=1024)),
                ('duration_seconds', models.FloatField(blank=True, null=True)),
                ('file_size_bytes', models.BigIntegerField(blank=True, null=True)),
                ('checksum', models.CharField(blank=True, default='', max_length=128)),
                ('failure_reason', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recordings', to='interview.interviewsession')),
            ],
            options={
                'db_table': 'interview_session_recording',
                'constraints': [models.UniqueConstraint(fields=('session', 'vas_recording_id'), name='uniq_recording_per_session')],
            },
        ),
    ]
