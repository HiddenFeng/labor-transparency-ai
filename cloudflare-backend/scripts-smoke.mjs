import assert from 'node:assert/strict';

const base=String(process.env.LTP_SMOKE_BASE||'http://127.0.0.1:8790').replace(/\/$/,'');
const origin=String(process.env.LTP_SMOKE_ORIGIN||'http://127.0.0.1:8791');
const reviewToken=String(process.env.LTP_SMOKE_REVIEW_TOKEN||'review-local-only');
const exportToken=String(process.env.LTP_SMOKE_EXPORT_TOKEN||'export-local-only');
const agentToken=String(process.env.LTP_SMOKE_AGENT_TOKEN||'advisory-local-only');
const researchToken=String(process.env.LTP_SMOKE_RESEARCH_TOKEN||'research-local-only');
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
assert.equal(cfg.status,200);assert.equal(cfg.data.version,'0.8.1-rc.2');assert.equal(cfg.data.mode,'CLOUDFLARE_WORKER_D1');assert.ok(cookie.startsWith('ltp_session='));assert.equal(cfg.headers.get('access-control-allow-origin'),origin);csrf=cfg.data.csrfToken;assert.match(csrf,/^[a-f0-9]{64}$/);
const researchStatus=await req('/api/research/status');assert.equal(researchStatus.status,200);assert.equal(researchStatus.data.companiesTracked,0);assert.match(researchStatus.data.boundary,/候选/);
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
assert.equal(company.status,200);const companyId=company.data.company.id;assert.ok(companyId);
const ballot=await req(`/api/companies/${companyId}/ballot`,{method:'POST',body:{direction:'negative'}});assert.equal(ballot.status,200);
const concurrentNames=await Promise.all([0,1,2,3].map(i=>createIsolatedCompany(i,suffix)));
const afterConcurrent=await req('/api/companies');assert.equal(afterConcurrent.status,200);for(const name of concurrentNames)assert.ok(afterConcurrent.data.items.some(x=>x.name===name));

const contribution=await req('/api/contributions',{method:'POST',body:{companyId,kind:'labour_claim',title:'示例工时记录',description:'用于验证独立部署链路的合成公开线索。',scope:'示例岗位',periodStart:'2026-01-01',periodEnd:'2026-12-31',direction:'negative',dimension:'hours',productId:'',relation:'',category:'',sources:[{url:'https://example.org/evidence',title:'合成公开来源',type:'public_record',publishedAt:'2026-01-01',supports:'仅用于本地自动化测试的合成范围'}],public:true,consent:true,shareConsent:true,rights:'own_summary',rightsNote:'',creditName:'自动化测试'}});
assert.equal(contribution.status,200);assert.equal(contribution.data.item.evidence,'E0');const cid=contribution.data.item.id;const version=contribution.data.item.version;

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
console.log(JSON.stringify({status:'PASS',backend:cfg.data.version,cors:true,csrf:true,d1:true,companyFlow:true,reviewExportCorrection:true,advisoryAgentReport:true,receiptPublicLeak:false,concurrentWrites:4}));
