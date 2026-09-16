import assert from 'node:assert/strict';

const base=String(process.env.LTP_SMOKE_BASE||'http://127.0.0.1:8790').replace(/\/$/,'');
const origin=String(process.env.LTP_SMOKE_ORIGIN||'http://127.0.0.1:8791');
const reviewToken=String(process.env.LTP_SMOKE_REVIEW_TOKEN||'review-local-only');
const exportToken=String(process.env.LTP_SMOKE_EXPORT_TOKEN||'export-local-only');
const agentToken=String(process.env.LTP_SMOKE_AGENT_TOKEN||'advisory-local-only');
const researchToken=String(process.env.LTP_SMOKE_RESEARCH_TOKEN||'research-local-only');
const communityToken=String(process.env.LTP_SMOKE_COMMUNITY_TOKEN||'community-local-only');
let cookie='';let csrf='';

async function createIsolatedCompany(i,suffix){
  const cfgRes=await fetch(base+'/api/config',{headers:{Origin:origin}});
  assert.equal(cfgRes.status,200);
  const cfgBody=await cfgRes.json();
  const set=cfgRes.headers.get('set-cookie');
  assert.ok(set);
  const isolatedCookie=set.split(';')[0];
  const name=`并发示例-${suffix}-${i}`;
  const res=await fetch(base+'/api/companies',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-LTP-CSRF':cfgBody.csrfToken,Cookie:isolatedCookie},body:JSON.stringify({name,region:'示例地区',website:'',consent:true})});
  const data=await res.json().catch(()=>({}));
  assert.equal(res.status,200,JSON.stringify(data));
  assert.equal(data.researchQueued,true);assert.equal(data.research?.status,'QUEUED');
  return name;
}

async function req(path,{method='GET',body,token,sendCsrf=true,requestOrigin=origin,credentials=true}={}){
  const headers={Accept:'application/json'};
  if(requestOrigin)headers.Origin=requestOrigin;
  if(cookie&&credentials)headers.Cookie=cookie;
  if(body!==undefined){headers['Content-Type']='application/json';if(sendCsrf&&csrf)headers['X-LTP-CSRF']=csrf;}
  if(token)headers.Authorization=`Bearer ${token}`;
  const res=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
  const set=res.headers.get('set-cookie');if(set&&credentials)cookie=set.split(';')[0];
  const data=await res.json().catch(()=>({}));
  return {status:res.status,data,headers:res.headers};
}

const cfg=await req('/api/config');
assert.equal(cfg.status,200);assert.equal(cfg.data.version,'0.8.6-rc.1');assert.equal(cfg.data.mode,'CLOUDFLARE_WORKER_D1');assert.equal(cfg.data.capabilities.unattendedCompanyIntelligence,true);assert.equal(cfg.data.capabilities.communityFeedback,true);assert.equal(cfg.data.capabilities.officialReferences,true);assert.equal(cfg.data.capabilities.officialRelations,true);assert.equal(cfg.data.capabilities.officialEvents,true);assert.equal(cfg.data.capabilities.publicAnnouncements,true);assert.ok(cookie.startsWith('ltp_session='));assert.equal(cfg.headers.get('access-control-allow-origin'),origin);csrf=cfg.data.csrfToken;assert.match(csrf,/^[a-f0-9]{64}$/);
const researchStatus=await req('/api/research/status');assert.equal(researchStatus.status,200);assert.equal(researchStatus.data.companiesTracked,0);assert.match(researchStatus.data.boundary,/候选/);
const researchHealth=await req('/api/research/health');assert.equal(researchHealth.status,200);assert.equal(researchHealth.data.unattendedOperation,true);assert.equal(researchHealth.data.selfHealing.manualOperatorRequired,false);assert.equal(researchHealth.data.runtime.companyResearchQueue,false);const baselineRealCompanies=Number(researchHealth.data.realCompanies||0);
const researchDenied=await req('/api/research-agent/queue',{token:'wrong-research-token'});assert.equal(researchDenied.status,403);
const researchQueue=await req('/api/research-agent/queue',{token:researchToken});assert.equal(researchQueue.status,200);assert.equal(Array.isArray(researchQueue.data.items),true);

const preflight=await fetch(base+'/api/companies',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-ltp-csrf'}});
assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);

const badOrigin=await req('/api/companies',{method:'POST',requestOrigin:'https://evil.invalid',body:{name:'测试公司X',region:'测试地区',website:'',consent:true}});
assert.equal(badOrigin.status,403);
const noCsrf=await req('/api/companies',{method:'POST',sendCsrf:false,body:{name:'测试公司X',region:'测试地区',website:'',consent:true}});
assert.equal(noCsrf.status,403);

const suffix=Date.now().toString(36);
const company=await req('/api/companies',{method:'POST',body:{name:`公开流程示例-${suffix}`,region:'示例地区',website:'https://example.org',consent:true}});
assert.equal(company.status,200);assert.equal(company.data.researchQueued,true);assert.equal(company.data.research?.status,'QUEUED');const companyId=company.data.company.id;assert.ok(companyId);
const ballot=await req(`/api/companies/${companyId}/ballot`,{method:'POST',body:{direction:'negative'}});assert.equal(ballot.status,200);
const concurrentNames=await Promise.all([0,1,2,3].map(i=>createIsolatedCompany(i,suffix)));
const afterConcurrent=await req('/api/companies');assert.equal(afterConcurrent.status,200);for(const name of concurrentNames){const item=afterConcurrent.data.items.find(x=>x.name===name);assert.ok(item);assert.equal(item.research?.status,'QUEUED');}
const queuedStatus=await req('/api/research/status');assert.equal(queuedStatus.status,200);assert.equal(queuedStatus.data.companiesTracked,5);assert.equal(queuedStatus.data.queued,5);assert.equal(queuedStatus.data.collecting,0);
const queuedHealth=await req('/api/research/health');assert.equal(queuedHealth.status,200);assert.equal(queuedHealth.data.realCompanies,baselineRealCompanies+5);assert.equal(queuedHealth.data.runtime.companyResearchQueue,false);

const contribution=await req('/api/contributions',{method:'POST',body:{companyId,kind:'labour_claim',title:'示例工时记录',description:'用于验证独立部署链路的合成公开线索。',scope:'示例岗位',periodStart:'2026-01-01',periodEnd:'2026-12-31',direction:'negative',dimension:'hours',productId:'',relation:'',category:'',sources:[{url:'https://example.org/evidence',title:'合成公开来源',type:'public_record',publishedAt:'2026-01-01',supports:'仅用于本地自动化测试的合成范围'}],public:true,consent:true,shareConsent:true,rights:'own_summary',rightsNote:'',creditName:'自动化测试'}});
assert.equal(contribution.status,200);assert.equal(contribution.data.item.evidence,'E0');const cid=contribution.data.item.id;const version=contribution.data.item.version;
const feedback=await req('/api/community-feedback',{method:'POST',body:{type:'source_request',companyId,message:'本地自动化测试：希望增加官方产品来源。',consent:true}});assert.equal(feedback.status,200);const feedbackId=feedback.data.item.id;
const deniedCommunity=await req('/api/community-agent/queue',{token:'wrong-community-token'});assert.equal(deniedCommunity.status,403);
const communityQueue=await req('/api/community-agent/queue',{token:communityToken,requestOrigin:'',credentials:false});assert.equal(communityQueue.status,200);assert.ok(communityQueue.data.items.some(x=>x.id===feedbackId));
const feedbackReply=await req(`/api/community-agent/feedback/${feedbackId}/respond`,{method:'POST',token:communityToken,requestOrigin:'',sendCsrf:false,credentials:false,body:{decision:'planned',answer:'已进入官方来源扩展计划。',actions:['每日检查 NMPA UDI 官方增量']}});assert.equal(feedbackReply.status,200);
const reference=await req('/api/community-agent/official-references',{method:'POST',token:communityToken,requestOrigin:'',sendCsrf:false,credentials:false,body:{items:[{companyId,provider:'JP_NTA_CORPORATE_NUMBER',jurisdiction:'JP',referenceType:'LEGAL_ENTITY_REGISTRY',sourceRecordId:'1234567890123',sourceOfRecord:'国税庁法人番号公表サイト',sourceUrl:'https://www.houjin-bangou.nta.go.jp/download/sabun/index.html',sourceDate:'2026-09-16',confidence:'MEDIUM',bindingBasis:'EXACT_NAME_IN_OFFICIAL_DAILY_DELTA_NOT_NATIONAL_UNIQUENESS',scope:'本地自动化测试的官方登记参考。',caveat:'日次差分不是全国全量唯一性检索，因此不自动升级法律主体身份，也不支持劳动或产品质量结论。',fields:{corporateNumber:'1234567890123',legalName:`公开流程示例-${suffix}`,prefectureName:'東京都'}}]}});assert.equal(reference.status,200);assert.equal(reference.data.savedCount,1);
const relation=await req('/api/community-agent/official-relations',{method:'POST',token:communityToken,requestOrigin:'',sendCsrf:false,credentials:false,body:{items:[{companyId,provider:'CN_NMPA_UDI',jurisdiction:'CN',relationType:'COMPANY_REGISTERS_PRODUCT',objectType:'product',objectName:'示例医疗器械',objectExternalId:'06972253600013',sourceRecordId:'UDI-SMOKE-1',sourceOfRecord:'国家药品监督管理局医疗器械唯一标识数据库',sourceUrl:'https://udi.nmpa.gov.cn/',sourceDate:'2026-09-15',confidence:'HIGH',scope:'本地自动化测试的特定 UDI 记录。',caveat:'该官方记录只支持这条具体登记关系，不代表产品整体质量或公司的完整产品目录。',attributes:{udiDi:'06972253600013',model:'SMOKE-M1'}}]}});assert.equal(relation.status,200);assert.equal(relation.data.savedCount,1);
const officialEvent=await req('/api/community-agent/official-events',{method:'POST',token:communityToken,requestOrigin:'',sendCsrf:false,credentials:false,body:{items:[{companyId,provider:'CN_CSRC_PENALTY',jurisdiction:'CN',eventType:'ADMINISTRATIVE_PENALTY',title:'中国证券监督管理委员会行政处罚决定书',summary:'本地 smoke 的具体官方处罚事件。',eventDate:'2026-04-07',decisionNo:'〔2026〕10号',status:'ADMINISTRATIVE_PENALTY_DECISION_PUBLISHED',sourceRecordId:'c7626997',sourceOfRecord:'中国证券监督管理委员会',sourceUrl:'https://www.csrc.gov.cn/csrc/c101928/c7626997/content.shtml',sourceDate:'2026-04-07',confidence:'HIGH',scope:'本地 smoke 只验证具体行政处罚决定。',caveat:'该决定只支持决定书明确记载的主体、事实、期间和处罚，不自动扩张成其他业务或期间的违法结论。',attributes:{decisionNumber:'〔2026〕10号'}}]}});assert.equal(officialEvent.status,200);assert.equal(officialEvent.data.savedCount,1);
const announcement=await req('/api/community-agent/announcements',{method:'POST',token:communityToken,requestOrigin:'',sendCsrf:false,credentials:false,body:{day:'2026-09-16',title:'今天更新了什么',summary:'本地自动化测试新增官方来源关系。',items:['接入 NMPA UDI 官方关系能力'],sources:[{label:'NMPA UDI',url:'https://udi.nmpa.gov.cn/'}]}});assert.equal(announcement.status,200);
const dailyCommunityRun=await req('/api/community-agent/daily-run',{method:'POST',token:communityToken,requestOrigin:'',sendCsrf:false,credentials:false,body:{day:'2026-09-16',phase:'18',status:'COMPLETED',summary:'本地自动化测试完成来源、意见与公告。',metrics:{relations:1,feedback:1},logRef:'history/daily/2026-09-16/18-operations.md'}});assert.equal(dailyCommunityRun.status,200);
const announcementPublic=await req('/api/announcements?limit=3');assert.equal(announcementPublic.status,200);assert.equal(announcementPublic.data.items[0].title,'今天更新了什么');
const feedbackMine=await req('/api/community-feedback');assert.equal(feedbackMine.status,200);assert.equal(feedbackMine.data.items.find(x=>x.id===feedbackId).response.decision,'planned');
const companyDetail=await req(`/api/companies/${companyId}`);assert.equal(companyDetail.status,200);assert.equal(companyDetail.data.company.id,companyId);assert.equal(companyDetail.data.community.negative,1);assert.equal(companyDetail.data.community.participants,1);assert.equal(companyDetail.data.research.status,'QUEUED');assert.ok(companyDetail.data.contributions.labourClaims.some(x=>x.id===cid));const detailJson=JSON.stringify(companyDetail.data);assert.equal(detailJson.includes('owner'),false);assert.equal(detailJson.includes('rightsNote'),false);assert.match(companyDetail.data.boundary,/社区反馈/);
assert.equal(companyDetail.data.officialReferences.length,1);assert.equal(companyDetail.data.officialReferences[0].tier,'OFFICIAL_SOURCE_REFERENCE');assert.equal(companyDetail.data.officialReferences[0].fields.corporateNumber,'1234567890123');
assert.equal(companyDetail.data.officialRelations.length,1);assert.equal(companyDetail.data.officialRelations[0].object.externalId,'06972253600013');
assert.equal(companyDetail.data.officialEvents.length,1);assert.equal(companyDetail.data.officialEvents[0].tier,'OFFICIAL_SOURCE_EVENT');assert.equal(companyDetail.data.officialEvents[0].decisionNo,'〔2026〕10号');
const missingDetail=await req('/api/companies/co_missing');assert.equal(missingDetail.status,404);

const reviewQueue=await req('/api/review-queue',{token:reviewToken});assert.equal(reviewQueue.status,200);assert.ok(reviewQueue.data.items.some(x=>x.id===cid));
const review=await req(`/api/contributions/${cid}/review`,{method:'POST',token:reviewToken,body:{version,decision:'approve',evidence:'E3',rationale:'本地自动化测试核对合成来源、范围与日期，不外推公司整体。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1'],effective:false,decisionReference:''}});
assert.equal(review.status,200);assert.equal(review.data.evidence,'E3');
const exp=await req(`/api/contributions/${cid}/approve-export`,{method:'POST',token:exportToken,body:{version,privacyChecked:true,rightsChecked:true,reason:'本地自动化测试确认合成摘要不含私人信息且允许公益再分发。'}});assert.equal(exp.status,200);assert.equal(exp.data.exportApproved,true);
const flag=await req(`/api/contributions/${cid}/flag`,{method:'POST',body:{reason:'本地自动化测试：触发纠错暂停公开再分发。'}});assert.equal(flag.status,200);
const publicData=await req('/api/public-data');assert.equal(publicData.status,200);assert.equal(JSON.stringify(publicData.data).includes(cid),false);

const advisory=await req('/api/advisory',{method:'POST',body:{category:'hours_rest',companyId:'',region:'示例地区',employmentStatus:'current',summary:'最近排班和实际工时持续变化，希望先按日期整理记录再决定下一步。',desiredOutcome:'希望得到材料整理顺序和可查询的正式权益资源。',tried:'已经保存自己合法持有的排班和工资记录。',urgency:'routine',privacyConfirmed:true,consent:true}});
assert.equal(advisory.status,200);assert.match(advisory.data.receiptCode,/^ADV-[A-Za-z0-9_-]{32}$/);
const receipt=advisory.data.receiptCode;
const run=await req('/api/advisory-agent/run',{method:'POST',token:agentToken,requestOrigin:'',sendCsrf:false,credentials:false,body:{day:'2026-09-15',timeZone:'Asia/Shanghai'}});assert.equal(run.status,200);assert.ok(run.data.processedCount>=1);
const mine=await req('/api/advisory/mine');assert.equal(mine.status,200);assert.ok(mine.data.items.some(x=>x.status==='ADVISED'&&x.advice));
const access=await req('/api/advisory/access',{method:'POST',body:{receiptCode:receipt}});assert.equal(access.status,200);assert.equal(access.data.item.status,'ADVISED');
const reports=await req('/api/advisory/reports?limit=5');assert.equal(reports.status,200);assert.ok(reports.data.items.length>=1);const publicReports=JSON.stringify(reports.data);assert.equal(publicReports.includes(receipt),false);assert.equal(publicReports.includes('最近排班和实际工时持续变化'),false);

const health=await req('/api/health',{requestOrigin:''});assert.equal(health.status,200);assert.equal(health.data.storage,'cloudflare-d1');
console.log(JSON.stringify({status:'PASS',backend:cfg.data.version,cors:true,csrf:true,d1:true,companyFlow:true,automaticResearchQueue:true,unattendedCompanyIntelligence:true,researchHealthContract:true,communityAgent:true,officialReferences:true,officialRelations:true,officialEvents:true,communityFeedback:true,publicAnnouncements:true,queuedCompanies:queuedStatus.data.queued,reviewExportCorrection:true,advisoryAgentReport:true,receiptPublicLeak:false,concurrentWrites:4}));
