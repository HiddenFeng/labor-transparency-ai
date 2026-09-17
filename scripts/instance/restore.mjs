import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {expectedModeFor,pathExists,verifyBackupDirectory} from './backup-lib.mjs';
import {loadInstanceBundle} from './start.mjs';

async function ensureEmptyOrMissing(target){
  if(!await pathExists(target))return;
  const stat=await fs.stat(target);if(!stat.isDirectory())throw new Error('恢复目标已存在且不是目录');
  const entries=await fs.readdir(target);if(entries.length)throw new Error('恢复目标非空，拒绝覆盖现有实例');await fs.rmdir(target);
}
export async function restoreInstance({backupDir,dir='.ltp-instance',serviceStoppedConfirmed=false}={}){
  if(serviceStoppedConfirmed!==true)throw new Error('恢复 FileStore 实例必须在服务停止后显式 --service-stopped');
  if(!backupDir)throw new Error('必须提供 --backup');
  const verified=await verifyBackupDirectory(backupDir);const target=path.resolve(dir);await ensureEmptyOrMissing(target);await fs.mkdir(path.dirname(target),{recursive:true});const tmp=`${target}.tmp-${process.pid}-${Date.now()}`;await fs.mkdir(tmp,{mode:0o700});
  try{
    for(const entry of verified.manifest.files){const src=path.join(verified.fileRoot,...entry.path.split('/'));const dest=path.join(tmp,...entry.path.split('/'));await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o700});await fs.copyFile(src,dest);await fs.chmod(dest,expectedModeFor(entry.path));}
    await fs.rename(tmp,target);const bundle=await loadInstanceBundle({dir:target});if(bundle.instance.id!==verified.manifest.instanceId)throw new Error('恢复后 instance ID 与 backup manifest 不一致');return {target,instanceId:bundle.instance.id,manifest:verified.manifest};
  }catch(err){await fs.rm(tmp,{recursive:true,force:true});if(await pathExists(target)){try{const entries=await fs.readdir(target);if(entries.length===0)await fs.rmdir(target)}catch{}}throw err}
}
function parseArgs(argv){const out={backupDir:'',dir:'.ltp-instance',serviceStoppedConfirmed:false};for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==='--service-stopped'){out.serviceStoppedConfirmed=true;continue}if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--backup')out.backupDir=value;else if(arg==='--dir')out.dir=value;else throw new Error(`未知参数：${arg}`);}return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const out=await restoreInstance(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({status:'INSTANCE_RESTORE_PASS',instanceDir:out.target,instanceId:out.instanceId,fileRoot:out.manifest.fileRoot,fileCount:out.manifest.files.length}));}catch(err){console.error(`INSTANCE_RESTORE_FAILED: ${err.message}`);process.exitCode=1;}}
