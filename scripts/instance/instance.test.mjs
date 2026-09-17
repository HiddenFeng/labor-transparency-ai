import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {bootstrapInstance} from './bootstrap.mjs';
import {createIndependentApp,loadInstanceBundle} from './start.mjs';

class Client{
  constructor(base){this.base=base;this.cookie='';this.csrf=''}
  async request(url,{method='GET',body}={}){
    const headers={Accept:'application/json'};
    if(this.cookie)headers.Cookie=this.cookie;
    if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=this.base;if(this.csrf)headers['X-Ltp-Csrf']=this.csrf;}
    const res=await fetch(this.base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    const set=res.headers.get('set-cookie');if(set)this.cookie=set.split(';')[0];
    const data=await res.json().catch(()=>({}));return {status:res.status,data,headers:res.headers};
  }
  async config(){const out=await this.request('/api/config');assert.equal(out.status,200);this.csrf=out.data.csrfToken;return out.data}
}

async function listen(app){
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve)});
  return `http://127.0.0.1:${app.server.address().port}`;
}
async function close(server){if(server.listening)await new Promise(resolve=>server.close(resolve));}

test('fresh independent instance bootstraps private local state and runs without reference production dependency',async t=>{
  const parent=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-independent-'));
  const dir=path.join(parent,'instance');
  t.after(()=>fs.rm(parent,{recursive:true,force:true}));

  const result=await bootstrapInstance({dir,name:'独立测试实例',operator:'公益测试组织',port:0});
  assert.equal(result.instance.mode,'independent');
  assert.equal(result.instance.runtime.sameOrigin,true);
  assert.equal(result.instance.runtime.referenceProductionDependency,false);
  assert.match(result.instance.id,/^ltp_[a-f0-9]{24}$/);
  assert.equal(JSON.stringify(result.instance).includes('workermanifestfellowship'),false);
  assert.equal(JSON.stringify(result.instance).includes('labor-transparency-public.workers.dev'),false);
  assert.equal(await fs.stat(result.paths.config).then(x=>x.isFile()),true);
  assert.equal(await fs.stat(path.join(dir,'data')).then(x=>x.isDirectory()),true);
  if(process.platform!=='win32'){
    const secretMode=(await fs.stat(result.paths.secrets)).mode&0o777;
    assert.equal(secretMode&0o077,0,'secrets must not be group/world accessible');
  }
  await assert.rejects(()=>bootstrapInstance({dir,name:'不应覆盖'}),/拒绝覆盖/);

  const bundle=await loadInstanceBundle({dir});
  const message=Buffer.from('instance-key-self-check');
  const privateKey=crypto.createPrivateKey({key:Buffer.from(bundle.secrets.signingPrivateKey.value,'base64'),type:'pkcs8',format:'der'});
  const publicKey=crypto.createPublicKey({key:Buffer.from(bundle.instance.publicKey.value,'base64'),type:'spki',format:'der'});
  const signature=crypto.sign(null,message,privateKey);
  assert.equal(crypto.verify(null,message,publicKey,signature),true,'generated public/private instance key pair must correspond');

  let app=await createIndependentApp({dir});t.after(()=>close(app.server));
  let base=await listen(app);let client=new Client(base);const cfg=await client.config();
  assert.equal(cfg.mode,'INDEPENDENT_LOCAL_INSTANCE');
  assert.equal(cfg.instance.id,result.instance.id);assert.equal(cfg.instance.name,'独立测试实例');assert.equal(cfg.instance.mode,'independent');
  assert.equal(cfg.instance.referenceProductionDependency,false);assert.equal(cfg.instance.publicKey.value,result.instance.publicKey.value);
  const publicConfigText=JSON.stringify(cfg);
  for(const secretName of ['sessionSecret','reviewToken','exportToken','advisoryAgentToken','communityAgentToken','signingPrivateKey'])assert.equal(publicConfigText.includes(secretName),false,`public config must not expose ${secretName}`);
  const health=await client.request('/api/health');assert.equal(health.status,200);assert.deepEqual(health.data.instance,{id:result.instance.id,mode:'independent'});assert.equal(health.data.storage,'local-file-adapter');

  const company=await client.request('/api/companies',{method:'POST',body:{name:'独立实例公司',region:'示例地区',website:'',consent:true}});assert.equal(company.status,200);const companyId=company.data.company.id;
  const community=await client.request(`/api/companies/${companyId}/ballot`,{method:'POST',body:{direction:'positive'}});assert.equal(community.status,200);assert.equal(community.data.signalType,'community');
  const worker=await client.request(`/api/companies/${companyId}/ballot`,{method:'POST',body:{direction:'negative',signalType:'worker'}});assert.equal(worker.status,200);assert.equal(worker.data.signalType,'worker');
  const product=await client.request('/api/contributions',{method:'POST',body:{companyId,kind:'product',title:'独立实例产品',description:'只用于验证本地独立实例产品链路。',scope:'',periodStart:'',periodEnd:'',direction:'neutral',dimension:'other',productId:'',brandId:'',relationType:'',relation:'',category:'测试',sources:[],public:true,consent:true,shareConsent:false,rights:'own_summary',rightsNote:'',creditName:''}});assert.equal(product.status,200);
  const market=await client.request('/api/product-market?lane=worker_negative');assert.equal(market.status,200);assert.equal(market.data.items.length,1);assert.equal(market.data.items[0].workerPerspective.negative,1);assert.equal(market.data.items[0].community.positive,1);
  assert.equal(JSON.stringify(market.data).includes('owner'),false);

  const instanceIdBefore=cfg.instance.id;
  await close(app.server);
  app=await createIndependentApp({dir});base=await listen(app);client=new Client(base);const cfgAfter=await client.config();
  assert.equal(cfgAfter.instance.id,instanceIdBefore,'instance identity must persist across runtime restart');
  const companiesAfter=await client.request('/api/companies');const restored=companiesAfter.data.items.find(x=>x.id===companyId);assert.ok(restored);assert.equal(restored.workerPerspective.negative,1);assert.equal(restored.positive,1);
  const marketAfter=await client.request('/api/product-market?lane=worker_negative');assert.ok(marketAfter.data.items.some(x=>x.product.id===product.data.item.id));
});

test('independent instance loader fails closed on remote upstream config and loose secret permissions',async t=>{
  const parent=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-independent-guard-'));const dir=path.join(parent,'instance');t.after(()=>fs.rm(parent,{recursive:true,force:true}));
  await bootstrapInstance({dir,name:'边界测试实例'});
  const configPath=path.join(dir,'instance.json');const config=JSON.parse(await fs.readFile(configPath,'utf8'));config.runtime.apiBase='https://workermanifestfellowship.dpdns.org';await fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n');
  await assert.rejects(()=>loadInstanceBundle({dir}),/禁止远程上游配置/);
  delete config.runtime.apiBase;await fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n');
  if(process.platform!=='win32'){
    await fs.chmod(path.join(dir,'secrets.json'),0o644);
    await assert.rejects(()=>loadInstanceBundle({dir}),/权限过宽/);
  }
});
