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

async function start({dataFile,secret='S'.repeat(64),reviewToken='review-secret',exportToken='export-secret',advisoryAgentToken='advisory-agent-secret',seed=false}={}){
  const runtime=await createRuntime({dataFile,sessionSecret:secret,reviewToken,exportToken,advisoryAgentToken,seed});
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
  assert.equal(cfg.version,'0.8.1-rc.2');assert.equal(cfg.capabilities.attachments,false);assert.equal(cfg.capabilities.privateSensitiveInfo,false);assert.equal(cfg.capabilities.anonymousAdvisory,true);

  const company=await client.request('/api/companies',{method:'POST',body:{name:'HTTP示例公司',region:'示例地区',website:'https://example.org',consent:true}});
  assert.equal(company.status,200);const cid=company.data.company.id;
  const ballot=await client.request(`/api/companies/${cid}/ballot`,{method:'POST',body:{direction:'positive'}});assert.equal(ballot.status,200);

  const product=await client.request('/api/contributions',{method:'POST',body:{companyId:cid,kind:'product',title:'示例产品',description:'未独立核实的产品线索。',scope:'',periodStart:'',periodEnd:'',direction:'neutral',dimension:'other',productId:'',relation:'',category:'示例',sources:[],public:true,consent:true,shareConsent:false,rights:'reference_only',rightsNote:'',creditName:''}});
  assert.equal(product.status,200);assert.equal(product.data.item.evidence,'E0');
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
