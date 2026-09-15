import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCompanyResearch,selectResearchCompanies,mergeCompanyResearch,publicResearchStatus} from '../src/company-research.mjs';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}});}
async function mockFetch(input,init={}){
  const u=new URL(String(input));
  if(u.hostname==='api.gleif.org')return json({data:[{id:'OQSJ1DU9TAOC51A47K68',attributes:{lei:'OQSJ1DU9TAOC51A47K68',entity:{legalName:{name:'ACME CORPORATION'},legalAddress:{country:'US'},jurisdiction:'US-CA',status:'ACTIVE'},registration:{status:'ISSUED'}}}]});
  if(u.hostname==='www.wikidata.org')return json({search:[{id:'Q1',label:'Acme Corporation',description:'fixture manufacturer'}]});
  if(u.hostname==='www.sec.gov')return json({'0':{cik_str:123456,ticker:'ACME',title:'ACME CORPORATION'}});
  if(u.hostname==='labordata.bunkum.us'){
    if(u.pathname.includes('/nlrb/'))return json([{case_number:'01-CA-1',name:'Acme Corporation',state:'CA',date_filed:'2026-01-01'}]);
    if(u.pathname.includes('/osha_enforcement/'))return json([{activity_nr:1,estab_name:'ACME CORPORATION',site_state:'CA',open_date:'2026-02-01'}]);
    if(u.pathname.includes('/whisard/'))return json([{case_id:2,legal_name:'Acme Corporation',trade_nm:'Acme',st_cd:'CA',findings_end_date:'2026-03-01'}]);
    if(u.pathname.includes('/f7/'))return json([{employer:'Acme Corporation',employer_state:'CA',notice_date:'2026-04-01'}]);
    if(u.pathname.includes('/voluntary_recognitions/'))return json([{'Employer':'Acme Corporation','Unit State':'CA','VR Case Number':'VR-1'}]);
    if(u.pathname.includes('/work_stoppages/'))return json([{'Employer':'Acme Corporation','City, State':'Fixture, CA','Case Number':'WS-1'}]);
    if(u.pathname.includes('/lm20/'))return json([{rptId:3,empLabOrg:'Acme Corporation',empTrdName:'Acme',state:'CA',termDate:'2026-05-01'}]);
  }
  if(u.hostname==='api.usaspending.gov'){
    assert.equal(init.method,'POST');
    return json({results:[{recipient_name:'ACME CORPORATION',uei:'UEIACME'}]});
  }
  throw new Error('unexpected URL '+u.href);
}

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
