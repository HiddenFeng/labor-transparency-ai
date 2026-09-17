import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bootstrapInstance} from '../instance/bootstrap.mjs';
import {loadInstanceBundle} from '../instance/start.mjs';
import {exportFederationSnapshot} from './export.mjs';
import {packageSignedSnapshot} from './package.mjs';
import {publishPackageToMirrors} from './publish-mirrors.mjs';
import {verifyMirrorSnapshot} from './verify-mirror.mjs';
import {resolveFromMirrors} from './resolve-mirrors.mjs';
import {readMirrorIndex,sourcePathId,verifyPublicationPackage} from '../../sites-app/src/snapshot-mirror.mjs';

async function readTreeText(root){let out='';for(const name of await fs.readdir(root)){const p=path.join(root,name);const s=await fs.stat(p);if(s.isDirectory())out+=await readTreeText(p);else out+=await fs.readFile(p,'utf8').catch(()=>Buffer.from([]));}return String(out);}

test('content-addressed mirrors preserve exact source-signed snapshot and recover after mirror loss/corruption',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-mirror-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const sourceDir=path.join(root,'source');await bootstrapInstance({dir:sourceDir,name:'镜像来源实例'});const bundle=await loadInstanceBundle({dir:sourceDir});
  const snapshotOut=path.join(root,'source.snapshot.json');const exported=await exportFederationSnapshot({dir:sourceDir,out:snapshotOut});
  const packaged=await packageSignedSnapshot({snapshotFile:snapshotOut,outRoot:path.join(root,'package-root')});assert.equal(packaged.alreadyPresent,false);assert.equal(path.basename(packaged.packageDir),exported.snapshot.snapshotRoot);assert.equal(path.basename(path.dirname(packaged.packageDir)),sourcePathId(bundle.instance.id));
  const packageVerified=await verifyPublicationPackage(packaged.packageDir,{expectedSnapshotRoot:exported.snapshot.snapshotRoot,expectedSourceInstanceId:bundle.instance.id});assert.equal(packageVerified.manifest.snapshotRoot,exported.snapshot.snapshotRoot);
  const packagedAgain=await packageSignedSnapshot({snapshotFile:snapshotOut,outRoot:path.join(root,'package-root')});assert.equal(packagedAgain.alreadyPresent,true);

  const mirrors=[1,2,3].map(i=>path.join(root,`mirror-${i}`));const published=await publishPackageToMirrors({packageDir:packaged.packageDir,mirrorRoots:mirrors});assert.equal(published.results.length,3);assert.ok(published.results.every(x=>x.alreadyPresent===false));
  const republish=await publishPackageToMirrors({packageDir:packaged.packageDir,mirrorRoots:[mirrors[2]]});assert.equal(republish.results[0].alreadyPresent,true);
  const originalBytes=await fs.readFile(snapshotOut);const indexTexts=[];
  for(const mirror of mirrors){
    const verified=await verifyMirrorSnapshot({mirrorRoot:mirror,snapshotRoot:exported.snapshot.snapshotRoot,sourceInstanceId:bundle.instance.id});assert.equal(verified.validMirrors.length,1);
    const {index}=await readMirrorIndex(mirror);assert.equal(index.entries.length,1);assert.equal(index.entries[0].snapshotRoot,exported.snapshot.snapshotRoot);indexTexts.push(JSON.stringify(index));
    const snapPath=path.join(mirror,'public-evidence',index.entries[0].packagePath,index.entries[0].snapshotFile);assert.deepEqual(await fs.readFile(snapPath),originalBytes,'mirror must copy exact source-signed bytes');
  }
  assert.equal(new Set(indexTexts).size,1,'same publication set should produce deterministic mirror index');
  const publicMirrorText=await readTreeText(mirrors[2]);for(const secret of [bundle.secrets.sessionSecret,bundle.secrets.reviewToken,bundle.secrets.exportToken,bundle.secrets.advisoryAgentToken,bundle.secrets.communityAgentToken,bundle.secrets.signingPrivateKey.value])assert.equal(publicMirrorText.includes(secret),false,'mirror must not contain instance private secret material');
  for(const forbidden of ['sessionSecret','reviewToken','exportToken','advisoryAgentToken','communityAgentToken','signingPrivateKey'])assert.equal(publicMirrorText.includes(forbidden),false,`mirror metadata leaked ${forbidden}`);

  await fs.rm(mirrors[0],{recursive:true,force:true});const {index:index2}=await readMirrorIndex(mirrors[1]);const corruptSnapshot=path.join(mirrors[1],'public-evidence',index2.entries[0].packagePath,index2.entries[0].snapshotFile);await fs.appendFile(corruptSnapshot,'\nCORRUPTED\n');
  await assert.rejects(()=>verifyMirrorSnapshot({mirrorRoot:mirrors[1],snapshotRoot:exported.snapshot.snapshotRoot,sourceInstanceId:bundle.instance.id}),/hash|JSON|签名|snapshot/i);
  await assert.rejects(()=>publishPackageToMirrors({packageDir:packaged.packageDir,mirrorRoots:[mirrors[1]]}),/hash|JSON|签名|snapshot/i,'publisher must not overwrite a conflicting/corrupt existing content address');
  const recovered=path.join(root,'recovered.snapshot.json');const resolved=await resolveFromMirrors({mirrorRoots:mirrors,snapshotRoot:exported.snapshot.snapshotRoot,sourceInstanceId:bundle.instance.id,outFile:recovered});assert.equal(resolved.validMirrors.length,1);assert.equal(resolved.failures.length,2);assert.equal(resolved.recoveredFrom,path.resolve(mirrors[2]));assert.deepEqual(await fs.readFile(recovered),originalBytes);

  const {index:index3}=await readMirrorIndex(mirrors[2]);const manifestPath=path.join(mirrors[2],'public-evidence',index3.entries[0].packagePath,'manifest.json');const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));manifest.sourceInstanceName='被篡改的镜像名称';await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  await assert.rejects(()=>resolveFromMirrors({mirrorRoots:mirrors,snapshotRoot:exported.snapshot.snapshotRoot,sourceInstanceId:bundle.instance.id}),/没有可验证的镜像/);
});

test('mirror publication CLIs package, publish, verify and resolve without external services',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-mirror-cli-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const source=path.join(root,'source');await bootstrapInstance({dir:source,name:'CLI 镜像来源'});const bundle=await loadInstanceBundle({dir:source});
  const exportScript=new URL('./export.mjs',import.meta.url);const packageScript=new URL('./package.mjs',import.meta.url);const publishScript=new URL('./publish-mirrors.mjs',import.meta.url);const verifyScript=new URL('./verify-mirror.mjs',import.meta.url);const resolveScript=new URL('./resolve-mirrors.mjs',import.meta.url);
  const snapshot=path.join(root,'snapshot.json');let run=spawnSync(process.execPath,[exportScript.pathname,'--dir',source,'--out',snapshot],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const exp=JSON.parse(run.stdout.trim());
  const packageRoot=path.join(root,'packages');run=spawnSync(process.execPath,[packageScript.pathname,'--snapshot',snapshot,'--out',packageRoot],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const pkg=JSON.parse(run.stdout.trim());assert.equal(pkg.status,'SNAPSHOT_PACKAGE_PASS');
  const m1=path.join(root,'m1'),m2=path.join(root,'m2');run=spawnSync(process.execPath,[publishScript.pathname,'--package',pkg.packageDir,'--mirror',m1,'--mirror',m2],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout.trim()).mirrors.length,2);
  run=spawnSync(process.execPath,[verifyScript.pathname,'--mirror',m1,'--snapshot-root',exp.snapshotRoot,'--source-instance-id',bundle.instance.id],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/MIRROR_VERIFY_PASS/);
  await fs.rm(m1,{recursive:true,force:true});const recovered=path.join(root,'cli-recovered.json');run=spawnSync(process.execPath,[resolveScript.pathname,'--mirror',m1,'--mirror',m2,'--snapshot-root',exp.snapshotRoot,'--source-instance-id',bundle.instance.id,'--out',recovered],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);const res=JSON.parse(run.stdout.trim());assert.equal(res.status,'MIRROR_RESOLVE_PASS');assert.equal(res.validMirrorCount,1);assert.equal(res.failedMirrorCount,1);assert.deepEqual(await fs.readFile(recovered),await fs.readFile(snapshot));
});
