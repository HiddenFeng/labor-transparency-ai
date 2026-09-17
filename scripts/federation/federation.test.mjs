import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bootstrapInstance} from '../instance/bootstrap.mjs';
import {createIndependentApp,loadInstanceBundle} from '../instance/start.mjs';
import {exportFederationSnapshot} from './export.mjs';
import {importFederationSnapshot} from './import.mjs';
import {buildFederationSnapshot,verifyFederationSnapshot} from '../../sites-app/src/federation.mjs';

class Client{
  constructor(base){this.base=base;this.cookie='';this.csrf=''}
  async request(url,{method='GET',body,token}={}){
    const headers={Accept:'application/json'};if(this.cookie)headers.Cookie=this.cookie;
    if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=this.base;if(this.csrf)headers['X-Ltp-Csrf']=this.csrf;}
    if(token)headers.Authorization=`Bearer ${token}`;
    const res=await fetch(this.base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const set=res.headers.get('set-cookie');if(set)this.cookie=set.split(';')[0];const data=await res.json().catch(()=>({}));return {status:res.status,data};
  }
  async config(){const out=await this.request('/api/config');assert.equal(out.status,200);this.csrf=out.data.csrfToken;return out.data}
}
async function listen(app){await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve)});return `http://127.0.0.1:${app.server.address().port}`;}
async function close(server){if(server.listening)await new Promise(resolve=>server.close(resolve));}
function claimPayload(companyId,extra={}){return {companyId,kind:'labour_claim',title:'联邦工资实践',description:'用于跨独立实例验证的公开劳动证据。',scope:'示例公开岗位',periodStart:'2026-01-01',periodEnd:'2026-12-31',direction:'negative',dimension:'pay',productId:'',brandId:'',relationType:'',relation:'',category:'',sources:[{url:'https://example.org/public-evidence',title:'公开劳动证据',type:'public_record',publishedAt:'2026-09-01',supports:'仅支持这条示例工资实践主张'}],public:true,consent:true,shareConsent:true,rights:'own_summary',rightsNote:'',creditName:'公开测试贡献者',...extra};}

async function approveClaim(client,bundle,claimId,version){
  const review=await client.request(`/api/contributions/${claimId}/review`,{method:'POST',token:bundle.secrets.reviewToken,body:{version,decision:'approve',evidence:'E3',rationale:'已核对公开来源、时间与适用范围，只支持该条具体主张。',scopeChecked:true,authenticityChecked:true,sourceIds:['S1']}});assert.equal(review.status,200,JSON.stringify(review.data));
  const exp=await client.request(`/api/contributions/${claimId}/approve-export`,{method:'POST',token:bundle.secrets.exportToken,body:{version,privacyChecked:true,rightsChecked:true,reason:'已确认该公开摘要允许非商业公益再分发且不含私人信息。'}});assert.equal(exp.status,200,JSON.stringify(exp.data));
}

test('two independent instances exchange only signed redistribution-approved public evidence with tombstone/correction history',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-federation-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const dirA=path.join(root,'a');const dirB=path.join(root,'b');const dirC=path.join(root,'c');
  await bootstrapInstance({dir:dirA,name:'联邦来源 A'});await bootstrapInstance({dir:dirB,name:'联邦接收 B'});await bootstrapInstance({dir:dirC,name:'攻击密钥 C'});
  const bundleA=await loadInstanceBundle({dir:dirA});const bundleB=await loadInstanceBundle({dir:dirB});const bundleC=await loadInstanceBundle({dir:dirC});

  const appA=await createIndependentApp({dir:dirA});let appB=await createIndependentApp({dir:dirB});t.after(()=>close(appA.server));t.after(()=>close(appB.server));
  const baseA=await listen(appA);let baseB=await listen(appB);const a=new Client(baseA);let b=new Client(baseB);await a.config();const cfgB=await b.config();assert.equal(cfgB.capabilities.federatedPublicEvidence,true);
  async function restartB(){appB=await createIndependentApp({dir:dirB});baseB=await listen(appB);b=new Client(baseB);await b.config();}
  async function offlineImport(file){await close(appB.server);try{return await importFederationSnapshot({dir:dirB,file,serviceStoppedConfirmed:true})}finally{await restartB()}}

  const company=await a.request('/api/companies',{method:'POST',body:{name:'联邦公开公司',region:'示例地区',website:'',consent:true}});assert.equal(company.status,200);const companyId=company.data.company.id;
  await a.request(`/api/companies/${companyId}/ballot`,{method:'POST',body:{direction:'positive'}});
  await a.request(`/api/companies/${companyId}/ballot`,{method:'POST',body:{direction:'negative',signalType:'worker'}});
  await a.request('/api/community-feedback',{method:'POST',body:{type:'suggestion',companyId,message:'PRIVATE-FEEDBACK-MARKER 仅应保留在来源实例。',consent:true}});
  await a.request('/api/advisory',{method:'POST',body:{category:'pay',companyId:'',region:'示例地区',employmentStatus:'current',summary:'PRIVATE-ADVISORY-MARKER 最近工资记录有变化，希望先整理公开事实。',desiredOutcome:'希望知道如何整理自己的记录。',tried:'已经保存自己合法持有的工资记录。',urgency:'routine',privacyConfirmed:true,consent:true}});
  const claim=await a.request('/api/contributions',{method:'POST',body:claimPayload(companyId)});assert.equal(claim.status,200);const claimId=claim.data.item.id;await approveClaim(a,bundleA,claimId,1);

  const snap1=await exportFederationSnapshot({dir:dirA,out:path.join(root,'snapshot-1.json')});verifyFederationSnapshot(snap1.snapshot);assert.equal(snap1.snapshot.recordCount,1);assert.equal(snap1.snapshot.previousRoot,'');assert.equal(snap1.snapshot.delta.upserts.length,1);assert.equal(snap1.snapshot.delta.tombstones.length,0);
  const serialized1=JSON.stringify(snap1.snapshot);
  for(const forbidden of ['PRIVATE-FEEDBACK-MARKER','PRIVATE-ADVISORY-MARKER','communityFeedback','advisoryCases','ballots','owner','sessionSecret','reviewToken','signingPrivateKey'])assert.equal(serialized1.includes(forbidden),false,`federation snapshot leaked ${forbidden}`);
  assert.equal(serialized1.includes('联邦工资实践'),true);

  await assert.rejects(()=>importFederationSnapshot({dir:dirB,file:snap1.target}),/--service-stopped/);
  const imported1=await offlineImport(snap1.target);assert.equal(imported1.result.upserted,1);assert.equal(imported1.result.tombstoned,0);assert.equal(imported1.result.chainStart,'GENESIS');
  const replay=await offlineImport(snap1.target);assert.equal(replay.result.alreadyApplied,true);
  let publicFed=await b.request('/api/federation/evidence');assert.equal(publicFed.status,200);assert.equal(publicFed.data.items.length,1);assert.equal(publicFed.data.items[0].status,'CURRENT');assert.equal(publicFed.data.items[0].record.claim.title,'联邦工资实践');assert.match(publicFed.data.boundary,/不包含用户身份/);assert.equal(JSON.stringify(publicFed.data).includes('PRIVATE-FEEDBACK-MARKER'),false);

  const tampered=structuredClone(snap1.snapshot);tampered.records[0].claim.description='被篡改的内容';const tamperedFile=path.join(root,'tampered.json');await fs.writeFile(tamperedFile,JSON.stringify(tampered));await assert.rejects(()=>offlineImport(tamperedFile),/(contentRoot|snapshotRoot|签名)/);

  const edited=await a.request(`/api/contributions/${claimId}`,{method:'PATCH',body:claimPayload(companyId,{description:'修订后的公开劳动证据，需要重新审核后才能再次联邦。'})});assert.equal(edited.status,200);assert.equal(edited.data.item.version,2);assert.equal(edited.data.item.exportApproved,false);
  await new Promise(resolve=>setTimeout(resolve,2));
  const snap2=await exportFederationSnapshot({dir:dirA,out:path.join(root,'snapshot-2.json')});assert.equal(snap2.snapshot.previousRoot,snap1.snapshot.snapshotRoot);assert.equal(snap2.snapshot.recordCount,0);assert.deepEqual(snap2.snapshot.delta.tombstones,[`${bundleA.instance.id}:${claimId}`]);
  const imported2=await offlineImport(snap2.target);assert.equal(imported2.result.tombstoned,1);
  publicFed=await b.request('/api/federation/evidence');assert.equal(publicFed.data.items[0].status,'TOMBSTONED');assert.equal(publicFed.data.items[0].record,null);assert.equal(publicFed.data.items[0].history.at(-1).event,'TOMBSTONE');assert.equal(JSON.stringify(publicFed.data).includes('用于跨独立实例验证的公开劳动证据'),false,'tombstone must not keep publishing withdrawn body text');

  await approveClaim(a,bundleA,claimId,2);await new Promise(resolve=>setTimeout(resolve,2));
  const snap3=await exportFederationSnapshot({dir:dirA,out:path.join(root,'snapshot-3.json')});assert.equal(snap3.snapshot.previousRoot,snap2.snapshot.snapshotRoot);assert.equal(snap3.snapshot.recordCount,1);assert.equal(snap3.snapshot.records[0].version,2);assert.equal(snap3.snapshot.delta.upserts.length,1);
  const imported3=await offlineImport(snap3.target);assert.equal(imported3.result.upserted,1);
  publicFed=await b.request('/api/federation/evidence');const current=publicFed.data.items[0];assert.equal(current.status,'CURRENT');assert.equal(current.sourceVersion,2);assert.match(current.record.claim.description,/修订后的公开劳动证据/);assert.deepEqual(current.history.map(x=>x.event),['UPSERT','TOMBSTONE','RESTORE']);

  const exportState=JSON.parse(await fs.readFile(path.join(dirA,'federation','export-state.json'),'utf8'));
  const rotated=buildFederationSnapshot({state:appA.runtime.store.read(),instance:{...bundleA.instance,publicKey:bundleC.instance.publicKey},signingPrivateKey:bundleC.secrets.signingPrivateKey,previousExportState:exportState,generatedAt:new Date(Date.now()+10).toISOString()}).snapshot;
  const rotatedFile=path.join(root,'rotated-key.json');await fs.writeFile(rotatedFile,JSON.stringify(rotated));await assert.rejects(()=>offlineImport(rotatedFile),/公钥发生变化/);

  await new Promise(resolve=>setTimeout(resolve,2));const snap4=await exportFederationSnapshot({dir:dirA,out:path.join(root,'snapshot-4.json')});await new Promise(resolve=>setTimeout(resolve,2));const snap5=await exportFederationSnapshot({dir:dirA,out:path.join(root,'snapshot-5.json')});assert.equal(snap5.snapshot.previousRoot,snap4.snapshot.snapshotRoot);await assert.rejects(()=>offlineImport(snap5.target),/快照链不连续/);
  await assert.rejects(()=>offlineImport(snap1.target),/快照链不连续/);

  assert.notEqual(bundleA.instance.id,bundleB.instance.id);assert.notEqual(bundleA.instance.publicKey.value,bundleB.instance.publicKey.value);
});

test('federation CLI requires explicit stopped-service gate and can exchange an empty signed snapshot',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-federation-cli-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const dirA=path.join(root,'a');const dirB=path.join(root,'b');const snap=path.join(root,'empty.snapshot.json');
  await bootstrapInstance({dir:dirA,name:'CLI 来源实例'});await bootstrapInstance({dir:dirB,name:'CLI 接收实例'});
  const exportScript=new URL('./export.mjs',import.meta.url);const importScript=new URL('./import.mjs',import.meta.url);
  const exported=spawnSync(process.execPath,[exportScript.pathname,'--dir',dirA,'--out',snap],{encoding:'utf8'});assert.equal(exported.status,0,exported.stderr);assert.match(exported.stdout,/FEDERATION_EXPORT_PASS/);assert.equal(JSON.parse(exported.stdout.trim()).recordCount,0);
  const denied=spawnSync(process.execPath,[importScript.pathname,'--dir',dirB,'--file',snap],{encoding:'utf8'});assert.notEqual(denied.status,0);assert.match(denied.stderr,/--service-stopped/);
  const imported=spawnSync(process.execPath,[importScript.pathname,'--dir',dirB,'--file',snap,'--service-stopped'],{encoding:'utf8'});assert.equal(imported.status,0,imported.stderr);const summary=JSON.parse(imported.stdout.trim());assert.equal(summary.status,'FEDERATION_IMPORT_PASS');assert.equal(summary.recordCount,0);assert.equal(summary.chainStart,'GENESIS');
});
