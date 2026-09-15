#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/deploy/edgeone/dist"
: "${LTP_EDGEONE_UPSTREAM:?Set LTP_EDGEONE_UPSTREAM to the public HTTPS Cloudflare Worker origin}"

LTP_EDGEONE_UPSTREAM="$LTP_EDGEONE_UPSTREAM" \
LTP_DEPLOYMENT_LABEL="${LTP_DEPLOYMENT_LABEL:-edgeone-production-v0.8.1-rc2}" \
node "$ROOT/deploy/edgeone/build.mjs"
node "$ROOT/scripts/deployment/privacy_audit.mjs" "$OUT"

ARGS=(makers deploy "$OUT" -n "${LTP_EDGEONE_PROJECT_NAME:-labor-transparency-public}" -e production -a "${LTP_EDGEONE_AREA:-global}" --json)
if [[ "${LTP_EDGEONE_ANONYMOUS:-false}" == "true" ]]; then
  ARGS+=(--anonymous --site "${LTP_EDGEONE_SITE:-global}")
fi
npx --yes edgeone "${ARGS[@]}"
