import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildPublicationManifest,publicationRelativePath,verifyPublicationPackage} from '../../sites-app/src/snapshot-mirror.mjs';

async function exists(target){try{await fs.lstat(target);return true}catch(err){if(err?.code==='ENOENT')return false;throw err}}

export async function packageSignedSnapshot({snapshotFile,outRoot='.ltp-instance/publication'}={}){
  if(!snapshotFile)throw new Error('必须提供 --snapshot');
  const sourceFile=path.resolve(snapshotFile);const snapshotBytes=await fs.readFile(sourceFile);let snapshot;try{snapshot=JSON.parse(snapshotBytes.toString('utf8'))}catch{throw new Error('snapshot JSON 无效')}
  const manifest=buildPublicationManifest(snapshot,snapshotBytes);const publicationRoot=path.resolve(outRoot,'public-evidence');const rel=publicationRelativePath(manifest);const packageDir=path.resolve(publicationRoot,rel);if(!packageDir.startsWith(publicationRoot+path.sep))throw new Error('package content-address path 越界');
  if(await exists(packageDir)){
    const verified=await verifyPublicationPackage(packageDir,{expectedSnapshotRoot:manifest.snapshotRoot,expectedSourceInstanceId:manifest.sourceInstanceId});if(verified.manifest.snapshotFileSha256!==manifest.snapshotFileSha256)throw new Error('已存在 package 与当前 snapshot bytes 冲突，拒绝覆盖');return {alreadyPresent:true,packageDir,manifest:verified.manifest};
  }
  const parent=path.dirname(packageDir);await fs.mkdir(parent,{recursive:true});const tmp=path.join(parent,`.${manifest.snapshotRoot}.tmp-${process.pid}-${Date.now()}`);await fs.mkdir(tmp,{mode:0o755});
  try{
    await fs.writeFile(path.join(tmp,manifest.snapshotFile),snapshotBytes,{mode:0o644});await fs.writeFile(path.join(tmp,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o644});await fs.rename(tmp,packageDir);
    const verified=await verifyPublicationPackage(packageDir,{expectedSnapshotRoot:manifest.snapshotRoot,expectedSourceInstanceId:manifest.sourceInstanceId});return {alreadyPresent:false,packageDir,manifest:verified.manifest};
  }catch(err){await fs.rm(tmp,{recursive:true,force:true});if(await exists(packageDir)){try{await verifyPublicationPackage(packageDir)}catch{await fs.rm(packageDir,{recursive:true,force:true})}}throw err}
}

function parseArgs(argv){const out={};for(let i=0;i<argv.length;i++){const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);out[arg.slice(2)]=value;}return {snapshotFile:out.snapshot||'',outRoot:out.out||'.ltp-instance/publication'};}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const out=await packageSignedSnapshot(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({status:'SNAPSHOT_PACKAGE_PASS',packageDir:out.packageDir,alreadyPresent:out.alreadyPresent,sourceInstanceId:out.manifest.sourceInstanceId,snapshotRoot:out.manifest.snapshotRoot,contentRoot:out.manifest.contentRoot,snapshotFileSha256:out.manifest.snapshotFileSha256}));}
  catch(err){console.error(`SNAPSHOT_PACKAGE_FAILED: ${err.message}`);process.exitCode=1;}
}
