from django.db import migrations
from pgvector.django import HnswIndex


class Migration(migrations.Migration):
    dependencies = [("ingest", "0001_initial")]

    operations = [
        migrations.AddIndex(
            model_name="processedchunk",
            index=HnswIndex(
                name="ingest_chunk_embedding_hnsw",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ),
    ]
