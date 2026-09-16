#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS="$ROOT/cloudflare-backend/.production.secrets"
SERVICE="labor-transparency-community-agent"
ACCOUNT="labor-transparency-ai"
[[ -f "$SECRETS" ]] || { echo "Production secret file is missing" >&2; exit 2; }
VALUE="$(awk -F= '$1=="LTP_COMMUNITY_AGENT_TOKEN"{sub(/^[^=]*=/,""); print; exit}' "$SECRETS")"
[[ -n "$VALUE" ]] || { echo "Community Agent token is missing" >&2; exit 3; }
security add-generic-password -a "$ACCOUNT" -s "$SERVICE" -w "$VALUE" -U >/dev/null 2>&1
unset VALUE
security find-generic-password -a "$ACCOUNT" -s "$SERVICE" >/dev/null 2>&1
echo "Local community-agent Keychain credential is installed; value was not printed."
