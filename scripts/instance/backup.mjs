import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {collectBackupFiles,buildBackupManifest,pathExists,expectedModeFor} from './backup-lib.mjs';
import {loadInstanceBundle} from './start.mjs';

export async function backupInstance({dir='.ltp-instance',out,serviceStoppedConfirmed=false,createdAt=new Date().toISOString()}={}){
  if(serviceStoppedConfirmed!==true)throw new Error('直接备份 FileStore 实例必须在服务停止后显式 --service-stopped');
  if(!out)throw new Error('必须提供 --out 备份目录');
  const bundle=await loadInstanceBundle({dir});
  if(await pathExists(out))throw new Error(`备份目标已存在，拒绝覆盖：${path.resolve(out)}`);
  const files=await collectBackupFiles(bundle.root);const manifest=buildBackupManifest({instanceId:bundle.instance.id,createdAt,files});
  const target=path.resolve(out);await fs.mkdir(path.dirname(target),{recursive:true});const tmp=`${target}.tmp-${process.pid}-${Date.now()}`;await fs.mkdir(path.join(tmp,'instance'),{recursive:true,mode:0o700});
  try{
    for(const entry of files){const src=path.join(bundle.root,...entry.path.split('/'));const dest=path.join(tmp,'instance',...entry.path.split('/'));await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o700});await fs.copyFile(src,dest);await fs.chmod(dest,expectedModeFor(entry.path));}
    await fs.writeFile(path.join(tmp,'backup-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});await fs.chmod(path.join(tmp,'backup-manifest.json'),0o600);await fs.rename(tmp,target);return {target,manifest};
  }catch(err){await fs.rm(tmp,{recursive:true,force:true});throw err}
}
function parseArgs(argv){const out={dir:'.ltp-instance',out:'',serviceStoppedConfirmed:false};for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==='--service-stopped'){out.serviceStoppedConfirmed=true;continue}if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--dir')out.dir=value;else if(arg==='--out')out.out=value;else throw new Error(`未知参数：${arg}`);}return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const out=await backupInstance(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({status:'INSTANCE_BACKUP_PASS',backupDir:out.target,instanceId:out.manifest.instanceId,fileRoot:out.manifest.fileRoot,fileCount:out.manifest.files.length,createdAt:out.manifest.createdAt}));}catch(err){console.error(`INSTANCE_BACKUP_FAILED: ${err.message}`);process.exitCode=1;}}
