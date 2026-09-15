import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {
  emptyState, addCompany, createReceiptCode, hashReceiptCode, addAdvisoryCase,
  listOwnAdvisory, accessAdvisoryByReceipt, advisoryAgentQueue, runAdvisoryAgent,
  publicAdvisoryReports, upgradeState
} from '../src/domain.mjs';
import {FileStore} from '../src/storage.mjs';
import {createRuntime,createAppServer} from '../src/server.mjs';

function advisoryPayload(companyId='',extra={}){
  return {
    category:'hours_rest', companyId, region:'示例地区', employmentStatus:'current',
    summary:'最近一段时间排班和休息安排反复变化，我想先把事实时间线整理清楚。',
    desiredOutcome:'确认下一步应整理哪些记录以及应查询哪些正式渠道。',
    tried:'已经保留了自己合法持有的排班记录，并做过一次内部沟通。', urgency:'routine',
    privacyConfirmed:true, consent:true, ...extra
  };
}

class Client{
  constructor(base){this.base=base;this.cookie='';this.csrf=''}
  async request(url,{method='GET',body,token,origin}={}){
    const headers={Accept:'application/json'};if(this.cookie)headers.Cookie=this.cookie;
    if(body!==undefined){headers['Content-Type']='application/json';if(this.csrf)headers['X-Ltp-Csrf']=this.csrf;headers.Origin=origin??this.base}
    if(token)headers.Authorization=`Bearer ${token}`;
    const r=await fetch(this.base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const set=r.headers.get('set-cookie');if(set)this.cookie=set.split(';')[0];
    return {status:r.status,data:await r.json().catch(()=>({}))};
  }
  async config(){const r=await this.request('/api/config');assert.equal(r.status,200);this.csrf=r.data.csrfToken;return r.data}
}
async function start(dataFile,secret='A'.repeat(64)){
  const runtime=await createRuntime({dataFile,sessionSecret:secret,reviewToken:'review',exportToken:'export',advisoryAgentToken:'agent-secret'});
  const {server}=await createAppServer({runtime});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  return {server,runtime,base:`http://127.0.0.1:${server.address().port}`};
}

test('advisory model stores only receipt hash and public daily report never contains case text',()=>{
  const state=emptyState();const {company}=addCompany(state,{name:'匿名辅导示例公司',region:'示例地区',website:'',consent:true},'owner-a');
  const code=createReceiptCode(),hash=hashReceiptCode(code);const item=addAdvisoryCase(state,advisoryPayload(company.id),'owner-a',hash);
  assert.equal(item.receiptHash,hash);assert.ok(!JSON.stringify(state).includes(code));
  assert.equal(listOwnAdvisory(state,'owner-a').length,1);assert.equal(listOwnAdvisory(state,'owner-b').length,0);
  assert.equal(accessAdvisoryByReceipt(state,hash).id,item.id);
  const queue=advisoryAgentQueue(state);assert.equal(queue.length,1);assert.equal('owner' in queue[0],false);assert.equal('receiptHash' in queue[0],false);
  const result=runAdvisoryAgent(state,{day:new Date(item.createdAt).toISOString().slice(0,10),timeZone:'UTC'});assert.equal(result.processedCount,1);
  const own=listOwnAdvisory(state,'owner-a')[0];assert.equal(own.status,'ADVISED');assert.ok(own.advice.steps.length>=3);
  const reports=publicAdvisoryReports(state);assert.equal(reports.length,1);const raw=JSON.stringify(reports[0]);
  assert.equal(raw.includes(item.summary),false);assert.equal(raw.includes(company.name),false);assert.equal(raw.includes(hash),false);assert.match(reports[0].privacy,/不含个案正文/);
});

test('advisory rejects sensitive identifiers and current private-service fields',()=>{
  const state=emptyState();
  for(const summary of ['请联系 worker@example.org 了解情况','我的手机号是13812345678请回电','身份证：请帮我处理扫描件','我想上传病历和银行卡信息']){
    assert.throws(()=>addAdvisoryCase(state,advisoryPayload('',{summary}),'owner-a','a'.repeat(64)),/私人|身份|健康|支付|附件/);
  }
  assert.throws(()=>addAdvisoryCase(state,{...advisoryPayload(''),email:'a@example.org'},'owner-a','a'.repeat(64)),/未定义字段/);
});

test('old v0.7 state upgrades without losing existing arrays',()=>{
  const old={schemaVersion:'0.7',version:'0.7.0-rc.1',revision:3,companies:[{id:'co_x'}],contributions:[],reviews:[],exportReviews:[],ballots:[],flags:[]};
  const upgraded=upgradeState(old);assert.equal(upgraded.schemaVersion,'0.8');assert.equal(upgraded.companies.length,1);assert.deepEqual(upgraded.advisoryCases,[]);assert.deepEqual(upgraded.advisoryAdvice,[]);assert.deepEqual(upgraded.advisoryDailyReports,[]);
});

test('real HTTP anonymous submit -> private agent advice -> receipt access -> aggregate report -> restart',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-advisory-http-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const dataFile=path.join(dir,'state.json');
  let env=await start(dataFile);t.after(()=>env.server.listening&&env.server.close());
  const a=new Client(env.base),b=new Client(env.base);const cfg=await a.config();await b.config();assert.equal(cfg.capabilities.anonymousAdvisory,true);assert.equal(cfg.capabilities.privateSensitiveInfo,false);
  const coverage=await a.request('/api/research/coverage');assert.equal(coverage.status,200);assert.equal(coverage.data.status,'MULTI_SOURCE_AUTOMATION_PARTIAL_GLOBAL_COVERAGE');assert.equal(coverage.data.sections.find(x=>x.key==='identity').status,'AUTOMATED_SUPPORTED');assert.equal(coverage.data.sections.find(x=>x.key==='work_conditions').status,'AUTOMATED_PARTIAL_REGION_LIMITED');assert.equal(coverage.data.sections.find(x=>x.key==='supply_chain').status,'AUTOMATED_PARTIAL_REGION_LIMITED');
  const co=await a.request('/api/companies',{method:'POST',body:{name:'匿名HTTP公司',region:'示例地区',website:'',consent:true}});const cid=co.data.company.id;
  const submitted=await a.request('/api/advisory',{method:'POST',body:advisoryPayload(cid)});assert.equal(submitted.status,200);assert.match(submitted.data.receiptCode,/^ADV-[A-Za-z0-9_-]{32}$/);const receipt=submitted.data.receiptCode;
  const rawText=await fs.readFile(dataFile,'utf8');assert.equal(rawText.includes(receipt),false);assert.equal(rawText.includes('worker@example.org'),false);
  const mine=await a.request('/api/advisory/mine');assert.equal(mine.data.items.length,1);assert.equal((await b.request('/api/advisory/mine')).data.items.length,0);
  const access=await b.request('/api/advisory/access',{method:'POST',body:{receiptCode:receipt}});assert.equal(access.status,200);assert.equal(access.data.item.status,'RECEIVED');
  const badQueue=await a.request('/api/advisory-agent/queue',{token:'wrong'});assert.equal(badQueue.status,403);
  const queue=await a.request('/api/advisory-agent/queue',{token:'agent-secret'});assert.equal(queue.status,200);assert.equal(queue.data.items.length,1);assert.equal('owner' in queue.data.items[0],false);assert.equal('receiptHash' in queue.data.items[0],false);
  const day=new Date().toISOString().slice(0,10);const run=await a.request('/api/advisory-agent/run',{method:'POST',token:'agent-secret',body:{day,timeZone:'UTC'}});assert.equal(run.status,200);assert.equal(run.data.processedCount,1);
  const advised=await b.request('/api/advisory/access',{method:'POST',body:{receiptCode:receipt}});assert.equal(advised.data.item.status,'ADVISED');assert.ok(advised.data.item.advice.steps.length>=3);assert.match(advised.data.item.advice.automationNotice,/另行建立专门联系渠道/);
  const reports=await b.request('/api/advisory/reports');assert.equal(reports.status,200);assert.equal(reports.data.items[0].receivedCount,1);const publicRaw=JSON.stringify(reports.data);assert.equal(publicRaw.includes(advisoryPayload(cid).summary),false);assert.equal(publicRaw.includes(cid),false);assert.equal(publicRaw.includes(receipt),false);
  const pii=await a.request('/api/advisory',{method:'POST',body:advisoryPayload(cid,{summary:'我的邮箱 worker@example.org 请联系我处理。'})});assert.equal(pii.status,400);
  const cross=await a.request('/api/advisory',{method:'POST',origin:'https://evil.example',body:advisoryPayload(cid)});assert.equal(cross.status,403);
  const cookie=a.cookie;await new Promise(r=>env.server.close(r));env=await start(dataFile);a.base=env.base;a.cookie=cookie;await a.config();const after=await a.request('/api/advisory/mine');assert.equal(after.data.items.length,1);assert.equal(after.data.items[0].status,'ADVISED');
  await new Promise(r=>env.server.close(r));
});

test('daily advisory runner uses live Agent API, updates running state, and logs aggregate counts only',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-advisory-runner-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'state.json');
  const env=await start(file);t.after(()=>env.server.listening&&env.server.close());const client=new Client(env.base);await client.config();
  const submitted=await client.request('/api/advisory',{method:'POST',body:advisoryPayload('')});assert.equal(submitted.status,200);const code=submitted.data.receiptCode;
  const script=new URL('../scripts/advisory-agent.mjs',import.meta.url);const child=spawn(process.execPath,[script.pathname,'--once','--base',env.base,'--token','agent-secret','--day',new Date().toISOString().slice(0,10),'--timezone','UTC'],{stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);const exit=await new Promise(resolve=>child.on('exit',resolve));assert.equal(exit,0,err);assert.match(out,/"mode": "HTTP_AGENT_API"/);assert.match(out,/"processedCount": 1/);assert.equal(out.includes('最近一段时间排班'),false);assert.equal(out.includes(code),false);
  const mine=await client.request('/api/advisory/mine');assert.equal(mine.data.items[0].status,'ADVISED');assert.equal((await client.request('/api/advisory/reports')).data.items.length,1);
  await new Promise(resolve=>env.server.close(resolve));
});

test('offline FileStore runner refuses live-service style use without explicit service-stopped gate',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-advisory-offline-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'state.json');const store=await new FileStore(file).init();const code=createReceiptCode();await store.transaction(s=>addAdvisoryCase(s,advisoryPayload(''),'owner-x',hashReceiptCode(code)));
  const script=new URL('../scripts/advisory-agent.mjs',import.meta.url);const denied=spawn(process.execPath,[script.pathname,'--once','--data',file],{stdio:['ignore','pipe','pipe']});let err='';denied.stderr.on('data',x=>err+=x);const deniedExit=await new Promise(resolve=>denied.on('exit',resolve));assert.notEqual(deniedExit,0);assert.match(err,/--service-stopped/);
  const ok=spawn(process.execPath,[script.pathname,'--once','--data',file,'--service-stopped','--day',new Date().toISOString().slice(0,10),'--timezone','UTC'],{stdio:['ignore','pipe','pipe']});let out='',err2='';ok.stdout.on('data',x=>out+=x);ok.stderr.on('data',x=>err2+=x);const exit=await new Promise(resolve=>ok.on('exit',resolve));assert.equal(exit,0,err2);assert.match(out,/OFFLINE_FILE_SERVICE_STOPPED/);assert.equal(out.includes(code),false);
});
