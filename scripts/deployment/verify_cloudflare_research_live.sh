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
    --var LTP_RESEARCH_SCHEDULED:true --var LTP_RESEARCH_QUEUE_DISPATCH:true --var LTP_RESEARCH_MAX_COMPANIES_PER_RUN:1 \
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
const cfg=await req('/api/config');assert.equal(cfg.status,200);assert.equal(cfg.data.version,'0.9.0-rc.1');csrf=cfg.data.csrfToken;
const created=await req('/api/companies',{method:'POST',body:{name:'Starbucks Corporation',region:'US',website:'https://www.starbucks.com/',consent:true}});assert.equal(created.status,200);assert.equal(created.data.researchQueued,true);assert.equal(created.data.research.status,'QUEUED');assert.equal(created.data.researchDispatch,'QUEUE_SENT');const companyId=created.data.company.id;
let queue,record;
for(let i=0;i<160;i++){
  queue=await req('/api/research-agent/queue',{token:'research-live-local-only'});assert.equal(queue.status,200);assert.equal(queue.data.items.length,1);record=queue.data.items[0];
  if(!['QUEUED','COLLECTING'].includes(record.status))break;
  await new Promise(resolve=>setTimeout(resolve,250));
}
assert.equal(record.companyId,companyId);assert.ok(['AUTO_READY','AUTO_READY_WITH_SOURCE_GAPS'].includes(record.status),record.status);assert.ok(record.candidateCount>0);assert.equal(record.reviewRequired,false);assert.ok(record.intelligence);assert.equal(record.intelligence.policyVersion,'auto-intelligence-0.8.3');assert.ok(record.intelligence.coverage.machineVerifiedFacts>0);assert.ok(record.intelligence.coverage.sourceSignals>0);assert.ok(record.intelligence.coverage.publicEventCandidates>0);assert.equal(record.intelligence.dossier?.status,'REFERENCE_READY');assert.ok(record.intelligence.timeline?.length>0);
const providers=Object.fromEntries(record.providers.map(x=>[x.provider,{status:x.status,candidateCount:x.candidateCount,error:x.error||null}]));
for(const p of ['GLEIF','WIKIDATA','NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20','USA_SPENDING'])assert.ok(providers[p],p);
const publicStatus=await req('/api/research/status');assert.equal(publicStatus.status,200);assert.equal(publicStatus.data.companiesTracked,1);assert.equal(publicStatus.data.pendingReview,0);assert.equal(publicStatus.data.autonomousReady,1);assert.equal(publicStatus.data.dossierReady,1);assert.ok(publicStatus.data.machineVerifiedFacts>0);assert.ok(publicStatus.data.sourceSignals>0);assert.ok(publicStatus.data.publicEventCandidates>0);
const autonomyHealth=await req('/api/research/health');assert.equal(autonomyHealth.status,200);assert.equal(autonomyHealth.data.unattendedOperation,true);assert.equal(autonomyHealth.data.runtime.companyResearchQueue,true);assert.equal(autonomyHealth.data.selfHealing.manualOperatorRequired,false);assert.equal(autonomyHealth.data.missingCurrentPolicy,0);
const companies=await req('/api/companies');const publicCompany=companies.data.items.find(x=>x.id===companyId);assert.ok(publicCompany?.research);assert.equal(publicCompany.research.reviewRequired,false);assert.ok(publicCompany.research.intelligence?.facts?.length>0);assert.ok(publicCompany.research.intelligence?.signals?.length>0);assert.ok(publicCompany.research.providers.length>=10);assert.ok(publicCompany.research.providers.some(x=>x.previews?.length));const publicJson=JSON.stringify(publicCompany);assert.equal(publicJson.includes('sampleRecord'),false);assert.equal(publicJson.includes('externalId'),false);assert.equal(publicJson.includes('case_number'),false);assert.equal(publicJson.includes('records'),false);
const detail=await req(`/api/companies/${companyId}`);assert.equal(detail.status,200);assert.equal(detail.data.company.id,companyId);assert.equal(detail.data.research.intelligence.dossier.status,'REFERENCE_READY');assert.ok(detail.data.research.intelligence.timeline.length>0);const detailJson=JSON.stringify(detail.data);for(const forbidden of ['"owner"','"rightsNote"','"records"','"sampleRecord"'])assert.equal(detailJson.includes(forbidden),false);
const result={status:'PASS_LIVE_AUTONOMOUS_COMPANY_DOSSIER',version:cfg.data.version,company:{id:companyId,name:'Starbucks Corporation',region:'US'},trigger:'USER_CREATE_DIRECT_QUEUE_CONSUMER',researchDispatch:created.data.researchDispatch,researchStatus:record.status,processedCompanies:1,candidateCount:record.candidateCount,sourceErrors:record.sourceErrorCount,machineVerifiedFacts:record.intelligence.coverage.machineVerifiedFacts,sourceSignals:record.intelligence.coverage.sourceSignals,publicEventCandidates:record.intelligence.coverage.publicEventCandidates,dossierStatus:record.intelligence.dossier.status,identityStatus:record.intelligence.identity.status,clusterCount:record.intelligence.clusters?.length||0,healthStatus:autonomyHealth.data.status,unattendedOperation:autonomyHealth.data.unattendedOperation,providers,publicProjectionSafe:true,publicDossierEndpoint:true,publicProviderCount:publicCompany.research.providers.length,reviewRequired:false,boundary:'Live Worker Queue consumer produces an evidence-scoped public dossier. Legal references, open context, source signals and event candidates remain separate; ambiguous or legally interpretive material is not promoted to broad company conclusions.'};
await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
NODE
BEFORE="$(cat "$OUT")"
kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; PID=""
start
BASE="$BASE" OUT="$OUT" node <<'NODE'
import fs from 'node:fs/promises';import assert from 'node:assert/strict';const base=process.env.BASE,out=process.env.OUT;
const r=await fetch(base+'/api/research-agent/queue',{headers:{Authorization:'Bearer research-live-local-only'}});assert.equal(r.status,200);const data=await r.json();assert.equal(data.items.length,1);const artifact=JSON.parse(await fs.readFile(out,'utf8'));artifact.restartPersistence=true;await fs.writeFile(out,JSON.stringify(artifact,null,2)+'\n');console.log(JSON.stringify({status:'PASS_RESTART_PERSISTENCE',companyResearch:data.items.length}));
NODE
