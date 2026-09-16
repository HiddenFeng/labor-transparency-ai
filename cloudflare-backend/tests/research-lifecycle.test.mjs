import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {emptyState} from '../../sites-app/src/domain.mjs';
import {publicCompanyResearch,publicResearchStatus} from '../../sites-app/src/research-status.mjs';
import {createCompanyWithAutoResearch,dispatchCompanyResearch,consumeResearchQueueBatch,consumeResearchDeadLetterBatch,enqueueEligibleResearch,runResearchBatch} from '../src/worker.mjs';
import {selectResearchCompanies} from '../src/company-research.mjs';
import {mockResearchFetch,makeResearchFetch} from './research-fixture.mjs';

class MemoryStore{
  constructor(state=emptyState()){this.state=structuredClone(state);}
  async read(){return structuredClone(this.state);}
  async transaction(mutator){const draft=structuredClone(this.state);const out=await mutator(draft);this.state=draft;return out;}
}
const COMPANY={name:'ACME CORPORATION',region:'US',website:'https://example.com',consent:true};

test('new public company is durably queued then automatically collected and safely projected',async()=>{
  const store=new MemoryStore();
  const created=await createCompanyWithAutoResearch(store,COMPANY,'owner-fixture',{now:new Date('2026-09-16T00:00:00Z')});
  assert.equal(created.duplicate,false);
  assert.equal(created.researchQueued,true);
  assert.equal(created.research.status,'QUEUED');
  let state=await store.read();
  assert.equal(state.companyResearch.length,1);
  assert.equal(state.companyResearch[0].status,'QUEUED');
  assert.equal(selectResearchCompanies(state,2,{now:new Date('2026-09-16T00:01:00Z')})[0].id,created.company.id);

  const sent=[];
  const env={LTP_RESEARCH_QUEUE_DISPATCH:'true',COMPANY_RESEARCH_QUEUE:{async send(body){sent.push(body);}}};
  assert.equal(await dispatchCompanyResearch(env,created),'QUEUE_SENT');
  assert.equal(sent.length,1);assert.equal(sent[0].companyId,created.company.id);assert.equal(sent[0].allowRefresh,false);
  let acked=0,retried=0;
  const message={body:sent[0],attempts:1,ack(){acked++},retry(){retried++}};
  await consumeResearchQueueBatch({messages:[message]},env,{store,fetchImpl:mockResearchFetch,now:new Date('2026-09-16T00:01:00Z')});
  assert.equal(acked,1);assert.equal(retried,0);
  state=await store.read();
  const record=state.companyResearch[0];
  assert.equal(record.status,'AUTO_READY');
  assert.ok(record.candidateCount>=11);
  assert.equal(record.sourceErrorCount,0);
  assert.equal(record.reviewRequired,false);
  assert.equal(record.intelligence.identity.status,'AUTO_BOUND_REFERENCE');
  assert.ok(record.intelligence.facts.length>0);
  assert.ok(record.intelligence.signals.length>0);

  const projection=publicCompanyResearch(record);
  assert.equal(projection.status,'AUTO_READY');
  assert.equal(projection.reviewRequired,false);
  assert.equal(projection.intelligence.identity.status,'AUTO_BOUND_REFERENCE');
  assert.ok(projection.intelligence.facts.length>0);
  assert.ok(projection.intelligence.signals.length>0);
  assert.ok(projection.providers.some(x=>x.provider==='GLEIF'&&x.previews.some(p=>p.label==='ACME CORPORATION')));
  assert.ok(projection.providers.some(x=>x.provider==='NLRB_CASES'&&x.previews.some(p=>p.label==='Acme Corporation')));
  const serialized=JSON.stringify(projection);
  assert.equal(serialized.includes('case_number'),false);
  assert.equal(serialized.includes('records'),false);
  assert.equal(serialized.includes('reason_closed'),false);
  assert.match(projection.boundary,/候选/);
  const summary=publicResearchStatus(state);assert.equal(summary.completed,1);assert.equal(summary.pendingReview,0);assert.equal(summary.autonomousReady,1);assert.ok(summary.machineVerifiedFacts>0);assert.ok(summary.sourceSignals>0);

  let duplicateAck=0;
  await consumeResearchQueueBatch({messages:[{body:sent[0],attempts:1,ack(){duplicateAck++},retry(){assert.fail('completed duplicate must not retry')}}]},env,{store,fetchImpl:async()=>assert.fail('completed duplicate must not recollect'),now:new Date('2026-09-16T00:02:00Z')});
  assert.equal(duplicateAck,1);
});

test('duplicate company creation is idempotent and does not fan out a second queue record',async()=>{
  const store=new MemoryStore();
  const first=await createCompanyWithAutoResearch(store,COMPANY,'owner-a',{now:new Date('2026-09-16T00:00:00Z')});
  const second=await createCompanyWithAutoResearch(store,COMPANY,'owner-b',{now:new Date('2026-09-16T00:02:00Z')});
  assert.equal(first.company.id,second.company.id);
  assert.equal(second.duplicate,true);
  assert.equal(second.researchQueued,false);
  const state=await store.read();
  assert.equal(state.companies.length,1);
  assert.equal(state.companyResearch.length,1);
  assert.equal(state.companyResearch[0].status,'QUEUED');
});

test('one provider failure survives as an explicit source gap while other results remain displayable',async()=>{
  const store=new MemoryStore();
  await createCompanyWithAutoResearch(store,COMPANY,'owner',{now:new Date('2026-09-16T01:00:00Z')});
  const result=await runResearchBatch(store,{LTP_RESEARCH_MAX_COMPANIES_PER_RUN:'1'},{fetchImpl:makeResearchFetch({failProviders:['OSHA_ENFORCEMENT']}),now:new Date('2026-09-16T01:01:00Z')});
  assert.equal(result.processedCompanies,1);
  assert.equal(result.sourceErrors,1);
  const record=(await store.read()).companyResearch[0];
  assert.equal(record.status,'AUTO_READY_WITH_SOURCE_GAPS');
  assert.equal(record.providers.find(x=>x.provider==='OSHA_ENFORCEMENT').status,'ERROR');
  assert.equal(record.providers.find(x=>x.provider==='GLEIF').status,'OK');
  const projection=publicCompanyResearch(record);
  assert.equal(projection.providers.find(x=>x.provider==='OSHA_ENFORCEMENT').errorCode,'SOURCE_UNAVAILABLE');
  assert.ok(projection.providers.find(x=>x.provider==='GLEIF').previews.length>0);
});

test('scheduler prioritizes queued work, skips fresh completed work, and recovers stale collecting leases',()=>{
  const now=new Date('2026-09-16T02:00:00Z');
  const state={companies:[
    {id:'queued',name:'Queued',synthetic:false,createdAt:'2026-09-16T01:50:00Z'},
    {id:'fresh',name:'Fresh',synthetic:false,createdAt:'2026-09-15T00:00:00Z'},
    {id:'stale',name:'Stale',synthetic:false,createdAt:'2026-09-15T00:00:00Z'}
  ],companyResearch:[
    {id:'research_queued',companyId:'queued',status:'QUEUED',queuedAt:'2026-09-16T01:50:00Z'},
    {id:'research_fresh',companyId:'fresh',status:'AUTO_READY',collectedAt:'2026-09-16T01:00:00Z',intelligence:{policyVersion:'auto-intelligence-0.8.3',fingerprint:'fresh',facts:[],signals:[],conflicts:[],coverage:{}}},
    {id:'research_stale',companyId:'stale',status:'COLLECTING',startedAt:'2026-09-16T01:30:00Z',queuedAt:'2026-09-16T01:20:00Z'}
  ]};
  const selected=selectResearchCompanies(state,3,{now});
  assert.deepEqual(selected.map(x=>x.id),['queued','stale']);
});

test('legacy completed records without autonomous intelligence are selected immediately for self-migration',()=>{
  const now=new Date('2026-09-16T02:00:00Z');
  const state={companies:[{id:'legacy',name:'Legacy Co',synthetic:false,createdAt:'2026-09-16T01:55:00Z'}],companyResearch:[{id:'research_legacy',companyId:'legacy',status:'REVIEW_REQUIRED',reviewRequired:true,collectedAt:'2026-09-16T01:59:00Z'}]};
  const selected=selectResearchCompanies(state,2,{now});
  assert.deepEqual(selected.map(x=>x.id),['legacy']);
});

test('scheduled fallback only enqueues eligible work and leaves collection to the Queue consumer',async()=>{
  const store=new MemoryStore();
  const created=await createCompanyWithAutoResearch(store,COMPANY,'owner',{now:new Date('2026-09-16T03:00:00Z')});
  const batches=[];
  const env={LTP_RESEARCH_QUEUE_DISPATCH:'true',LTP_RESEARCH_MAX_COMPANIES_PER_RUN:'2',COMPANY_RESEARCH_QUEUE:{async sendBatch(messages){batches.push(messages);}}};
  const result=await enqueueEligibleResearch(store,env,{now:new Date('2026-09-16T03:01:00Z'),reason:'TEST_FALLBACK'});
  assert.equal(result.status,'QUEUE_SENT');assert.equal(result.enqueuedCompanies,1);assert.equal(result.companyIds[0],created.company.id);
  assert.equal(batches.length,1);assert.equal(batches[0][0].body.allowRefresh,true);assert.equal(batches[0][0].body.reason,'TEST_FALLBACK');
  assert.equal((await store.read()).companyResearch[0].status,'QUEUED');
});

test('dead-letter delivery is persisted and later self-heals through scheduled re-enqueue backoff',async()=>{
  const store=new MemoryStore();
  const created=await createCompanyWithAutoResearch(store,COMPANY,'owner',{now:new Date('2026-09-16T04:00:00Z')});
  await store.transaction(state=>{
    const r=state.companyResearch[0];r.status='COLLECTION_FAILED';r.failedAt='2026-09-16T04:00:00Z';r.failureCount=3;r.lastError='COLLECTION_RUNTIME_FAILED';return null;
  });
  let acked=0;
  await consumeResearchDeadLetterBatch({queue:'labor-transparency-company-research-dlq',messages:[{body:{type:'COMPANY_RESEARCH',companyId:created.company.id},ack(){acked++}}]}, {}, {store,now:new Date('2026-09-16T04:01:00Z')});
  assert.equal(acked,1);
  let state=await store.read();const failed=state.companyResearch[0];
  assert.equal(failed.status,'COLLECTION_FAILED');assert.equal(failed.lastError,'QUEUE_RETRIES_EXHAUSTED');assert.equal(failed.deadLetteredAt,'2026-09-16T04:01:00.000Z');
  assert.equal(selectResearchCompanies(state,2,{now:new Date('2026-09-16T05:59:00Z')}).length,0,'failureCount=3 backs off for two hours');
  assert.deepEqual(selectResearchCompanies(state,2,{now:new Date('2026-09-16T06:01:00Z')}).map(x=>x.id),[created.company.id]);
});

test('production config includes Queue producer/consumer guardrails and scheduled fallback crons',async()=>{
  const text=await fs.readFile(new URL('../wrangler.production.example.jsonc',import.meta.url),'utf8');
  assert.match(text,/COMPANY_RESEARCH_QUEUE/);
  assert.match(text,/labor-transparency-company-research-dlq/);
  assert.match(text,/"max_batch_size": 1/);
  assert.match(text,/"max_concurrency": 1/);
  assert.match(text,/"max_retries": 10/);
  assert.match(text,/"retry_delay": 300/);
  assert.match(text,/\*\/5 \* \* \* \*/);
  assert.match(text,/0 1 \* \* \*/);
  assert.match(text,/LTP_RESEARCH_MAX_COMPANIES_PER_RUN/);
});
