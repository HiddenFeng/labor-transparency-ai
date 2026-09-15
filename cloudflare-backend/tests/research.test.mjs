import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCompanyResearch,selectResearchCompanies,mergeCompanyResearch} from '../src/company-research.mjs';
import {publicResearchStatus} from '../../sites-app/src/research-status.mjs';
import {mockResearchFetch as mockFetch} from './research-fixture.mjs';

test('Cloudflare research collector stores bounded source candidates, not facts',async()=>{
  const record=await collectCompanyResearch({id:'co_1',name:'ACME CORPORATION',region:'US',synthetic:false},{fetchImpl:mockFetch,now:new Date('2026-09-15T00:00:00Z')});
  assert.equal(record.status,'REVIEW_REQUIRED');
  assert.equal(record.reviewRequired,true);
  assert.equal(record.sourceErrorCount,0);
  const providers=new Set(record.providers.map(x=>x.provider));
  for(const p of ['GLEIF','WIKIDATA','SEC_EDGAR','NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20','USA_SPENDING'])assert.ok(providers.has(p),p);
  assert.ok(record.candidateCount>=11);
  assert.ok(record.exactNameCandidateCount>=3);
  const nlrb=record.providers.find(x=>x.provider==='NLRB_CASES').candidates[0];assert.equal(Array.isArray(nlrb.records),true);assert.equal(nlrb.records[0].case_number,'01-CA-1');
  assert.equal(JSON.stringify(record).includes('private'),false);
});

test('research scheduling rotates oldest non-synthetic companies and persistence is explicit',()=>{
  const state={companies:[{id:'a',name:'A',synthetic:false},{id:'b',name:'B',synthetic:false},{id:'demo',name:'Demo',synthetic:true}],companyResearch:[{id:'research_a',companyId:'a',collectedAt:'2026-09-15T01:00:00Z',status:'REVIEW_REQUIRED',reviewRequired:true}]};
  assert.equal(selectResearchCompanies(state,1)[0].id,'b');
  mergeCompanyResearch(state,[{id:'research_b',companyId:'b',collectedAt:'2026-09-15T02:00:00Z',status:'REVIEW_REQUIRED',reviewRequired:true,candidateCount:3,sourceErrorCount:1}]);
  const summary=publicResearchStatus(state);
  assert.equal(summary.companiesTracked,2);assert.equal(summary.pendingReview,2);assert.equal(summary.sourceErrors,1);
});
