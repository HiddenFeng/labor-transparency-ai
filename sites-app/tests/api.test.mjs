import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAppServer,createRuntime} from '../src/server.mjs';

class Client {
  constructor(base){this.base=base;this.cookie='';this.csrf=''}
  async request(url,{method='GET',body,token,origin}={}){
    const headers={Accept:'application/json'};
    if(this.cookie)headers.Cookie=this.cookie;
    if(body!==undefined){headers['Content-Type']='application/json';if(this.csrf)headers['X-Ltp-Csrf']=this.csrf;headers.Origin=origin??this.base}
    if(token)headers.Authorization=`Bearer ${token}`;
    const r=await fetch(this.base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const set=r.headers.get('set-cookie');if(set)this.cookie=set.split(';')[0];
    const data=await r.json().catch(()=>({}));
    return {status:r.status,data,headers:r.headers};
  }
  async config(){const r=await this.request('/api/config');assert.equal(r.status,200);this.csrf=r.data.csrfToken;return r.data}
}

async function start({dataFile,secret='S'.repeat(64),reviewToken='review-secret',exportToken='export-secret',advisoryAgentToken='advisory-agent-secret',communityAgentToken='community-agent-secret',seed=false}={}){
  const runtime=await createRuntime({dataFile,sessionSecret:secret,reviewToken,exportToken,advisoryAgentToken,communityAgentToken,seed});
  const {server}=await createAppServer({runtime});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const {port}=server.address();
  return {server,base:`http://127.0.0.1:${port}`,runtime};
}
function payload(companyId,extra={}){return {companyId,kind:'labour_claim',title:'示例安全实践',description:'用于真实HTTP闭环验证的公开合成记录。',scope:'示例厂区',periodStart:'2026-01-01',periodEnd:'2099-12-31',direction:'positive',dimension:'safety',productId:'',relation:'',category:'',sources:[{url:'https://example.org/source',title:'示例材料',type:'public_record',publishedAt:'2026-01-01',supports:'仅支持本条合成安全实践主张'}],public:true,consent:true,shareConsent:true,rights:'own_summary',rightsNote:'',creditName:'',...extra}}

test('real HTTP contribution -> review -> redistribution -> correction -> persistence loop',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-sites-api-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const dataFile=path.join(dir,'state.json');
  let env=await start({dataFile});t.after(()=>env.server.listening&&env.server.close());
  const client=new Client(env.base);const cfg=await client.config();
  assert.equal(cfg.version,'0.8.7-rc.1');assert.equal(cfg.capabilities.attachments,false);assert.equal(cfg.capabilities.privateSensitiveInfo,false);assert.equal(cfg.capabilities.anonymousAdvisory,true);assert.equal(cfg.capabilities.communityFeedback,true);assert.equal(cfg.capabilities.officialReferences,true);assert.equal(cfg.capabilities.officialRelations,true);assert.equal(cfg.capabilities.officialEvents,true);assert.equal(cfg.capabilities.publicAnnouncements,true);
  const researchHealth=await client.request('/api/research/health');assert.equal(researchHealth.status,200);assert.equal(researchHealth.data.status,'LOCAL_REFERENCE_MODE');assert.equal(researchHealth.data.unattendedOperation,true);assert.equal(researchHealth.data.runtime.companyResearchQueue,false);assert.equal(researchHealth.data.selfHealing.manualOperatorRequired,false);

  const company=await client.request('/api/companies',{method:'POST',body:{name:'HTTP示例公司',region:'示例地区',website:'https://example.org',consent:true}});
  assert.equal(company.status,200);const cid=company.data.company.id;
  const ballot=await client.request(`/api/companies/${cid}/ballot`,{method:'POST',body:{direction:'positive'}});assert.equal(ballot.status,200);

  const product=await client.request('/api/contributions',{method:'POST',body:{companyId:cid,kind:'product',title:'示例产品',description:'未独立核实的产品线索。',scope:'',periodStart:'',periodEnd:'',direction:'neutral',dimension:'other',productId:'',relation:'',category:'示例',sources:[],public:true,consent:true,shareConsent:false,rights:'reference_only',rightsNote:'',creditName:''}});
  assert.equal(product.status,200);assert.equal(product.data.item.evidence,'E0');
  const feedback=await client.request('/api/community-feedback',{method:'POST',body:{type:'source_request',companyId:cid,message:'希望增加这个公司的中国官方产品来源。',consent:true}});assert.equal(feedback.status,200);const feedbackId=feedback.data.item.id;
  const feedbackMinePending=await client.request('/api/community-feedback');assert.equal(feedbackMinePending.status,200);assert.equal(feedbackMinePending.data.items[0].status,'RECEIVED');
  const deniedCommunityAgent=await client.request('/api/community-agent/queue',{token:'wrong-token'});assert.equal(deniedCommunityAgent.status,403);
  const communityQueue=await client.request('/api/community-agent/queue',{token:'community-agent-secret'});assert.equal(communityQueue.status,200);assert.ok(communityQueue.data.items.some(x=>x.id===feedbackId));
  const response=await client.request(`/api/community-agent/feedback/${feedbackId}/respond`,{method:'POST',token:'community-agent-secret',origin:'',body:{decision:'planned',answer:'已加入官方来源扩展计划。',actions:['每日检查 NMPA UDI 官方增量']}});assert.equal(response.status,200);
  const announcement=await client.request('/api/community-agent/announcements',{method:'POST',token:'community-agent-secret',origin:'',body:{day:'2026-09-16',title:'今天更新了什么',summary:'新增官方来源关系测试。',items:['接入 NMPA UDI'],sources:[{label:'NMPA UDI',url:'https://udi.nmpa.gov.cn/'}]}});assert.equal(announcement.status,200);
  const officialReference=await client.request('/api/community-agent/official-references',{method:'POST',token:'community-agent-secret',origin:'',body:{items:[{companyId:cid,provider:'JP_NTA_CORPORATE_NUMBER',jurisdiction:'JP',referenceType:'LEGAL_ENTITY_REGISTRY',sourceRecordId:'1234567890123',sourceOfRecord:'国税庁法人番号公表サイト',sourceUrl:'https://www.houjin-bangou.nta.go.jp/download/sabun/index.html',sourceDate:'2026-09-16',confidence:'MEDIUM',bindingBasis:'EXACT_NAME_IN_OFFICIAL_DAILY_DELTA_NOT_NATIONAL_UNIQUENESS',scope:'官方日次差分中的精确名称匹配。',caveat:'日次差分不是全国全量唯一性检索，因此不自动升级法律主体身份，也不支持劳动或产品质量结论。',fields:{corporateNumber:'1234567890123',legalName:'HTTP示例公司',prefectureName:'東京都'}}]}});assert.equal(officialReference.status,200);assert.equal(officialReference.data.savedCount,1);
  const officialRelation=await client.request('/api/community-agent/official-relations',{method:'POST',token:'community-agent-secret',origin:'',body:{items:[{companyId:cid,provider:'CN_NMPA_UDI',jurisdiction:'CN',relationType:'COMPANY_REGISTERS_PRODUCT',objectType:'product',objectName:'示例医疗器械',objectExternalId:'06972253600013',sourceRecordId:'UDI-KEY-1',sourceOfRecord:'国家药品监督管理局医疗器械唯一标识数据库',sourceUrl:'https://udi.nmpa.gov.cn/',sourceDate:'2026-09-15',confidence:'HIGH',scope:'特定 UDI 注册/备案记录。',caveat:'该官方记录只支持这条具体产品登记关系，不代表产品整体质量或公司的完整产品目录。',attributes:{udiDi:'06972253600013',model:'M-1'}}]}});assert.equal(officialRelation.status,200);assert.equal(officialRelation.data.savedCount,1);
  const officialEvent=await client.request('/api/community-agent/official-events',{method:'POST',token:'community-agent-secret',origin:'',body:{items:[{companyId:cid,provider:'CN_CSRC_PENALTY',jurisdiction:'CN',eventType:'ADMINISTRATIVE_PENALTY',title:'中国证券监督管理委员会行政处罚决定书',summary:'仅用于本地测试的具体行政处罚事件。',eventDate:'2026-04-07',decisionNo:'〔2026〕10号',status:'ADMINISTRATIVE_PENALTY_DECISION_PUBLISHED',sourceRecordId:'c7626997',sourceOfRecord:'中国证券监督管理委员会',sourceUrl:'https://www.csrc.gov.cn/csrc/c101928/c7626997/content.shtml',sourceDate:'2026-04-07',confidence:'HIGH',scope:'仅限该份行政处罚决定。',caveat:'该决定仅支持决定书明确记载的主体、事实、期间和处罚，不自动扩张成其他业务或期间的违法结论。',attributes:{decisionNumber:'〔2026〕10号'}}]}});assert.equal(officialEvent.status,200);assert.equal(officialEvent.data.savedCount,1);
  const dailyRun=await client.request('/api/community-agent/daily-run',{method:'POST',token:'community-agent-secret',origin:'',body:{day:'2026-09-16',phase:'18',status:'COMPLETED',summary:'完成来源增量、意见处理与公告。',metrics:{relations:1},logRef:'history/daily/2026-09-16/18-operations.md'}});assert.equal(dailyRun.status,200);
  const announcements=await client.request('/api/announcements?limit=3');assert.equal(announcements.status,200);assert.equal(announcements.data.items[0].title,'今天更新了什么');
  const feedbackMineAnswered=await client.request('/api/community-feedback');assert.equal(feedbackMineAnswered.data.items[0].response.decision,'planned');assert.equal(feedbackMineAnswered.data.items[0].response.answer,'已加入官方来源扩展计划。');
  const companyDetail=await client.request(`/api/companies/${cid}`);assert.equal(companyDetail.status,200);assert.equal(companyDetail.data.company.id,cid);assert.equal(companyDetail.data.community.positive,1);assert.equal(companyDetail.data.community.participants,1);assert.equal(companyDetail.data.contributions.products.length,1);assert.equal(companyDetail.data.contributions.products[0].title,'示例产品');const detailJson=JSON.stringify(companyDetail.data);assert.equal(detailJson.includes('owner'),false);assert.equal(detailJson.includes('rightsNote'),false);assert.match(companyDetail.data.boundary,/社区反馈/);
  assert.equal(companyDetail.data.officialReferences.length,1);assert.equal(companyDetail.data.officialReferences[0].tier,'OFFICIAL_SOURCE_REFERENCE');assert.equal(companyDetail.data.officialReferences[0].fields.corporateNumber,'1234567890123');
  assert.equal(companyDetail.data.officialRelations.length,1);assert.equal(companyDetail.data.officialRelations[0].tier,'OFFICIAL_SOURCE_RELATION');assert.equal(companyDetail.data.officialRelations[0].object.externalId,'06972253600013');
  assert.equal(companyDetail.data.officialEvents.length,1);assert.equal(companyDetail.data.officialEvents[0].tier,'OFFICIAL_SOURCE_EVENT');assert.equal(companyDetail.data.officialEvents[0].decisionNo,'〔2026〕10号');
  const missingCompany=await client.request('/api/companies/co_missing');assert.equal(missingCompany.status,404);
  const publicList=await client.request('/api/contributions');assert.equal(publicList.status,200);assert.equal('rights' in publicList.data.items[0],false);assert.equal('owner' in publicList.data.items[0],false);
  const mine=await client.request('/api/contributions?mine=1');assert.equal(mine.status,200);assert.equal(mine.data.items[0].rights,'reference_only');

  const claim=await client.request('/api/contributions',{method:'POST',body:payload(cid)});assert.equal(claim.status,200);const claimId=claim.data.item.id;
  const deniedReview=await client.request(`/api/contributions/${claimId}/review`,{method:'POST',body:{version:1,decision:'approve',evidence:'E3',rationale:'范围与来源已经完成核对。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']}});assert.equal(deniedReview.status,403);
  const reviewed=await client.request(`/api/contributions/${claimId}/review`,{method:'POST',token:'review-secret',body:{version:1,decision:'approve',evidence:'E3',rationale:'范围与来源已经完成核对。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']}});assert.equal(reviewed.status,200);assert.equal(reviewed.data.evidence,'E3');
  const evidenceLane=await client.request('/api/showcase?lane=evidence_positive');assert.equal(evidenceLane.status,200);assert.equal(evidenceLane.data.items.length,1);
  const communityLane=await client.request('/api/showcase?lane=community_positive');assert.equal(communityLane.data.items[0].positive,1);assert.equal(communityLane.data.items[0].participants,1);

  const wrongExport=await client.request(`/api/contributions/${claimId}/approve-export`,{method:'POST',token:'review-secret',body:{version:1,privacyChecked:true,rightsChecked:true,reason:'独立完成隐私和权利再分发复核。'}});assert.equal(wrongExport.status,403);
  const exported=await client.request(`/api/contributions/${claimId}/approve-export`,{method:'POST',token:'export-secret',body:{version:1,privacyChecked:true,rightsChecked:true,reason:'独立完成隐私和权利再分发复核。'}});assert.equal(exported.status,200);
  let dataset=await client.request('/api/public-data');assert.equal(dataset.data.recordCount,1);

  const flag=await client.request(`/api/contributions/${claimId}/flag`,{method:'POST',body:{reason:'发现该条范围需要审核员重新核对。'}});assert.equal(flag.status,200);
  dataset=await client.request('/api/public-data');assert.equal(dataset.data.recordCount,0);
  const laneAfterFlag=await client.request('/api/showcase?lane=evidence_positive');assert.equal(laneAfterFlag.data.items.length,0);

  const reviewedAgain=await client.request(`/api/contributions/${claimId}/review`,{method:'POST',token:'review-secret',body:{version:1,decision:'approve',evidence:'E3',rationale:'已针对纠错重新核对范围与来源。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']}});assert.equal(reviewedAgain.status,200);
  await client.request(`/api/contributions/${claimId}/approve-export`,{method:'POST',token:'export-secret',body:{version:1,privacyChecked:true,rightsChecked:true,reason:'纠错复核后再次完成隐私与权利检查。'}});
  dataset=await client.request('/api/public-data');assert.equal(dataset.data.recordCount,1);

  const edited=await client.request(`/api/contributions/${claimId}`,{method:'PATCH',body:payload(cid,{description:'修改后必须回到E0重新审核。'})});assert.equal(edited.status,200);assert.equal(edited.data.item.evidence,'E0');assert.equal(edited.data.item.version,2);assert.equal(edited.data.item.exportApproved,false);
  dataset=await client.request('/api/public-data');assert.equal(dataset.data.recordCount,0);

  const badPii=await client.request('/api/contributions',{method:'POST',body:payload(cid,{description:'联系邮箱 worker@example.org'})});assert.equal(badPii.status,400);
  const noCsrf=new Client(env.base);await noCsrf.request('/api/config');const csrfDenied=await noCsrf.request('/api/companies',{method:'POST',body:{name:'不能提交',region:'示例',consent:true}});assert.equal(csrfDenied.status,403);
  const cross=await client.request('/api/companies',{method:'POST',origin:'https://evil.example',body:{name:'跨站公司',region:'示例',consent:true}});assert.equal(cross.status,403);
  const noOriginHeaders={Accept:'application/json','Content-Type':'application/json','X-Ltp-Csrf':client.csrf,Cookie:client.cookie};
  const noOrigin=await fetch(client.base+'/api/companies',{method:'POST',headers:noOriginHeaders,body:JSON.stringify({name:'无来源公司',region:'示例',consent:true})});assert.equal(noOrigin.status,403);
  const attachment=await client.request('/api/attachments');assert.equal(attachment.status,404);

  const cookie=client.cookie;
  await new Promise(resolve=>env.server.close(resolve));
  env=await start({dataFile});
  client.base=env.base;client.cookie=cookie;await client.config();
  const afterRestart=await client.request('/api/contributions?mine=1');assert.equal(afterRestart.status,200);assert.ok(afterRestart.data.items.some(x=>x.id===claimId&&x.version===2));
  const raw=JSON.parse(await fs.readFile(dataFile,'utf8'));assert.ok(raw.companies.some(x=>x.id===cid));
  await new Promise(resolve=>env.server.close(resolve));
});

test('request size is bounded and unknown user evidence fields are rejected',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-sites-size-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const env=await start({dataFile:path.join(dir,'state.json')});t.after(()=>env.server.close());
  const client=new Client(env.base);await client.config();
  const co=await client.request('/api/companies',{method:'POST',body:{name:'大小测试公司',region:'示例',consent:true}});const cid=co.data.company.id;
  const unknown=await client.request('/api/contributions',{method:'POST',body:{...payload(cid),evidence:'E5'}});assert.equal(unknown.status,400);
  const huge=await client.request('/api/contributions',{method:'POST',body:{...payload(cid),description:'a'.repeat(100000)}});assert.equal(huge.status,413);
});
