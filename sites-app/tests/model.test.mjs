import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, addCompany, addContribution, setBallot, showcase, reviewContribution,
  approveExport, publicDataset, flagContribution, updateContribution, safeText
} from '../src/domain.mjs';

function setup(){
  const state=emptyState();
  const {company}=addCompany(state,{name:'示例公司',region:'示例地区',website:'https://example.org',consent:true},'owner-a');
  return {state,company};
}
function claimPayload(companyId,extra={}){
  return {
    companyId,kind:'labour_claim',title:'示例休息实践',description:'仅用于验证具体劳动实践的证据链。',
    scope:'示例一号厂区',periodStart:'2026-01-01',periodEnd:'2099-12-31',direction:'positive',dimension:'rest',
    productId:'',relation:'',category:'',public:true,consent:true,shareConsent:true,rights:'own_summary',rightsNote:'',creditName:'',
    sources:[{url:'https://example.org/source',title:'示例公开材料',type:'public_record',publishedAt:'2026-01-01',supports:'支持本条具体休息实践主张'}],
    ...extra
  };
}

test('community heat is independent from evidence grade',()=>{
  const {state,company}=setup();
  const item=addContribution(state,claimPayload(company.id),'owner-a');
  setBallot(state,company.id,'owner-a','positive');
  assert.equal(showcase(state,'community_positive').items[0].positive,1);
  reviewContribution(state,item.id,{version:1,decision:'approve',evidence:'E3',rationale:'范围与来源均完成核对。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']});
  const lane=showcase(state,'community_positive');
  assert.equal(lane.items[0].positive,1);
  assert.equal(lane.items[0].participants,1);
  assert.equal(showcase(state,'evidence_positive').items.length,1);
});

test('E3 cannot be granted without source, scope and authenticity checks',()=>{
  const {state,company}=setup();
  const item=addContribution(state,claimPayload(company.id,{sources:[]}),'owner-a');
  assert.throws(()=>reviewContribution(state,item.id,{version:1,decision:'approve',evidence:'E3',rationale:'这条理由长度足够用于测试。',scopeChecked:true,authenticityChecked:true,sourceIds:[]}),/E2以上/);
  const {state:state2,company:company2}=setup();
  const item2=addContribution(state2,claimPayload(company2.id,{scope:''}),'owner-a');
  assert.throws(()=>reviewContribution(state2,item2.id,{version:1,decision:'approve',evidence:'E3',rationale:'这条理由长度足够用于测试。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']}),/范围和日期/);
});

test('public dataset requires independent redistribution approval and open flags pause it',()=>{
  const {state,company}=setup();
  const item=addContribution(state,claimPayload(company.id),'owner-a');
  reviewContribution(state,item.id,{version:1,decision:'approve',evidence:'E3',rationale:'范围与来源均完成核对。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']});
  assert.equal(publicDataset(state).recordCount,0);
  approveExport(state,item.id,{version:1,privacyChecked:true,rightsChecked:true,reason:'独立完成隐私和权利再分发复核。'});
  assert.equal(publicDataset(state).recordCount,1);
  flagContribution(state,item.id,'owner-b','发现范围描述可能需要进一步收窄。');
  assert.equal(publicDataset(state).recordCount,0);
});

test('editing resets evidence and redistribution state',()=>{
  const {state,company}=setup();
  const item=addContribution(state,claimPayload(company.id),'owner-a');
  reviewContribution(state,item.id,{version:1,decision:'approve',evidence:'E3',rationale:'范围与来源均完成核对。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']});
  approveExport(state,item.id,{version:1,privacyChecked:true,rightsChecked:true,reason:'独立完成隐私和权利再分发复核。'});
  const updated=updateContribution(state,item.id,{...claimPayload(company.id),description:'修改后的公开说明，必须重新审核。'},'owner-a');
  assert.equal(updated.version,2);
  assert.equal(updated.evidence,'E0');
  assert.equal(updated.status,'PENDING');
  assert.equal(updated.exportApproved,false);
});

test('PII-like public text is rejected while random internal IDs are not scanned as human text',()=>{
  assert.throws(()=>safeText('联系 test@example.org',{min:2,field:'说明'}),/私人联系方式/);
  assert.throws(()=>safeText('电话 13812345678',{min:2,field:'说明'}),/私人联系方式/);
  assert.equal(safeText('这是正常公开说明',{min:2,field:'说明'}),'这是正常公开说明');
  const {state,company}=setup();
  const product=addContribution(state,{companyId:company.id,kind:'product',title:'产品',description:'普通公开描述',scope:'',periodStart:'',periodEnd:'',direction:'neutral',dimension:'other',productId:'',relation:'',category:'',sources:[],public:true,consent:true,shareConsent:false,rights:'reference_only',rightsNote:'',creditName:''},'owner-a');
  assert.match(product.id,/^con_[a-f0-9]+$/);
});
