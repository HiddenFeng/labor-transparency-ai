import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {bootstrapInstance} from './bootstrap.mjs';
import {backupInstance} from './backup.mjs';
import {restoreInstance} from './restore.mjs';
import {preflightInstance} from './preflight.mjs';
import {healthcheck} from './healthcheck.mjs';
import {loadInstanceBundle} from './start.mjs';
import {verifyBackupDirectory} from './backup-lib.mjs';
import {buildSelfHostRelease,verifySelfHostRelease} from './build-self-host-release.mjs';
import {exportFederationSnapshot} from '../federation/export.mjs';
import {packageSignedSnapshot} from '../federation/package.mjs';
import {createPeerDescriptor} from '../federation/descriptor.mjs';
import {trustPeer} from '../federation/trust-peer.mjs';

class Client{
  constructor(base){this.base=base;this.cookie='';this.csrf=''}
  async request(url,{method='GET',body}={}){const headers={Accept:'application/json'};if(this.cookie)headers.Cookie=this.cookie;if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=this.base;if(this.csrf)headers['X-Ltp-Csrf']=this.csrf;}const res=await fetch(this.base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const set=res.headers.get('set-cookie');if(set)this.cookie=set.split(';')[0];const data=await res.json().catch(()=>({}));return {status:res.status,data,headers:res.headers};}
  async config(){const out=await this.request('/api/config');assert.equal(out.status,200);this.csrf=out.data.csrfToken;return out.data}
}
async function freePort(){const s=http.createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve)});const port=s.address().port;await new Promise(resolve=>s.close(resolve));return port;}
async function spawnSelfHost({dir,name='Self Host Test',port,releaseRoot=''}){
  const script=releaseRoot?path.join(releaseRoot,'scripts/instance/self-host-server.mjs'):new URL('./self-host-server.mjs',import.meta.url).pathname;const child=spawn(process.execPath,[script],{env:{...process.env,LTP_INSTANCE_DIR:dir,LTP_INSTANCE_NAME:name,LTP_INSTANCE_OPERATOR:'Test Public Interest Group',LTP_SELF_HOST_SECURE_COOKIE:'false',LTP_SELF_HOST_ALLOWED_HOSTS:'127.0.0.1,localhost',HOST:'127.0.0.1',PORT:String(port)},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
  const base=`http://127.0.0.1:${port}`;for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error(`self-host exited ${child.exitCode}: ${stderr}`);try{const out=await fetch(`${base}/api/health`);if(out.ok)return {child,base,getStdout:()=>stdout,getStderr:()=>stderr}}catch{}await new Promise(r=>setTimeout(r,50));}child.kill('SIGTERM');throw new Error(`self-host did not become ready: ${stderr}`);
}
async function stopChild(child){if(child.exitCode!==null)return;child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
async function rawStatus({port,hostHeader,pathName='/api/health'}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:pathName,method:'GET',headers:{Host:hostHeader}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});}
async function treeContains(root,needle){for(const name of await fs.readdir(root)){const p=path.join(root,name);const stat=await fs.stat(p);if(stat.isDirectory()){if(await treeContains(p,needle))return true}else if(stat.isFile()){const data=await fs.readFile(p);if(data.includes(Buffer.from(needle)))return true}}return false;}


test('self-host runtime bootstraps, preserves state, backs up/restores private instance metadata and enforces host boundary',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-selfhost-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const instanceDir=path.join(root,'volume','instance');const port=await freePort();let running=await spawnSelfHost({dir:instanceDir,port});t.after(()=>stopChild(running.child));const client=new Client(running.base);const cfg=await client.config();assert.equal(cfg.mode,'INDEPENDENT_LOCAL_INSTANCE');assert.equal(cfg.cookieSecure,false);assert.equal(cfg.instance.referenceProductionDependency,false);const instanceId=cfg.instance.id;
  assert.equal(await rawStatus({port,hostHeader:'evil.invalid'}),403);assert.equal(await rawStatus({port,hostHeader:`127.0.0.1:${port}`}),200);
  const co=await client.request('/api/companies',{method:'POST',body:{name:'Self Host 持久公司',region:'示例地区',website:'',consent:true}});assert.equal(co.status,200);const companyId=co.data.company.id;const worker=await client.request(`/api/companies/${companyId}/ballot`,{method:'POST',body:{direction:'positive',signalType:'worker'}});assert.equal(worker.status,200);const product=await client.request('/api/contributions',{method:'POST',body:{companyId,kind:'product',title:'Self Host 产品',description:'用于验证自托管持久卷。',scope:'',periodStart:'',periodEnd:'',direction:'neutral',dimension:'other',productId:'',brandId:'',relationType:'',relation:'',category:'测试',sources:[],public:true,consent:true,shareConsent:false,rights:'own_summary',rightsNote:'',creditName:''}});assert.equal(product.status,200);
  const hc=await healthcheck({url:running.base,expectedInstanceId:instanceId});assert.equal(hc.status,'HEALTHCHECK_PASS');await stopChild(running.child);

  const sourcePeer=path.join(root,'peer-source');await bootstrapInstance({dir:sourcePeer,name:'Backup Peer Source'});const exportedPeer=await exportFederationSnapshot({dir:sourcePeer,out:path.join(root,'peer.snapshot.json')});const packagedPeer=await packageSignedSnapshot({snapshotFile:exportedPeer.target,outRoot:path.join(root,'peer-package')});const peerDescriptor=await createPeerDescriptor({dir:sourcePeer,packageDir:packagedPeer.packageDir,mirrorUrls:['https://mirror.example/public-evidence'],out:path.join(root,'peer.json'),generatedAt:'2026-09-17T04:00:00.000Z'});await trustPeer({dir:instanceDir,descriptorInput:peerDescriptor.target,trust:true});
  await exportFederationSnapshot({dir:instanceDir,out:path.join(root,'self.snapshot.json')});
  const pre=await preflightInstance({dir:instanceDir});assert.equal(pre.instanceId,instanceId);assert.equal(pre.peerCount,1);assert.equal(pre.hasExportState,true);assert.equal(pre.companies,1);
  await assert.rejects(()=>backupInstance({dir:instanceDir,out:path.join(root,'backup-denied')}),/--service-stopped/);const backupDir=path.join(root,'backup-good');const backup=await backupInstance({dir:instanceDir,out:backupDir,serviceStoppedConfirmed:true,createdAt:'2026-09-17T04:05:00.000Z'});assert.equal(backup.manifest.instanceId,instanceId);assert.equal(backup.manifest.files.length,5);await verifyBackupDirectory(backupDir);await assert.rejects(()=>backupInstance({dir:instanceDir,out:backupDir,serviceStoppedConfirmed:true}),/已存在/);
  const originalBundle=await loadInstanceBundle({dir:instanceDir});const restoreDir=path.join(root,'restored','instance');const restored=await restoreInstance({backupDir,dir:restoreDir,serviceStoppedConfirmed:true});assert.equal(restored.instanceId,instanceId);const restoredBundle=await loadInstanceBundle({dir:restoreDir});assert.equal(restoredBundle.secrets.sessionSecret,originalBundle.secrets.sessionSecret);assert.equal(restoredBundle.secrets.signingPrivateKey.value,originalBundle.secrets.signingPrivateKey.value);const restoredPre=await preflightInstance({dir:restoreDir,backupDir});assert.equal(restoredPre.peerCount,1);assert.equal(restoredPre.hasExportState,true);assert.equal(restoredPre.companies,1);
  const nonempty=path.join(root,'nonempty');await fs.mkdir(nonempty,{recursive:true});await fs.writeFile(path.join(nonempty,'keep.txt'),'keep');await assert.rejects(()=>restoreInstance({backupDir,dir:nonempty,serviceStoppedConfirmed:true}),/非空/);
  const corruptBackup=path.join(root,'backup-corrupt');await fs.cp(backupDir,corruptBackup,{recursive:true});await fs.appendFile(path.join(corruptBackup,'instance','data','state.json'),'CORRUPT');await assert.rejects(()=>verifyBackupDirectory(corruptBackup),/hash\/size/);

  const restoredPort=await freePort();running=await spawnSelfHost({dir:restoreDir,port:restoredPort,name:'Ignored on restore'});const restoredClient=new Client(running.base);const restoredCfg=await restoredClient.config();assert.equal(restoredCfg.instance.id,instanceId);const companies=await restoredClient.request('/api/companies');const restoredCompany=companies.data.items.find(x=>x.id===companyId);assert.ok(restoredCompany);assert.equal(restoredCompany.workerPerspective.positive,1);const products=await restoredClient.request('/api/product-market?lane=all');assert.ok(products.data.items.some(x=>x.product.id===product.data.item.id));await stopChild(running.child);

  const releaseA=path.join(root,'release-a'),releaseB=path.join(root,'release-b');const builtA=await buildSelfHostRelease({out:releaseA,revision:'rev-a',createdAt:'2026-09-17T04:10:00.000Z'});const builtB=await buildSelfHostRelease({out:releaseB,revision:'rev-b',createdAt:'2026-09-17T04:11:00.000Z'});await verifySelfHostRelease(releaseA);await verifySelfHostRelease(releaseB);assert.notEqual(builtA.manifest.revision,builtB.manifest.revision);for(const secret of [restoredBundle.secrets.sessionSecret,restoredBundle.secrets.reviewToken,restoredBundle.secrets.exportToken,restoredBundle.secrets.signingPrivateKey.value]){assert.equal(await treeContains(releaseA,secret),false,'release bundle must not contain generated instance secret material');assert.equal(await treeContains(releaseB,secret),false,'release bundle must not contain generated instance secret material');}
  const releasePortA=await freePort();running=await spawnSelfHost({dir:restoreDir,port:releasePortA,releaseRoot:releaseA});let releaseClient=new Client(running.base);let releaseCfg=await releaseClient.config();assert.equal(releaseCfg.instance.id,instanceId);await stopChild(running.child);const releasePortB=await freePort();running=await spawnSelfHost({dir:restoreDir,port:releasePortB,releaseRoot:releaseB});releaseClient=new Client(running.base);releaseCfg=await releaseClient.config();assert.equal(releaseCfg.instance.id,instanceId);const releaseCompanies=await releaseClient.request('/api/companies');assert.ok(releaseCompanies.data.items.some(x=>x.id===companyId));await stopChild(running.child);
});
