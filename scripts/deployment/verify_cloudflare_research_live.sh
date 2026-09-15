#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/cloudflare-backend"
STATE="${TMPDIR:-/tmp}/ltp-cf-research-live-${RANDOM}-$$"
ENVFILE="$STATE/dev.env"
LOG="$STATE/wrangler.log"
OUT="${LTP_RESEARCH_LIVE_OUT:-$ROOT/qa/v0_8/cloudflare-live-research.json}"
PORT="${LTP_RESEARCH_LIVE_PORT:-8798}"
ORIGIN="http://127.0.0.1:${LTP_RESEARCH_LIVE_FRONTEND_PORT:-8799}"
BASE="http://127.0.0.1:$PORT"
PID=""
mkdir -p "$STATE" "$(dirname "$OUT")"
cleanup(){
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; fi
  rm -rf "$STATE"
}
trap cleanup EXIT
cat > "$ENVFILE" <<ENV
LTP_SESSION_SECRET=$(openssl rand -hex 32)
LTP_REVIEW_TOKEN=review-live-local-only
LTP_EXPORT_TOKEN=export-live-local-only
LTP_ADVISORY_AGENT_TOKEN=advisory-live-local-only
LTP_RESEARCH_AGENT_TOKEN=research-live-local-only
ENV
cd "$BACKEND"
npx wrangler d1 migrations apply DB --local --persist-to "$STATE" >/dev/null
start(){
  npx wrangler dev --local --persist-to "$STATE" --test-scheduled --port "$PORT" \
    --env-file "$ENVFILE" --log-level warn \
    --var LTP_ENV:development --var "LTP_ALLOWED_ORIGINS:$ORIGIN" --var LTP_COOKIE_SECURE:false --var LTP_SEED:false \
    --var LTP_RESEARCH_SCHEDULED:false --var LTP_RESEARCH_MAX_COMPANIES_PER_RUN:1 \
    >"$LOG" 2>&1 &
  PID=$!
  for _ in $(seq 1 120); do
    if curl -fsS "$BASE/api/health" >/dev/null 2>&1; then return; fi
    if ! kill -0 "$PID" 2>/dev/null; then cat "$LOG" >&2; return 1; fi
    sleep .2
  done
  cat "$LOG" >&2; return 1
}
start
BASE="$BASE" ORIGIN="$ORIGIN" OUT="$OUT" node <<'NODE'
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE,origin=process.env.ORIGIN,out=process.env.OUT;
let cookie='',csrf='';
async function req(path,{method='GET',body,token,originHeader=origin}={}){
 const headers={Accept:'application/json'};if(originHeader)headers.Origin=originHeader;if(cookie)headers.Cookie=cookie;
 if(body!==undefined){headers['Content-Type']='application/json';if(csrf)headers['X-LTP-CSRF']=csrf;}if(token)headers.Authorization=`Bearer ${token}`;
 const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:r.status,data:await r.json()};
}
const cfg=await req('/api/config');assert.equal(cfg.status,200);assert.equal(cfg.data.version,'0.8.1-rc.2');csrf=cfg.data.csrfToken;
const created=await req('/api/companies',{method:'POST',body:{name:'Starbucks Corporation',region:'US',website:'https://www.starbucks.com/',consent:true}});assert.equal(created.status,200);const companyId=created.data.company.id;
const run=await req('/api/research-agent/run',{method:'POST',token:'research-live-local-only',originHeader:'',body:{maxCompanies:1}});assert.equal(run.status,200,JSON.stringify(run.data));assert.equal(run.data.processedCompanies,1);assert.ok(run.data.candidateCount>0);
const queue=await req('/api/research-agent/queue',{token:'research-live-local-only'});assert.equal(queue.status,200);assert.equal(queue.data.items.length,1);const record=queue.data.items[0];assert.equal(record.companyId,companyId);assert.equal(record.status,'REVIEW_REQUIRED');
const providers=Object.fromEntries(record.providers.map(x=>[x.provider,{status:x.status,candidateCount:x.candidateCount,error:x.error||null}]));
for(const p of ['GLEIF','WIKIDATA','NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20','USA_SPENDING'])assert.ok(providers[p],p);
const publicStatus=await req('/api/research/status');assert.equal(publicStatus.status,200);assert.equal(publicStatus.data.companiesTracked,1);assert.equal(publicStatus.data.pendingReview,1);
const companies=await req('/api/companies');const publicCompany=companies.data.items.find(x=>x.id===companyId);assert.ok(publicCompany?.research);assert.equal(publicCompany.research.reviewRequired,true);const publicJson=JSON.stringify(publicCompany);assert.equal(publicJson.includes('sampleRecord'),false);assert.equal(publicJson.includes('externalId'),false);assert.equal(publicJson.includes('case_number'),false);
const result={status:'PASS_LIVE_CLOUDFLARE_RESEARCH_CANDIDATE_COLLECTION',version:cfg.data.version,company:{id:companyId,name:'Starbucks Corporation',region:'US'},processedCompanies:run.data.processedCompanies,candidateCount:run.data.candidateCount,sourceErrors:run.data.sourceErrors,providers,publicProjectionSafe:true,reviewRequired:true,boundary:'Live Worker collection stores source candidates only. No candidate was auto-bound, approved or published as a company fact.'};
await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
NODE
BEFORE="$(cat "$OUT")"
kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; PID=""
start
BASE="$BASE" OUT="$OUT" node <<'NODE'
import fs from 'node:fs/promises';import assert from 'node:assert/strict';const base=process.env.BASE,out=process.env.OUT;
const r=await fetch(base+'/api/research-agent/queue',{headers:{Authorization:'Bearer research-live-local-only'}});assert.equal(r.status,200);const data=await r.json();assert.equal(data.items.length,1);const artifact=JSON.parse(await fs.readFile(out,'utf8'));artifact.restartPersistence=true;await fs.writeFile(out,JSON.stringify(artifact,null,2)+'\n');console.log(JSON.stringify({status:'PASS_RESTART_PERSISTENCE',companyResearch:data.items.length}));
NODE
