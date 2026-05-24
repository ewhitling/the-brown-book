#!/usr/bin/env bash
# check-size-budgets.sh — fails the build (non-zero exit) if:
#   - data/botns.db  > DB_MAX_MB  (default 25 MB)
#   - web/dist bundle (all files except botns.db) > BUNDLE_MAX_MB (default 6 MB)
#
# Override thresholds for testing:
#   DB_MAX_MB=1 BUNDLE_MAX_MB=1 scripts/check-size-budgets.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_MAX_MB="${DB_MAX_MB:-25}"
BUNDLE_MAX_MB="${BUNDLE_MAX_MB:-6}"
DB_MAX_BYTES=$(( DB_MAX_MB * 1024 * 1024 ))
BUNDLE_MAX_BYTES=$(( BUNDLE_MAX_MB * 1024 * 1024 ))

FAIL=0

# ── 1. DB size ────────────────────────────────────────────────────────────────

DB_PATH="$ROOT/data/botns.db"

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: $DB_PATH not found" >&2
  exit 1
fi

DB_BYTES=$(wc -c < "$DB_PATH")
DB_KB=$(( DB_BYTES / 1024 ))

if (( DB_BYTES > DB_MAX_BYTES )); then
  echo "FAIL  data/botns.db: ${DB_KB}KB — exceeds ${DB_MAX_MB}MB budget" >&2
  FAIL=1
else
  echo "OK    data/botns.db: ${DB_KB}KB (budget: ${DB_MAX_MB}MB)"
fi

# ── 2. Bundle size (web/dist, excluding botns.db) ─────────────────────────────

DIST_DIR="$ROOT/web/dist"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "ERROR: $DIST_DIR not found — run 'npm run build' first" >&2
  exit 1
fi

BUNDLE_BYTES=0
while IFS= read -r -d '' file; do
  size=$(wc -c < "$file")
  BUNDLE_BYTES=$(( BUNDLE_BYTES + size ))
done < <(find "$DIST_DIR" -type f ! -name "botns.db" -print0)

BUNDLE_KB=$(( BUNDLE_BYTES / 1024 ))

if (( BUNDLE_BYTES > BUNDLE_MAX_BYTES )); then
  echo "FAIL  web/dist bundle: ${BUNDLE_KB}KB — exceeds ${BUNDLE_MAX_MB}MB budget" >&2
  FAIL=1
else
  echo "OK    web/dist bundle: ${BUNDLE_KB}KB (budget: ${BUNDLE_MAX_MB}MB)"
fi

# ── Result ────────────────────────────────────────────────────────────────────

if (( FAIL )); then
  exit 1
fi
