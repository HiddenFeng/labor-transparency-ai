#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/cloudflare-backend"
STATE="${TMPDIR:-/tmp}/ltp-cf-verify-${RANDOM}-$$"
ENVFILE="$STATE/dev.env"
LOG="$STATE/wrangler.log"
PORT="${LTP_VERIFY_PORT:-8792}"
ORIGIN="http://127.0.0.1:${LTP_VERIFY_FRONTEND_PORT:-8793}"
BASE="http://127.0.0.1:$PORT"
PID=""
mkdir -p "$STATE"
cleanup(){
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; fi
  rm -rf "$STATE"
}
trap cleanup EXIT
cat > "$ENVFILE" <<ENV
LTP_SESSION_SECRET=$(openssl rand -hex 32)
LTP_REVIEW_TOKEN=review-local-only
LTP_EXPORT_TOKEN=export-local-only
LTP_ADVISORY_AGENT_TOKEN=advisory-local-only
LTP_RESEARCH_AGENT_TOKEN=research-local-only
LTP_COMMUNITY_AGENT_TOKEN=community-local-only
ENV

cd "$BACKEND"
npx wrangler d1 migrations apply DB --local --persist-to "$STATE" >/dev/null
start(){
  npx wrangler dev --local --persist-to "$STATE" --test-scheduled --port "$PORT" \
    --env-file "$ENVFILE" --log-level warn \
    --var LTP_ENV:development --var "LTP_ALLOWED_ORIGINS:$ORIGIN" --var LTP_COOKIE_SECURE:false --var LTP_SEED:true --var LTP_RESEARCH_SCHEDULED:false --var LTP_RESEARCH_QUEUE_DISPATCH:false --var LTP_RESEARCH_MAX_COMPANIES_PER_RUN:1 \
    >"$LOG" 2>&1 &
  PID=$!
  for _ in $(seq 1 100); do
    if curl -fsS "$BASE/api/health" >/dev/null 2>&1; then return; fi
    if ! kill -0 "$PID" 2>/dev/null; then cat "$LOG" >&2; return 1; fi
    sleep .15
  done
  cat "$LOG" >&2
  return 1
}
start
LTP_SMOKE_BASE="$BASE" LTP_SMOKE_ORIGIN="$ORIGIN" node "$BACKEND/scripts-smoke.mjs"
curl -fsS "$BASE/__scheduled" | grep -q 'Ran scheduled event'
BEFORE="$(node - "$BASE" <<'NODE'
const base=process.argv[2];const c=await (await fetch(base+'/api/companies')).json();const r=await (await fetch(base+'/api/advisory/reports?limit=10')).json();console.log(JSON.stringify({companies:c.items.length,reports:r.items.length,advised:r.items[0]?.advisedCount||0}));
NODE
)"
kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; PID=""
start
AFTER="$(node - "$BASE" <<'NODE'
const base=process.argv[2];const c=await (await fetch(base+'/api/companies')).json();const r=await (await fetch(base+'/api/advisory/reports?limit=10')).json();console.log(JSON.stringify({companies:c.items.length,reports:r.items.length,advised:r.items[0]?.advisedCount||0}));
NODE
)"
[[ "$BEFORE" == "$AFTER" ]] || { echo "persistence mismatch before=$BEFORE after=$AFTER" >&2; exit 2; }
echo "{\"status\":\"PASS\",\"worker\":\"0.8.4-rc.2\",\"restartPersistence\":true,\"state\":$AFTER}"
