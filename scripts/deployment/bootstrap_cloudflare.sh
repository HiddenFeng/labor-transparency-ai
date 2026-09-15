#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/cloudflare-backend"
CONFIG="$BACKEND/wrangler.production.jsonc"
EXAMPLE="$BACKEND/wrangler.production.example.jsonc"
cd "$BACKEND"
WHOAMI="$(npx wrangler whoami 2>&1 || true)"
if printf '%s' "$WHOAMI" | grep -Eqi 'not authenticated|CLOUDFLARE_API_TOKEN|not logged in'; then
  echo "BLOCKED: Cloudflare CLI is not authenticated. Run: npx wrangler login" >&2
  exit 12
fi
if [[ ! -f "$CONFIG" ]]; then cp "$EXAMPLE" "$CONFIG"; fi
if ! grep -q '"d1_databases"' "$CONFIG"; then
  echo "Creating D1 database in APAC and binding it as DB..."
  npx wrangler d1 create labor-transparency --location apac --binding DB --update-config -c "$CONFIG"
fi
npx wrangler d1 migrations apply DB --remote -c "$CONFIG"
echo "Cloudflare D1 bootstrap complete."
