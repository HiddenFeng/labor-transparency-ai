import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {publicationRelativePath,readMirrorIndex,upsertMirrorIndex,verifyPublicationPackage} from '../../sites-app/src/snapshot-mirror.mjs';

async function exists(target){try{await fs.lstat(target);return true}catch(err){if(err?.code==='ENOENT')return false;throw err}}
async function atomicWrite(file,text){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.${Date.now()}.tmp`;try{await fs.writeFile(tmp,text,{mode:0o644});await fs.rename(tmp,file)}catch(err){await fs.rm(tmp,{force:true});throw err}}
async function loadIndexIfExists(root){try{return (await readMirrorIndex(root)).index}catch(err){if(/ENOENT/.test(err.message))return null;throw err}}

export async function publishPackageToMirrors({packageDir,mirrorRoots}={}){
  if(!packageDir)throw new Error('必须提供 --package');if(!Array.isArray(mirrorRoots)||!mirrorRoots.length||mirrorRoots.length>32)throw new Error('mirrorRoots 需为1—32个目录');
  const source=await verifyPublicationPackage(packageDir);const rel=publicationRelativePath(source.manifest);const results=[];
  for(const mirrorRaw of mirrorRoots){
    const mirrorRoot=path.resolve(mirrorRaw);const publicRoot=path.join(mirrorRoot,'public-evidence');const dest=path.resolve(publicRoot,rel);if(!dest.startsWith(publicRoot+path.sep))throw new Error('mirror destination 越界');await fs.mkdir(path.dirname(dest),{recursive:true});let alreadyPresent=false;
    if(await exists(dest)){
      const existing=await verifyPublicationPackage(dest,{expectedSnapshotRoot:source.manifest.snapshotRoot,expectedSourceInstanceId:source.manifest.sourceInstanceId});if(existing.manifest.snapshotFileSha256!==source.manifest.snapshotFileSha256)throw new Error(`mirror 已存在冲突 package，拒绝覆盖：${mirrorRoot}`);alreadyPresent=true;
    }else{
      const tmp=path.join(path.dirname(dest),`.${source.manifest.snapshotRoot}.tmp-${process.pid}-${Date.now()}`);try{await fs.cp(source.dir,tmp,{recursive:true,errorOnExist:true,force:false});await fs.rename(tmp,dest);const copied=await verifyPublicationPackage(dest,{expectedSnapshotRoot:source.manifest.snapshotRoot,expectedSourceInstanceId:source.manifest.sourceInstanceId});if(copied.manifest.snapshotFileSha256!==source.manifest.snapshotFileSha256)throw new Error('mirror copy 不是 byte-identical snapshot package');}catch(err){await fs.rm(tmp,{recursive:true,force:true});throw err}
    }
    const currentIndex=await loadIndexIfExists(mirrorRoot);const nextIndex=upsertMirrorIndex(currentIndex,source.manifest);await atomicWrite(path.join(publicRoot,'index.json'),JSON.stringify(nextIndex,null,2)+'\n');results.push({mirrorRoot,destination:dest,alreadyPresent});
  }
  return {source:source.manifest,results};
}

function parseArgs(argv){const out={packageDir:'',mirrorRoots:[]};for(let i=0;i<argv.length;i++){const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--mirror')out.mirrorRoots.push(value);else if(arg==='--package')out.packageDir=value;else throw new Error(`未知参数：${arg}`);}return out;}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const out=await publishPackageToMirrors(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({status:'MIRROR_PUBLISH_PASS',sourceInstanceId:out.source.sourceInstanceId,snapshotRoot:out.source.snapshotRoot,snapshotFileSha256:out.source.snapshotFileSha256,mirrors:out.results}));}
  catch(err){console.error(`MIRROR_PUBLISH_FAILED: ${err.message}`);process.exitCode=1;}
}
