import apps.ingest.models
import django.contrib.postgres.indexes
import django.contrib.postgres.search
import pgvector.django.vector
from django.db import migrations, models
from pgvector.django import VectorExtension


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        VectorExtension(),
        migrations.CreateModel(
            name='IngestRun',
            fields=[
                ('id', models.CharField(default=apps.ingest.models.generate_id, editable=False, max_length=24, primary_key=True, serialize=False)),
                ('raw_document_id', models.CharField(db_index=True, max_length=24)),
                ('pipeline_version', models.PositiveIntegerField()),
                ('status', models.CharField(choices=[('running', 'running'), ('completed', 'completed'), ('failed', 'failed')], default='running', max_length=16)),
                ('failed_stage', models.CharField(blank=True, choices=[('parse', 'parse'), ('chunk', 'chunk'), ('embed', 'embed'), ('index', 'index')], default='', max_length=16)),
                ('error_message', models.TextField(blank=True, default='')),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'db_table': 'ingest_run',
                'indexes': [models.Index(fields=['raw_document_id', 'pipeline_version', 'status'], name='ingest_run_raw_doc_835ed5_idx')],
                'constraints': [models.UniqueConstraint(condition=models.Q(('status__in', ['running', 'completed'])), fields=('raw_document_id', 'pipeline_version'), name='uniq_active_ingest_run')],
            },
        ),
        migrations.CreateModel(
            name='ProcessedChunk',
            fields=[
                ('chunk_id', models.CharField(editable=False, max_length=24, primary_key=True, serialize=False)),
                ('raw_document_id', models.CharField(db_index=True, max_length=24)),
                ('chunk_idx', models.PositiveIntegerField()),
                ('content', models.TextField()),
                ('embedding', pgvector.django.vector.VectorField(dimensions=384)),
                ('embedding_model', models.CharField(max_length=128)),
                ('content_search', django.contrib.postgres.search.SearchVectorField(null=True)),
                ('page_idx', models.PositiveIntegerField(blank=True, null=True)),
                ('start_idx', models.PositiveIntegerField(blank=True, null=True)),
                ('end_idx', models.PositiveIntegerField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'ingest_processed_chunk',
                'indexes': [models.Index(fields=['raw_document_id', 'chunk_idx'], name='ingest_proc_raw_doc_c8f809_idx'), django.contrib.postgres.indexes.GinIndex(fields=['content_search'], name='ingest_chunk_search_gin')],
            },
        ),
    ]
