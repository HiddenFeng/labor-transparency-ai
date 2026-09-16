import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCompanyResearch,selectResearchCompanies,mergeCompanyResearch} from '../src/company-research.mjs';
import {publicResearchStatus} from '../../sites-app/src/research-status.mjs';
import {mockResearchFetch as mockFetch} from './research-fixture.mjs';

test('Cloudflare research collector stores bounded candidates plus autonomous evidence-scoped intelligence',async()=>{
  const record=await collectCompanyResearch({id:'co_1',name:'ACME CORPORATION',region:'US',synthetic:false},{fetchImpl:mockFetch,now:new Date('2026-09-15T00:00:00Z')});
  assert.equal(record.status,'AUTO_READY');
  assert.equal(record.reviewRequired,false);
  assert.equal(record.sourceErrorCount,0);
  const providers=new Set(record.providers.map(x=>x.provider));
  for(const p of ['GLEIF','WIKIDATA','SEC_EDGAR','NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20','USA_SPENDING'])assert.ok(providers.has(p),p);
  assert.ok(record.candidateCount>=11);
  assert.ok(record.exactNameCandidateCount>=3);
  assert.equal(record.intelligence.identity.status,'AUTO_BOUND_REFERENCE');
  assert.ok(record.intelligence.facts.length>0);
  assert.ok(record.intelligence.signals.length>0);
  const nlrb=record.providers.find(x=>x.provider==='NLRB_CASES').candidates[0];assert.equal(Array.isArray(nlrb.records),true);assert.equal(nlrb.records[0].case_number,'01-CA-1');
  assert.equal(JSON.stringify(record).includes('private'),false);
});

test('non-US companies run global sources only and keep regional sources explicitly not applicable',async()=>{
  const record=await collectCompanyResearch({id:'co_cn',name:'星宇股份有限公司',region:'中国',website:'',synthetic:false},{fetchImpl:mockFetch,now:new Date('2026-09-15T00:00:00Z')});
  assert.equal(record.status,'AUTO_READY');
  assert.equal(record.sourceErrorCount,0);
  assert.equal(record.sourceSuccessCount,2);
  assert.equal(record.sourceNotApplicableCount,9);
  const by=Object.fromEntries(record.providers.map(x=>[x.provider,x]));
  assert.equal(by.GLEIF.status,'OK');
  assert.equal(by.WIKIDATA.status,'OK');
  for(const p of ['SEC_EDGAR','NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20','USA_SPENDING']){
    assert.equal(by[p].status,'NOT_APPLICABLE',p);assert.equal(by[p].reason,'US_ONLY_SOURCE');
  }
  assert.equal(record.intelligence.identity.status,'NO_VERIFIED_REFERENCE');
  assert.equal(record.intelligence.contextReferences.length,1,'unique corporate shorthand + matching country + organization signals may bind open context only');
  const candidate=record.intelligence.contextReferences[0];
  assert.equal(candidate.reference,'QCN');assert.equal(candidate.label,'常州星宇车灯股份有限公司');
  assert.equal(candidate.officialWebsite,'https://www.xyl.cn/');assert.ok(candidate.products.includes('汽车灯'));
  assert.equal(candidate.basis,'UNIQUE_CORPORATE_SHORTHAND_AND_COUNTRY');assert.equal(candidate.confidence,'LOW_MEDIUM');
  assert.equal(record.intelligence.facts.length,0,'open context must not upgrade legal identity facts');
  assert.equal(record.intelligence.dossier.status,'CONTEXT_READY');
  assert.ok(record.intelligence.dossier.gaps.some(x=>x.code==='REGION_LIMITED_SOURCES'));
});

test('user-provided public website can bind a Wikidata context reference without upgrading legal identity',async()=>{
  const record=await collectCompanyResearch({id:'co_cn_site',name:'星宇股份有限公司',region:'中国',website:'https://www.xyl.cn/',synthetic:false},{fetchImpl:mockFetch,now:new Date('2026-09-15T00:00:00Z')});
  assert.equal(record.intelligence.identity.status,'NO_VERIFIED_REFERENCE');
  assert.equal(record.intelligence.facts.length,0);
  assert.equal(record.intelligence.contextReferences.length,1);
  assert.equal(record.intelligence.contextReferences[0].reference,'QCN');
  assert.equal(record.intelligence.contextReferences[0].basis,'OFFICIAL_WEBSITE_DOMAIN_MATCH');
  assert.equal(record.intelligence.dossier.status,'CONTEXT_READY');
});

test('research scheduling rotates oldest non-synthetic companies and persistence is explicit',()=>{
  const state={companies:[{id:'a',name:'A',synthetic:false},{id:'b',name:'B',synthetic:false},{id:'demo',name:'Demo',synthetic:true}],companyResearch:[{id:'research_a',companyId:'a',collectedAt:'2026-09-15T01:00:00Z',status:'AUTO_READY',reviewRequired:false,intelligence:{fingerprint:'a',coverage:{machineVerifiedFacts:1,sourceSignals:0},conflicts:[]}}]};
  assert.equal(selectResearchCompanies(state,1)[0].id,'b');
  mergeCompanyResearch(state,[{id:'research_b',companyId:'b',collectedAt:'2026-09-15T02:00:00Z',status:'AUTO_READY_WITH_SOURCE_GAPS',reviewRequired:false,candidateCount:3,sourceErrorCount:1,intelligence:{fingerprint:'b',coverage:{machineVerifiedFacts:0,sourceSignals:1},conflicts:[]}}]);
  const summary=publicResearchStatus(state);
  assert.equal(summary.companiesTracked,2);assert.equal(summary.pendingReview,0);assert.equal(summary.autonomousReady,2);assert.equal(summary.machineVerifiedFacts,1);assert.equal(summary.sourceSignals,1);assert.equal(summary.sourceErrors,1);
});
