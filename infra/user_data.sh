#!/usr/bin/env bash
# First boot only. Installs Docker, clones the repository, writes the runtime
# environment from Secrets Manager, and starts the stack.
#
# Deliberately not the deploy mechanism: updates go through SSM Run Command, which runs
# `git pull && docker compose up -d --build` against this same checkout.

set -euxo pipefail

dnf update -y
dnf install -y docker git
systemctl enable --now docker

# Compose v2 as a docker plugin, aarch64 -- this is a Graviton instance.
mkdir -p /usr/libexec/docker/cli-plugins
curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 \
    -o /usr/libexec/docker/cli-plugins/docker-compose
chmod +x /usr/libexec/docker/cli-plugins/docker-compose

install -d -m 0755 /opt/nandex
git clone --depth 1 https://github.com/Forge41/nandex.git /opt/nandex/app

# IMDSv2. The instance role grants GetSecretValue on one secret and nothing else.
TOKEN=$(curl -fsSL -X PUT http://169.254.169.254/latest/api/token \
    -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
REGION=$(curl -fsSL -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/placement/region)
PUBLIC_IP=$(curl -fsSL -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/public-ipv4)

aws secretsmanager get-secret-value --secret-id nandex/app-env --region "$REGION" \
    --query SecretString --output text > /tmp/app-env.json

python3 /opt/nandex/app/deploy/render_env.py /tmp/app-env.json /opt/nandex/.env
rm -f /tmp/app-env.json
chmod 600 /opt/nandex/.env

# Caddy needs a hostname it can get a certificate for. nip.io resolves
# <ip>.nip.io to <ip>, is a real public domain, and Let's Encrypt issues for it -- so
# this works with no domain registered and no DNS to manage.
echo "APP_HOST=${PUBLIC_IP}.nip.io" >> /opt/nandex/.env
echo "DJANGO_ALLOWED_HOSTS=${PUBLIC_IP}.nip.io,localhost,127.0.0.1" >> /opt/nandex/.env
echo "INTERVIEW_CORE_BASE_URL=https://${PUBLIC_IP}.nip.io" >> /opt/nandex/.env

cd /opt/nandex/app
docker compose -f deploy/docker-compose.prod.yml --env-file /opt/nandex/.env up -d --build
