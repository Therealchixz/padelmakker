#!/bin/bash
set -euo pipefail

# Kun i Claude Code på web (cloud-containeren), aldrig lokalt.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

npm install --no-save --no-audit --no-fund

# Proxyen re-terminerer TLS; Chromium læser kun sin egen NSS-database, ikke systemets CA-bundle.
if ! command -v certutil >/dev/null 2>&1; then
  apt-get update -qq >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libnss3-tools >/dev/null
fi
NSSDB="$HOME/.pki/nssdb"
if [ ! -f "$NSSDB/cert9.db" ]; then
  mkdir -p "$NSSDB"
  certutil -N -d "sql:$NSSDB" --empty-password
fi
for crt in /usr/local/share/ca-certificates/ccr-agent-proxy*.crt; do
  [ -f "$crt" ] || continue
  name="$(basename "$crt" .crt)"
  certutil -L -d "sql:$NSSDB" -n "$name" >/dev/null 2>&1 ||
    certutil -A -d "sql:$NSSDB" -n "$name" -t "CT,C,c" -i "$crt"
done

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export NODE_USE_ENV_PROXY=1' >> "$CLAUDE_ENV_FILE"
  # Playwright-pakken kan kræve en nyere browser end den forudinstallerede; brug den der findes.
  chrome="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | sort -V | tail -n 1 || true)"
  if [ -n "$chrome" ]; then
    echo "export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$chrome" >> "$CLAUDE_ENV_FILE"
  fi
fi
