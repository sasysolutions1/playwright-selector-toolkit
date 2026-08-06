#!/usr/bin/env bash
set -euo pipefail

: "${SECURUS_INBOX_URL:?SECURUS_INBOX_URL is required}"
: "${SECURUS_USERNAME:?SECURUS_USERNAME is required}"
: "${SECURUS_PASSWORD:?SECURUS_PASSWORD is required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

node dist/cli/index.js \
  --config examples/outside-access/selector.config.yaml \
  validate examples/outside-access/selectors.template.yaml \
  "$SECURUS_INBOX_URL"
