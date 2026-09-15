#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/cloudflare-backend"
FRONTEND="$ROOT/deploy/frontend"
STATE="${TMPDIR:-/tmp}/ltp-split-verify-${RANDOM}-$$"
BPORT="${LTP_SPLIT_BACKEND_PORT:-8894}"
FPORT="${LTP_SPLIT_FRONTEND_PORT:-8895}"
BBASE="http://127.0.0.1:$BPORT"
FORIGIN="http://127.0.0.1:$FPORT"
ENVFILE="$STATE/dev.env"
BPID="";FPID=""
mkdir -p "$STATE"
cleanup(){
  [[ -n "$FPID" ]] && kill "$FPID" 2>/dev/null || true
  [[ -n "$BPID" ]] && kill "$BPID" 2>/dev/null || true
  [[ -n "$FPID" ]] && wait "$FPID" 2>/dev/null || true
  [[ -n "$BPID" ]] && wait "$BPID" 2>/dev/null || true
  rm -rf "$STATE"
}
trap cleanup EXIT
cat > "$ENVFILE" <<ENV
LTP_SESSION_SECRET=$(openssl rand -hex 32)
LTP_REVIEW_TOKEN=review-local-only
LTP_EXPORT_TOKEN=export-local-only
LTP_ADVISORY_AGENT_TOKEN=advisory-local-only
LTP_RESEARCH_AGENT_TOKEN=research-local-only
ENV
cd "$BACKEND"
npx wrangler d1 migrations apply DB --local --persist-to "$STATE" >/dev/null
npx wrangler dev --local --persist-to "$STATE" --test-scheduled --port "$BPORT" --env-file "$ENVFILE" --log-level warn \
  --var LTP_ENV:development --var "LTP_ALLOWED_ORIGINS:$FORIGIN" --var LTP_COOKIE_SECURE:false --var LTP_SEED:true --var LTP_RESEARCH_SCHEDULED:false --var LTP_RESEARCH_MAX_COMPANIES_PER_RUN:1 >"$STATE/backend.log" 2>&1 &
BPID=$!
for _ in $(seq 1 120); do curl -fsS "$BBASE/api/health" >/dev/null 2>&1 && break; kill -0 "$BPID" 2>/dev/null || { cat "$STATE/backend.log" >&2; exit 1; }; sleep .15; done
cd "$ROOT"
rm -rf "$FRONTEND/dist"
LTP_PROXY_API_ORIGIN="$BBASE" LTP_DEPLOYMENT_LABEL=local-same-origin-proxy node "$FRONTEND/build.mjs" >/dev/null
PORT="$FPORT" LTP_PROXY_API_ORIGIN="$BBASE" node "$FRONTEND/dev-server.mjs" >"$STATE/frontend.log" 2>&1 &
FPID=$!
for _ in $(seq 1 80); do curl -fsS "$FORIGIN/" >/dev/null 2>&1 && break; kill -0 "$FPID" 2>/dev/null || { cat "$STATE/frontend.log" >&2; exit 1; }; sleep .1; done
LTP_SMOKE_BASE="$FORIGIN" LTP_SMOKE_ORIGIN="$FORIGIN" node "$BACKEND/scripts-smoke.mjs"
node - "$FORIGIN" <<'NODE'
const base=process.argv[2];
const h=await fetch(base+'/api/health'); if(h.status!==200)throw new Error('proxied health failed');
const cfg=await (await fetch(base+'/api/config')).json(); if(cfg.mode!=='CLOUDFLARE_WORKER_D1')throw new Error('wrong proxied backend');
const rc=await (await fetch(base+'/runtime-config.js')).text(); if(!rc.includes('\"apiBase\":\"\"'))throw new Error('frontend is not same-origin proxy mode');
console.log(JSON.stringify({status:'PASS',sameOriginProxy:true,frontend:base,backendMode:cfg.mode}));
NODE
