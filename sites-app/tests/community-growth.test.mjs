import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,addCompany,addContribution,upsertOfficialReferences,publicOfficialReferences,upsertOfficialRelations,publicOfficialRelations,upsertOfficialEvents,publicOfficialEvents,
  addCommunityFeedback,listOwnCommunityFeedback,communityAgentQueue,respondCommunityFeedback,
  addPublicAnnouncement,publicAnnouncements,recordAgentDailyRun
} from '../src/domain.mjs';
import {publicCompanyDetail} from '../src/company-dossier.mjs';

function stateWithCompany(){
  const state=emptyState();
  const {company}=addCompany(state,{name:'苏州鼎科医疗技术股份有限公司',region:'中国',website:'https://example.org/',consent:true},'owner-a');
  return {state,company};
}

function officialRelation(companyId){return {
  companyId,provider:'CN_NMPA_UDI',jurisdiction:'CN',relationType:'COMPANY_REGISTERS_PRODUCT',objectType:'product',objectName:'PTCA球囊扩张导管',objectExternalId:'06972253600013',sourceRecordId:'KEY-1',sourceOfRecord:'国家药品监督管理局医疗器械唯一标识数据库',sourceUrl:'https://udi.nmpa.gov.cn/',sourceDate:'2026-09-15',confidence:'HIGH',scope:'NMPA UDI 记录中的注册人/备案人与该医疗器械产品标识的关系。',caveat:'该官方记录只支持此注册人/备案人与该条医疗器械记录的具体关系，不代表产品整体质量或完整产品目录。',attributes:{registrationOrFilingNumber:'国械注准20193030166',model:'CBC-1210'}
};}

test('official source relations are deterministic, idempotent and separate from community contributions',()=>{
  const {state,company}=stateWithCompany();
  const first=upsertOfficialRelations(state,{items:[officialRelation(company.id)]});
  const second=upsertOfficialRelations(state,{items:[officialRelation(company.id)]});
  assert.equal(first.savedCount,1);assert.equal(second.savedCount,1);assert.equal(state.officialRelations.length,1);
  const rows=publicOfficialRelations(state,company.id);assert.equal(rows.length,1);assert.equal(rows[0].tier,'OFFICIAL_SOURCE_RELATION');assert.equal(rows[0].object.name,'PTCA球囊扩张导管');assert.equal(rows[0].source.sourceOfRecord,'国家药品监督管理局医疗器械唯一标识数据库');
  addContribution(state,{companyId:company.id,kind:'brand',title:'社区品牌线索',description:'社区贡献的品牌线索。',scope:'',periodStart:'',periodEnd:'',direction:'neutral',dimension:'other',productId:'',brandId:'',relationType:'',relation:'',category:'品牌',sources:[],public:true,consent:true,shareConsent:false,rights:'own_summary',rightsNote:'',creditName:''},'owner-b');
  const detail=publicCompanyDetail(state,company.id);assert.equal(detail.officialRelations.length,1);assert.equal(detail.contributions.brands.length,1);assert.equal(detail.officialRelations[0].tier,'OFFICIAL_SOURCE_RELATION');assert.equal(detail.contributions.brands[0].evidence,'E0');
});

test('official registry references are deterministic and separate from identity engine and relationship lanes',()=>{
  const {state,company}=stateWithCompany();
  const payload={items:[{companyId:company.id,provider:'JP_NTA_CORPORATE_NUMBER',jurisdiction:'JP',referenceType:'LEGAL_ENTITY_REGISTRY',sourceRecordId:'1234567890123',sourceOfRecord:'国税庁法人番号公表サイト',sourceUrl:'https://www.houjin-bangou.nta.go.jp/download/sabun/index.html',sourceDate:'2026-09-16',confidence:'MEDIUM',bindingBasis:'EXACT_NAME_IN_OFFICIAL_DAILY_DELTA_NOT_NATIONAL_UNIQUENESS',scope:'日次差分中的精确法人名称匹配。',caveat:'日次差分不是全国全量唯一性检索，因此不自动升级法律主体身份，也不支持劳动或产品质量结论。',fields:{corporateNumber:'1234567890123',legalName:'苏州鼎科医疗技术股份有限公司',prefectureName:'東京都'}}]};
  const first=upsertOfficialReferences(state,payload);const second=upsertOfficialReferences(state,payload);
  assert.equal(first.savedCount,1);assert.equal(second.savedCount,1);assert.equal(state.officialReferences.length,1);assert.equal(state.officialRelations.length,0);
  const refs=publicOfficialReferences(state,company.id);assert.equal(refs.length,1);assert.equal(refs[0].tier,'OFFICIAL_SOURCE_REFERENCE');assert.equal(refs[0].fields.corporateNumber,'1234567890123');assert.equal(refs[0].bindingBasis,'EXACT_NAME_IN_OFFICIAL_DAILY_DELTA_NOT_NATIONAL_UNIQUENESS');
  const detail=publicCompanyDetail(state,company.id);assert.equal(detail.officialReferences.length,1);assert.equal(detail.officialRelations.length,0);assert.equal(detail.research,null);
});

test('official China events are idempotent, source-scoped and included in China investigation without becoming community claims',()=>{
  const {state,company}=stateWithCompany();
  const payload={items:[{companyId:company.id,provider:'CN_CSRC_PENALTY',jurisdiction:'CN',eventType:'ADMINISTRATIVE_PENALTY',title:'中国证券监督管理委员会行政处罚决定书',summary:'决定书对特定证券监管事项作出行政处罚。',eventDate:'2026-04-07',decisionNo:'〔2026〕10号',status:'ADMINISTRATIVE_PENALTY_DECISION_PUBLISHED',sourceRecordId:'c7626997',sourceOfRecord:'中国证券监督管理委员会',sourceUrl:'https://www.csrc.gov.cn/csrc/c101928/c7626997/content.shtml',sourceDate:'2026-04-07',confidence:'HIGH',scope:'仅限该份行政处罚决定。',caveat:'该决定只支持决定书明确记载的主体、事实、期间和处罚，不自动扩张成公司其他业务或期间的违法结论。',attributes:{decisionNumber:'〔2026〕10号'}}]};
  const first=upsertOfficialEvents(state,payload);const second=upsertOfficialEvents(state,payload);
  assert.equal(first.savedCount,1);assert.equal(second.savedCount,1);assert.equal(state.officialEvents.length,1);
  const events=publicOfficialEvents(state,company.id);assert.equal(events.length,1);assert.equal(events[0].tier,'OFFICIAL_SOURCE_EVENT');assert.equal(events[0].eventType,'ADMINISTRATIVE_PENALTY');assert.equal(events[0].decisionNo,'〔2026〕10号');
  const detail=publicCompanyDetail(state,company.id);assert.equal(detail.officialEvents.length,1);assert.equal(detail.chinaInvestigation.jurisdiction,'CN');assert.equal(detail.chinaInvestigation.dimensions.regulatory.administrativePenalties,1);assert.equal(detail.contributions.labourClaims.length,0);assert.match(detail.chinaInvestigation.boundary,/不是信用评级/);
});

test('community feedback is private to owner until agent response and never enters public announcement automatically',()=>{
  const {state,company}=stateWithCompany();
  const feedback=addCommunityFeedback(state,{type:'source_request',companyId:company.id,message:'希望增加更多中国官方产品来源。',consent:true},'owner-feedback');
  assert.equal(communityAgentQueue(state).length,1);
  assert.equal(listOwnCommunityFeedback(state,'other-owner').length,0);
  assert.equal(listOwnCommunityFeedback(state,'owner-feedback')[0].message,'希望增加更多中国官方产品来源。');
  respondCommunityFeedback(state,feedback.id,{decision:'planned',answer:'已加入官方来源扩展队列，后续公告只发布聚合进展。',actions:['接入 NMPA UDI 官方日增量']},'agent');
  const mine=listOwnCommunityFeedback(state,'owner-feedback')[0];assert.equal(mine.status,'ANSWERED');assert.equal(mine.response.decision,'planned');assert.equal(communityAgentQueue(state).length,0);assert.equal(publicAnnouncements(state).length,0);
});

test('daily announcement and 18/19 run records are upserted by day/phase',()=>{
  const {state}=stateWithCompany();
  const a1=addPublicAnnouncement(state,{day:'2026-09-16',title:'今天更新了什么',summary:'新增一条官方来源能力。',items:['接入 NMPA UDI 日增量'],sources:[{label:'NMPA UDI',url:'https://udi.nmpa.gov.cn/'}]},'agent');
  const a2=addPublicAnnouncement(state,{day:'2026-09-16',title:'今天更新了什么',summary:'新增官方来源，并完成晚间复核。',items:['接入 NMPA UDI 日增量','完成 19 点复核'],sources:[{label:'NMPA UDI',url:'https://udi.nmpa.gov.cn/'}]},'agent');
  assert.equal(a1.id,a2.id);assert.equal(state.publicAnnouncements.length,1);assert.equal(publicAnnouncements(state)[0].items.length,2);
  recordAgentDailyRun(state,{day:'2026-09-16',phase:'18',status:'COMPLETED',summary:'18 点完成来源增量与意见处理。',metrics:{relations:3},logRef:'history/daily/2026-09-16/18-operations.md'},'agent');
  recordAgentDailyRun(state,{day:'2026-09-16',phase:'19',status:'COMPLETED',summary:'19 点完成复核与当天总结。',metrics:{remaining:0},logRef:'history/daily/2026-09-16/summary.md'},'agent');
  assert.equal(state.agentDailyRuns.length,2);assert.equal(state.agentDailyRuns.find(x=>x.phase==='19').status,'COMPLETED');
});
