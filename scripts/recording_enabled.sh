#!/usr/bin/env bash
# Prints 1 when this checkout records, 0 otherwise, reading the same
# INTERVIEW_RECORDING_ENABLED that the backend does. Recording is off unless
# something turns it on, so an absent .env and an unset key both answer 0.
#
# One parser, because dev_serve.sh and the Makefile must not disagree about
# whether vas is running.

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The `|| true` matters: grep exits 1 when the key is absent, which under
# `set -e` would make "not configured" look like a broken script.
value=$( (grep -E '^INTERVIEW_RECORDING_ENABLED=' backend/.env 2>/dev/null || true) \
    | tail -1 | cut -d= -f2- | tr -d '"'"'"' ' | tr 'A-Z' 'a-z')

case "$value" in
    1 | true | yes | on) echo 1 ;;
    *) echo 0 ;;
esac
