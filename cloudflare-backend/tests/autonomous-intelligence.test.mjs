import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAutonomousIntelligence,publicAutonomousIntelligence,researchAutonomyHealth,countryCode,AUTONOMOUS_INTELLIGENCE_POLICY_VERSION} from '../../sites-app/src/autonomous-intelligence.mjs';
import {mergeCompanyResearch} from '../src/company-research.mjs';

const source=(name)=>({sourceOfRecord:name,official:'https://example.org/'+name});
function record(providers=[]){return {sourceSuccessCount:providers.filter(x=>x.status!=='ERROR').length,sourceErrorCount:providers.filter(x=>x.status==='ERROR').length,providers};}
function provider(name,candidates=[],status='OK'){return {provider:name,status,candidateCount:candidates.length,candidates,error:status==='ERROR'?'SOURCE_TIMEOUT':undefined,source:source(name)};}
const company={id:'co_test',name:'ACME CORPORATION',region:'US',synthetic:false};

function gleifCandidate(overrides={}){return {provider:'GLEIF',externalId:'OQSJ1DU9TAOC51A47K68',label:'ACME CORPORATION',region:'US',jurisdiction:'US-DE',entityStatus:'ACTIVE',registrationStatus:'ISSUED',match:'EXACT_NAME',...overrides};}

test('unique exact GLEIF identity auto-binds narrow reference facts and compatible SEC reference',()=>{
  const r=record([
    provider('GLEIF',[gleifCandidate()]),
    provider('SEC_EDGAR',[{provider:'SEC_EDGAR',externalId:'0000123456',label:'ACME CORPORATION',region:'US',ticker:'ACME',match:'EXACT_NAME'}]),
    provider('NLRB_CASES',[{provider:'NLRB_CASES',externalId:'ACME CORPORATION',label:'ACME CORPORATION',region:'CA',matches:2,matchBasis:'case-name candidate'}])
  ]);
  const out=buildAutonomousIntelligence(company,r,{now:new Date('2026-09-16T00:00:00Z')});
  assert.equal(out.identity.status,'AUTO_BOUND_REFERENCE');
  assert.equal(out.identity.reference.lei,'OQSJ1DU9TAOC51A47K68');
  assert.ok(out.facts.some(x=>x.type==='lei'));
  assert.ok(out.facts.some(x=>x.type==='sec_reference'));
  assert.equal(out.signals.find(x=>x.provider==='NLRB_CASES').recordCount,2);
  assert.equal(out.conflicts.length,0);
  assert.equal(out.status,'MACHINE_INTELLIGENCE_READY');
});

test('identity automation requires an explicit machine-readable country hint and supports bounded QA suffixes',()=>{
  assert.equal(countryCode('US · production-auto-research-e2e-abc'),'US');
  assert.equal(countryCode('中国 · 华东'),'CN');
  const missing=buildAutonomousIntelligence({...company,region:'华东地区'},record([provider('GLEIF',[gleifCandidate()])]),{now:new Date('2026-09-16T00:00:00Z')});
  assert.equal(missing.identity.status,'COUNTRY_HINT_REQUIRED');
  assert.equal(missing.facts.length,0);
  assert.ok(missing.conflicts.some(x=>x.code==='COUNTRY_HINT_REQUIRED'));
});

test('country conflict and multiple exact identities fail closed without machine identity facts',()=>{
  const conflict=buildAutonomousIntelligence(company,record([provider('GLEIF',[gleifCandidate({region:'CN'})])]),{now:new Date('2026-09-16T00:00:00Z')});
  assert.equal(conflict.identity.status,'COUNTRY_CONFLICT');
  assert.equal(conflict.facts.length,0);
  assert.ok(conflict.conflicts.some(x=>x.code==='GLEIF_COUNTRY_CONFLICT'));

  const ambiguous=buildAutonomousIntelligence(company,record([provider('GLEIF',[gleifCandidate(),gleifCandidate({externalId:'549300TEST0000000099'})])]),{now:new Date('2026-09-16T00:00:00Z')});
  assert.equal(ambiguous.identity.status,'AMBIGUOUS');
  assert.equal(ambiguous.facts.length,0);
  assert.ok(ambiguous.conflicts.some(x=>x.code==='MULTIPLE_EXACT_GLEIF_MATCHES'));
});

test('invalid LEI or CIK values never become machine-verified reference facts',()=>{
  const badLei=buildAutonomousIntelligence(company,record([provider('GLEIF',[gleifCandidate({externalId:'549300TEST0000000012'})])]),{now:new Date('2026-09-16T00:00:00Z')});
  assert.equal(badLei.identity.status,'SOURCE_SCHEMA_CONFLICT');
  assert.equal(badLei.facts.length,0);
  assert.ok(badLei.conflicts.some(x=>x.code==='GLEIF_LEI_INVALID'));

  const badCik=buildAutonomousIntelligence(company,record([
    provider('GLEIF',[gleifCandidate()]),
    provider('SEC_EDGAR',[{provider:'SEC_EDGAR',externalId:'NOT-A-CIK',label:'ACME CORPORATION',region:'US',ticker:'ACME',match:'EXACT_NAME'}])
  ]));
  assert.equal(badCik.identity.status,'AUTO_BOUND_REFERENCE');
  assert.equal(badCik.facts.some(x=>x.type==='sec_reference'),false);
  assert.ok(badCik.signals.some(x=>x.provider==='SEC_EDGAR'));
});

test('labor exact-name records become source signals, never misconduct facts',()=>{
  const out=buildAutonomousIntelligence(company,record([
    provider('GLEIF',[]),
    provider('OSHA_ENFORCEMENT',[{provider:'OSHA_ENFORCEMENT',externalId:'ACME CORPORATION',label:'ACME CORPORATION',region:'CA',matches:5,matchBasis:'OSHA establishment candidate'}]),
    provider('DOL_WHD',[{provider:'DOL_WHD',externalId:'ACME CORPORATION',label:'ACME CORPORATION',region:'CA',matches:1,matchBasis:'WHD employer candidate'}])
  ]));
  assert.equal(out.facts.length,0);
  assert.equal(out.signals.length,2);
  assert.ok(out.signals.every(x=>x.tier==='SOURCE_SIGNAL'));
  assert.ok(out.signals.find(x=>x.provider==='OSHA_ENFORCEMENT').caveat.includes('不能外推'));
  assert.equal(JSON.stringify(out).includes('违法认定。'),false);
});

test('Wikidata exact-name matches remain contextual candidates and never become machine facts',()=>{
  const out=buildAutonomousIntelligence(company,record([
    provider('WIKIDATA',[{provider:'WIKIDATA',externalId:'Q123',label:'ACME CORPORATION',region:'GLOBAL',description:'sample manufacturer',match:'EXACT_NAME'}])
  ]));
  assert.equal(out.facts.length,0);
  assert.equal(out.contextCandidates.length,1);
  assert.equal(out.contextCandidates[0].tier,'CONTEXT_CANDIDATE');
  assert.match(out.contextCandidates[0].caveat,/不自动成为公司/);
});

test('refresh replacement retracts unsupported machine facts and records fingerprint change',()=>{
  const firstIntelligence=buildAutonomousIntelligence(company,record([provider('GLEIF',[gleifCandidate()])]),{now:new Date('2026-09-16T00:00:00Z')});
  const state={companyResearch:[]};
  mergeCompanyResearch(state,[{companyId:company.id,status:'AUTO_READY',intelligence:firstIntelligence}]);
  assert.equal(state.companyResearch[0].intelligence.change,'INITIAL');
  assert.ok(state.companyResearch[0].intelligence.facts.length>0);

  const secondIntelligence=buildAutonomousIntelligence(company,record([provider('GLEIF',[])]),{now:new Date('2026-09-17T00:00:00Z')});
  mergeCompanyResearch(state,[{companyId:company.id,status:'AUTO_READY',intelligence:secondIntelligence}]);
  assert.equal(state.companyResearch[0].intelligence.change,'UPDATED');
  assert.equal(state.companyResearch[0].intelligence.facts.length,0);
  assert.equal(state.companyResearch[0].intelligence.identity.status,'NO_VERIFIED_REFERENCE');
});

test('public autonomous projection is allowlisted and contains no raw provider records',()=>{
  const out=buildAutonomousIntelligence(company,record([
    provider('GLEIF',[gleifCandidate()]),
    provider('NLRB_CASES',[{provider:'NLRB_CASES',externalId:'ACME CORPORATION',label:'ACME CORPORATION',region:'CA',matches:1,records:[{case_number:'SECRET-RAW'}]}])
  ]));
  const pub=publicAutonomousIntelligence(out);const raw=JSON.stringify(pub);
  assert.equal(raw.includes('SECRET-RAW'),false);
  assert.equal(raw.includes('records'),false);
  assert.equal(raw.includes('externalId'),false);
  assert.ok(pub.facts.length>0);
  assert.ok(pub.signals.length>0);
});

test('autonomy health detects recoverable work and current-policy migration without exposing records',()=>{
  const now=new Date('2026-09-16T12:00:00Z');
  const state={
    companies:[{id:'a',synthetic:false},{id:'b',synthetic:false},{id:'demo',synthetic:true}],
    companyResearch:[
      {companyId:'a',status:'AUTO_READY_WITH_SOURCE_GAPS',collectedAt:'2026-09-16T11:00:00Z',sourceErrorCount:1,intelligence:{policyVersion:AUTONOMOUS_INTELLIGENCE_POLICY_VERSION}},
      {companyId:'orphan',status:'COLLECTION_FAILED',failedAt:'2026-09-16T10:00:00Z',deadLetteredAt:'2026-09-16T10:05:00Z'}
    ]
  };
  const h=researchAutonomyHealth(state,{now});
  assert.equal(h.status,'RECOVERY_NEEDED');
  assert.equal(h.realCompanies,2);
  assert.equal(h.missingResearch,1);
  assert.equal(h.failedRecords,1);
  assert.equal(h.retryEligibleFailures,1);
  assert.equal(h.deadLetteredRecords,1);
  assert.equal(h.latestDeadLetteredAt,'2026-09-16T10:05:00Z');
  assert.equal(h.sourceGapRecords,1);
  assert.equal(h.missingCurrentPolicy,0);
  assert.equal(h.selfHealing.manualOperatorRequired,false);

  state.companyResearch[0].intelligence={policyVersion:'old-policy'};
  const migration=researchAutonomyHealth(state,{now});
  assert.equal(migration.missingCurrentPolicy,1);
});
