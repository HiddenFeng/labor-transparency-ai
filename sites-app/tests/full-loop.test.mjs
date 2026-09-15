import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRuntime,createAppServer} from '../src/server.mjs';

class Client{
  constructor(base){this.base=base;this.cookie='';this.csrf=''}
  async req(url,{method='GET',body,token}={}){const headers={Accept:'application/json'};if(this.cookie)headers.Cookie=this.cookie;if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=this.base;headers['X-Ltp-Csrf']=this.csrf}if(token)headers.Authorization=`Bearer ${token}`;const r=await fetch(this.base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const set=r.headers.get('set-cookie');if(set)this.cookie=set.split(';')[0];const data=await r.json().catch(()=>({}));return {status:r.status,data}}
  async config(){const r=await this.req('/api/config');assert.equal(r.status,200);this.csrf=r.data.csrfToken;return r.data}
}
async function start(file){const runtime=await createRuntime({dataFile:file,sessionSecret:'Z'.repeat(64),reviewToken:'review-full',exportToken:'export-full',advisoryAgentToken:'advisory-full'});const {server}=await createAppServer({runtime});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});return {server,base:`http://127.0.0.1:${server.address().port}`}}

function claim(cid){return {companyId:cid,kind:'labour_claim',title:'完整闭环休息实践',description:'这是完整用户流程测试中的公开合成劳动实践记录。',scope:'完整闭环测试厂区',periodStart:'2026-01-01',periodEnd:'2099-12-31',direction:'positive',dimension:'rest',productId:'',relation:'',category:'',sources:[{url:'https://example.org/full-loop',title:'完整闭环公开材料',type:'public_record',publishedAt:'2026-01-01',supports:'仅支持本条完整闭环合成劳动实践'}],public:true,consent:true,shareConsent:true,rights:'own_summary',rightsNote:'',creditName:''}}
function advisory(cid){return {category:'contract',companyId:cid,region:'示例地区',employmentStatus:'current',summary:'劳动安排发生变化，我想把合同和通知的时间线整理清楚后再决定下一步。',desiredOutcome:'得到一份不涉及私密信息的材料整理和行动顺序建议。',tried:'已经查看自己合法持有的合同版本和公开员工政策。',urgency:'soon',privacyConfirmed:true,consent:true}}

test('complete user cycle: company -> participation -> evidence -> correction -> advisory -> agent -> report -> restart',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-full-cycle-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'state.json');let env=await start(file);t.after(()=>env.server.listening&&env.server.close());
  const u=new Client(env.base);await u.config();
  const coverage=await u.req('/api/research/coverage');assert.equal(coverage.data.sections.find(x=>x.key==='identity').status,'AUTOMATED_SUPPORTED');assert.equal(coverage.data.sections.find(x=>x.key==='facilities').status,'AUTOMATED_PARTIAL_REGION_LIMITED');
  const co=await u.req('/api/companies',{method:'POST',body:{name:'完整闭环公司',region:'示例地区',website:'https://example.org',consent:true}});assert.equal(co.status,200);const cid=co.data.company.id;
  assert.equal((await u.req(`/api/companies/${cid}/ballot`,{method:'POST',body:{direction:'positive'}})).status,200);
  const product=await u.req('/api/contributions',{method:'POST',body:{companyId:cid,kind:'product',title:'完整闭环产品',description:'公开合成产品线索。',scope:'',periodStart:'',periodEnd:'',direction:'neutral',dimension:'other',productId:'',relation:'',category:'测试',sources:[],public:true,consent:true,shareConsent:false,rights:'reference_only',rightsNote:'',creditName:''}});assert.equal(product.data.item.evidence,'E0');
  const added=await u.req('/api/contributions',{method:'POST',body:claim(cid)});const id=added.data.item.id;assert.equal(added.data.item.status,'PENDING');
  const reviewed=await u.req(`/api/contributions/${id}/review`,{method:'POST',token:'review-full',body:{version:1,decision:'approve',evidence:'E3',rationale:'已核对本条范围、日期与公开来源。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']}});assert.equal(reviewed.data.evidence,'E3');
  assert.equal((await u.req(`/api/contributions/${id}/approve-export`,{method:'POST',token:'export-full',body:{version:1,privacyChecked:true,rightsChecked:true,reason:'独立完成结构化摘要的隐私和权利复核。'}})).status,200);
  assert.equal((await u.req('/api/public-data')).data.recordCount,1);
  await u.req(`/api/contributions/${id}/flag`,{method:'POST',body:{reason:'完整闭环测试：要求重新核对适用范围。'}});assert.equal((await u.req('/api/public-data')).data.recordCount,0);
  await u.req(`/api/contributions/${id}/review`,{method:'POST',token:'review-full',body:{version:1,decision:'approve',evidence:'E3',rationale:'已按纠错重新核对范围、日期与来源。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']}});
  await u.req(`/api/contributions/${id}/approve-export`,{method:'POST',token:'export-full',body:{version:1,privacyChecked:true,rightsChecked:true,reason:'纠错后重新完成独立隐私和权利复核。'}});assert.equal((await u.req('/api/public-data')).data.recordCount,1);
  const intake=await u.req('/api/advisory',{method:'POST',body:advisory(cid)});assert.equal(intake.status,200);const receipt=intake.data.receiptCode;
  const run=await u.req('/api/advisory-agent/run',{method:'POST',token:'advisory-full',body:{day:new Date().toISOString().slice(0,10),timeZone:'UTC'}});assert.equal(run.status,200);assert.equal(run.data.processedCount,1);
  const access=await u.req('/api/advisory/access',{method:'POST',body:{receiptCode:receipt}});assert.equal(access.data.item.status,'ADVISED');assert.ok(access.data.item.advice.steps.length>=3);
  const report=await u.req('/api/advisory/reports');assert.equal(report.data.items[0].receivedCount,1);assert.equal(JSON.stringify(report.data).includes(advisory(cid).summary),false);
  const cookie=u.cookie;await new Promise(r=>env.server.close(r));env=await start(file);u.base=env.base;u.cookie=cookie;await u.config();
  assert.ok((await u.req('/api/companies')).data.items.some(x=>x.id===cid));assert.ok((await u.req('/api/contributions?mine=1')).data.items.some(x=>x.id===id));assert.equal((await u.req('/api/advisory/access',{method:'POST',body:{receiptCode:receipt}})).data.item.status,'ADVISED');assert.equal((await u.req('/api/advisory/reports')).data.items.length,1);
  await new Promise(r=>env.server.close(r));
});
