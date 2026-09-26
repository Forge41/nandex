#!/usr/bin/env bash
# Pushes the CI credentials in backend/.env to GitHub Actions secrets.
#
# Values are piped straight into `gh secret set` and never printed -- not to the
# terminal, not to a log. Only the names are echoed.
#
# Blank entries are skipped rather than pushed: an empty secret fails CI in a way
# that looks like a broken pipeline instead of a missing credential.

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ENV_FILE=backend/.env
[ -f "$ENV_FILE" ] || { echo "error: $ENV_FILE is missing -- see README Setup." >&2; exit 1; }

missing=0
for name in TF_API_TOKEN RENDER_API_KEY NETLIFY_API_TOKEN; do
    value=$(sed -n "s/^${name}=//p" "$ENV_FILE" | head -1)
    if [ -z "$value" ]; then
        echo "  skipped  $name (no value in $ENV_FILE)"
        missing=1
        continue
    fi
    printf '%s' "$value" | gh secret set "$name"
    echo "  set      $name"
done

[ "$missing" -eq 0 ] || { echo; echo "Some secrets are unset; CI will fail until they are."; exit 1; }
