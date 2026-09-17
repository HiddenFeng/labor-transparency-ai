import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {FileStore} from '../../sites-app/src/storage.mjs';
import {buildFederationSnapshot,verifyFederationSnapshot} from '../../sites-app/src/federation.mjs';
import {loadInstanceBundle} from '../instance/start.mjs';

async function readJsonIfExists(file){
  try{return JSON.parse(await fs.readFile(file,'utf8'))}catch(err){if(err?.code==='ENOENT')return null;throw new Error(`${file} 读取失败：${err.message}`)}
}
async function atomicWrite(file,text,mode){
  await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
  const tmp=`${file}.${process.pid}.${Date.now()}.tmp`;
  try{await fs.writeFile(tmp,text,{mode});await fs.chmod(tmp,mode);await fs.rename(tmp,file)}catch(err){await fs.rm(tmp,{force:true});throw err}
}

export async function exportFederationSnapshot({dir='.ltp-instance',out=''}={}){
  const bundle=await loadInstanceBundle({dir});
  const federationDir=path.join(bundle.root,'federation');
  const stateFile=path.join(federationDir,'export-state.json');
  const previous=await readJsonIfExists(stateFile);
  const store=await new FileStore(bundle.dataFile,{seed:false}).init();
  const {snapshot,exportState}=buildFederationSnapshot({state:store.read(),instance:bundle.instance,signingPrivateKey:bundle.secrets.signingPrivateKey,previousExportState:previous});
  verifyFederationSnapshot(snapshot);
  const target=path.resolve(out||path.join(federationDir,'latest.snapshot.json'));
  await atomicWrite(target,JSON.stringify(snapshot,null,2)+'\n',0o644);
  await atomicWrite(stateFile,JSON.stringify(exportState,null,2)+'\n',0o600);
  return {target,stateFile,snapshot};
}

function parseArgs(argv){const out={};for(let i=0;i<argv.length;i++){const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);out[arg.slice(2)]=value;}return {dir:out.dir||'.ltp-instance',out:out.out||''};}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await exportFederationSnapshot(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({status:'FEDERATION_EXPORT_PASS',file:result.target,sourceInstanceId:result.snapshot.instance.id,snapshotRoot:result.snapshot.snapshotRoot,previousRoot:result.snapshot.previousRoot,contentRoot:result.snapshot.contentRoot,recordCount:result.snapshot.recordCount,deltaUpserts:result.snapshot.delta.upserts.length,deltaTombstones:result.snapshot.delta.tombstones.length}));
  }catch(err){console.error(`FEDERATION_EXPORT_FAILED: ${err.message}`);process.exitCode=1;}
}
