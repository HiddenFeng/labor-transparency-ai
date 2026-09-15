#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
: "${LTP_PROXY_API_ORIGIN:?Set LTP_PROXY_API_ORIGIN to the deployed Cloudflare API origin, e.g. https://api.example.org}"
if ! vercel whoami >/dev/null 2>&1; then echo "BLOCKED: Vercel CLI is not authenticated. Run: vercel login" >&2; exit 12; fi
rm -rf "$ROOT/deploy/frontend/dist"
LTP_PROXY_API_ORIGIN="$LTP_PROXY_API_ORIGIN" LTP_DEPLOYMENT_LABEL=vercel-same-origin-proxy node "$ROOT/deploy/frontend/build.mjs"
node "$ROOT/scripts/deployment/privacy_audit.mjs" "$ROOT/deploy/frontend/dist"
vercel deploy "$ROOT/deploy/frontend/dist" --prod --yes
