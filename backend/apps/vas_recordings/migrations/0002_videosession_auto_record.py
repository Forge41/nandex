from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('vas_recordings', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='videosession',
            name='auto_record',
            field=models.BooleanField(default=False),
        ),
    ]
