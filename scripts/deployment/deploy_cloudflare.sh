#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/cloudflare-backend"
CONFIG="$BACKEND/wrangler.production.jsonc"
SECRETS="$BACKEND/.production.secrets"
: "${LTP_FRONTEND_ORIGINS:?Set LTP_FRONTEND_ORIGINS to the exact comma-separated HTTPS frontend origin(s)}"
cd "$BACKEND"
WHOAMI="$(npx wrangler whoami 2>&1 || true)"
if printf '%s' "$WHOAMI" | grep -Eqi 'not authenticated|CLOUDFLARE_API_TOKEN|not logged in'; then echo "BLOCKED: Cloudflare CLI is not authenticated. Run: npx wrangler login" >&2; exit 12; fi
[[ -f "$CONFIG" ]] || { echo "BLOCKED: run scripts/deployment/bootstrap_cloudflare.sh first" >&2; exit 13; }
[[ -f "$SECRETS" ]] || "$ROOT/scripts/deployment/init_production_secrets.sh"
ARGS=(deploy -c "$CONFIG" --strict --secrets-file "$SECRETS" --var "LTP_ENV:production" --var "LTP_ALLOWED_ORIGINS:$LTP_FRONTEND_ORIGINS" --var "LTP_COOKIE_SECURE:true" --var "LTP_SEED:false" --var "LTP_RESEARCH_SCHEDULED:true" --var "LTP_RESEARCH_QUEUE_DISPATCH:true" --var "LTP_RESEARCH_MAX_COMPANIES_PER_RUN:${LTP_RESEARCH_MAX_COMPANIES_PER_RUN:-2}")
if [[ -n "${LTP_API_DOMAIN:-}" ]]; then ARGS+=(--domain "$LTP_API_DOMAIN"); fi
npx wrangler "${ARGS[@]}"
