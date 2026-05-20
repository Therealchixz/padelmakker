#!/usr/bin/env bash
set -euo pipefail

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "Usage: npm run db:migration:new <snake_name> [source.sql]" >&2
  exit 1
fi

TS="$(date -u +%Y%m%d%H%M%S)"
FILE="supabase/migrations/${TS}_${NAME}.sql"
SOURCE="${2:-}"

mkdir -p supabase/migrations

if [ -n "$SOURCE" ] && [ -f "$SOURCE" ]; then
  cp "$SOURCE" "$FILE"
elif [ -f "supabase/sql/${NAME}.sql" ]; then
  cp "supabase/sql/${NAME}.sql" "$FILE"
else
  cat > "$FILE" <<EOF
-- Migration: ${NAME}
-- Created: ${TS}

EOF
fi

echo "Created ${FILE}"
