#!/usr/bin/env node
// LocalAgentRuntime production-control fallback for this project Mac.
// Used only when the canonical Worker API is unreachable from command-line networking.
// It keeps project semantics by using the same domain mutators and the existing D1 write lock.
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import {
  VERSION,emptyState,upgradeState,nowIso,
  upsertOfficialReferences,upsertOfficialRelations,communityAgentQueue,
  respondCommunityFeedback,addPublicAnnouncement,publicAnnouncements,recordAgentDailyRun
} from '../../sites-app/src/domain.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const CF=path.join(ROOT,'cloudflare-backend');
const CONFIG='wrangler.production.jsonc';
const ALL_COLLECTIONS=[
  'companies','contributions','reviews','exportReviews','ballots','flags',
  'advisoryCases','advisoryAdvice','advisoryDailyReports','companyResearch',
  'officialReferences','officialRelations','communityFeedback','communityFeedbackResponses','publicAnnouncements','agentDailyRuns'
];
const MUTABLE=new Set(['officialReferences','officialRelations','communityFeedback','communityFeedbackResponses','publicAnnouncements','agentDailyRuns']);

function quote(value){return `'${String(value??'').replaceAll('\0','').replaceAll("'","''")}'`;}
function runD1(sql){
  const out=execFileSync('npx',['wrangler','d1','execute','DB','--remote','--config',CONFIG,'--command',sql,'--json'],{
    cwd:CF,encoding:'utf8',timeout:60000,maxBuffer:32*1024*1024,env:{...process.env,NO_COLOR:'1'}
  });
  const parsed=JSON.parse(out);
  if(!Array.isArray(parsed)||parsed.some(x=>x?.success!==true))throw new Error('Wrangler D1 command did not return a successful JSON result set');
  return parsed;
}
function sleep(ms){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}
function readState(){
  const result=runD1(`SELECT revision,schema_version,app_version,created_at,updated_at FROM ltp_meta WHERE id=1; SELECT collection,id,json FROM ltp_records ORDER BY collection,id;`);
  const meta=result[0]?.results?.[0];if(!meta)throw new Error('production D1 meta missing');
  const state=emptyState();for(const key of ALL_COLLECTIONS)state[key]=[];
  for(const row of result[1]?.results||[]){
    if(!ALL_COLLECTIONS.includes(row.collection))continue;
    state[row.collection].push(JSON.parse(row.json));
  }
  state.schemaVersion=String(meta.schema_version||'0.8');state.version=VERSION;state.revision=Number(meta.revision||0);state.createdAt=String(meta.created_at||nowIso());
  return upgradeState(state);
}
function acquireLock(){
  const holder=`daily-fallback-${crypto.randomUUID()}`;
  for(let i=0;i<10;i++){
    const now=Date.now(),expires=now+90000;
    const result=runD1(`INSERT INTO ltp_write_lock(id,holder,expires_at) VALUES('state',${quote(holder)},${expires}) ON CONFLICT(id) DO UPDATE SET holder=excluded.holder, expires_at=excluded.expires_at WHERE ltp_write_lock.expires_at < ${now} OR ltp_write_lock.holder = excluded.holder; SELECT holder,expires_at FROM ltp_write_lock WHERE id='state';`);
    if(result.at(-1)?.results?.[0]?.holder===holder)return holder;
    sleep(300+Math.floor(Math.random()*250));
  }
  throw new Error('production D1 write lock is busy');
}
function releaseLock(holder){
  try{runD1(`DELETE FROM ltp_write_lock WHERE id='state' AND holder=${quote(holder)};`);}catch{/* lease expiry remains the fail-safe */}
}
function itemMap(rows){return new Map((rows||[]).map(x=>[String(x.id),x]));}
function persistAllowedDiff(before,after){
  const statements=[];const stamp=nowIso();
  for(const collection of MUTABLE){
    const oldMap=itemMap(before[collection]),newMap=itemMap(after[collection]);
    for(const id of oldMap.keys())if(!newMap.has(id))statements.push(`DELETE FROM ltp_records WHERE collection=${quote(collection)} AND id=${quote(id)};`);
    for(const [id,item] of newMap){
      const next=JSON.stringify(item),prev=oldMap.has(id)?JSON.stringify(oldMap.get(id)):null;
      if(next!==prev)statements.push(`INSERT INTO ltp_records(collection,id,json,updated_at) VALUES(${quote(collection)},${quote(id)},${quote(next)},${quote(stamp)}) ON CONFLICT(collection,id) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at;`);
    }
  }
  if(!statements.length)return before.revision;
  statements.push(`UPDATE ltp_meta SET revision=${before.revision+1},schema_version='0.8',app_version=${quote(VERSION)},updated_at=${quote(stamp)} WHERE id=1 AND revision=${before.revision};`);
  statements.push(`SELECT revision FROM ltp_meta WHERE id=1;`);
  const result=runD1(statements.join('\n'));
  const revision=Number(result.at(-1)?.results?.[0]?.revision??-1);
  if(revision!==before.revision+1)throw new Error(`production D1 optimistic revision check failed: expected ${before.revision+1}, got ${revision}`);
  return revision;
}
function communityState(state){
  return {
    companies:(state.companies||[]).filter(x=>!x.synthetic).map(x=>({id:x.id,name:x.name,region:x.region,website:x.website||''})),
    pendingFeedback:communityAgentQueue(state),officialReferenceCount:Number(state.officialReferences?.length||0),officialRelationCount:Number(state.officialRelations?.length||0),
    latestAnnouncements:publicAnnouncements(state,7),
    dailyRuns:(state.agentDailyRuns||[]).slice().sort((a,b)=>b.day.localeCompare(a.day)||b.phase.localeCompare(a.phase)).slice(0,14).map(x=>({day:x.day,phase:x.phase,status:x.status,summary:x.summary,metrics:x.metrics||{},logRef:x.logRef||'',updatedAt:x.updatedAt}))
  };
}
function publicCompanies(state){return {items:(state.companies||[]).map(x=>({id:x.id,name:x.name,region:x.region,website:x.website||'',synthetic:Boolean(x.synthetic)}))};}
function readStdin(){const raw=fs.readFileSync(0,'utf8');return raw?JSON.parse(raw):{};}

function handleRead(method,pathname){
  if(method!=='GET')return null;const state=readState();
  if(pathname==='/api/companies')return publicCompanies(state);
  if(pathname==='/api/community-agent/state')return communityState(state);
  if(pathname==='/api/community-agent/queue')return {items:communityAgentQueue(state)};
  return null;
}
function handleMutation(method,pathname,payload){
  if(method!=='POST')return null;
  const holder=acquireLock();
  try{
    const before=readState(),state=structuredClone(before);let out;
    if(pathname==='/api/community-agent/official-relations')out=upsertOfficialRelations(state,payload);
    else if(pathname==='/api/community-agent/official-references')out=upsertOfficialReferences(state,payload);
    else if(pathname==='/api/community-agent/announcements')out=addPublicAnnouncement(state,payload,'daily-community-agent');
    else if(pathname==='/api/community-agent/daily-run')out=recordAgentDailyRun(state,payload,'daily-community-agent');
    else {
      const match=pathname.match(/^\/api\/community-agent\/feedback\/([^/]+)\/respond$/);
      if(match)out=respondCommunityFeedback(state,match[1],payload,'daily-community-agent');
      else return null;
    }
    const revision=persistAllowedDiff(before,state);
    const check=readState();if(check.revision!==revision)throw new Error('production D1 read-back revision mismatch');
    if(pathname.endsWith('/official-relations')||pathname.endsWith('/official-references'))return {savedCount:out.savedCount,revision,fallback:'WRANGLER_D1'};
    if(pathname.endsWith('/announcements'))return {id:out.id,day:out.day,updatedAt:out.updatedAt,revision,fallback:'WRANGLER_D1'};
    if(pathname.endsWith('/daily-run'))return {id:out.id,day:out.day,phase:out.phase,status:out.status,updatedAt:out.updatedAt,revision,fallback:'WRANGLER_D1'};
    return {id:out.id,feedbackId:out.feedbackId,decision:out.decision,createdAt:out.createdAt,revision,fallback:'WRANGLER_D1'};
  }finally{releaseLock(holder);}
}

const method=String(process.argv[2]||'GET').toUpperCase();const pathname=String(process.argv[3]||'');
if(!pathname.startsWith('/api/'))throw new Error('fallback requires an API pathname');
const read=handleRead(method,pathname);if(read!==null){process.stdout.write(JSON.stringify(read));process.exit(0);}
const payload=readStdin();const mutated=handleMutation(method,pathname,payload);if(mutated!==null){process.stdout.write(JSON.stringify(mutated));process.exit(0);}
throw new Error(`unsupported D1 fallback route: ${method} ${pathname}`);
