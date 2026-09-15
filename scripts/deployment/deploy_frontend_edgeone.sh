#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ "${LTP_ENABLE_LEGACY_EDGEONE:-false}" != "true" ]]; then
  echo "EdgeOne deployment is retired by the current Tencent-free privacy policy. Set LTP_ENABLE_LEGACY_EDGEONE=true only after a new explicit user approval." >&2
  exit 2
fi

: "${EDGEONE_API_TOKEN:?Set EDGEONE_API_TOKEN from the EdgeOne console}"
: "${EDGEONE_PROJECT_NAME:?Set EDGEONE_PROJECT_NAME}"
: "${LTP_PUBLIC_API_BASE:?Set LTP_PUBLIC_API_BASE to the HTTPS Cloudflare API origin or an approved same-site API gateway}"
rm -rf "$ROOT/deploy/frontend/dist"
LTP_PUBLIC_API_BASE="$LTP_PUBLIC_API_BASE" LTP_DEPLOYMENT_LABEL=edgeone-static node "$ROOT/deploy/frontend/build.mjs"
node "$ROOT/scripts/deployment/privacy_audit.mjs" "$ROOT/deploy/frontend/dist"
npx edgeone makers deploy "$ROOT/deploy/frontend/dist" -n "$EDGEONE_PROJECT_NAME" -t "$EDGEONE_API_TOKEN" -e production --area "${EDGEONE_AREA:-overseas}" --json
