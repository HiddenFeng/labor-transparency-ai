#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/cloudflare-backend/.production.secrets"
umask 077
touch "$OUT"
chmod 600 "$OUT"
ensure_secret(){
  local key="$1" mode="$2"
  if grep -q "^${key}=" "$OUT"; then return; fi
  local value
  if [[ "$mode" == hex ]]; then value="$(openssl rand -hex 48)"; else value="$(openssl rand -base64 36 | tr -d '\n')"; fi
  printf '%s=%s\n' "$key" "$value" >> "$OUT"
}
ensure_secret LTP_SESSION_SECRET hex
ensure_secret LTP_REVIEW_TOKEN b64
ensure_secret LTP_EXPORT_TOKEN b64
ensure_secret LTP_ADVISORY_AGENT_TOKEN b64
ensure_secret LTP_RESEARCH_AGENT_TOKEN b64
echo "Production secret file is complete and protected; values were not printed."
