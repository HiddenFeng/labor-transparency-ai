import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {FileStore} from '../../sites-app/src/storage.mjs';
import {applyFederationSnapshot,verifyFederationSnapshot} from '../../sites-app/src/federation.mjs';
import {loadInstanceBundle} from '../instance/start.mjs';

export async function importFederationSnapshot({dir='.ltp-instance',file,serviceStoppedConfirmed=false}={}){
  if(!file)throw new Error('必须提供 --file 快照路径');
  if(serviceStoppedConfirmed!==true)throw new Error('直接文件导入只允许在目标实例服务停止后执行；必须显式 --service-stopped');
  const bundle=await loadInstanceBundle({dir});
  const snapshotPath=path.resolve(file);let snapshot;
  try{snapshot=JSON.parse(await fs.readFile(snapshotPath,'utf8'))}catch(err){throw new Error(`联邦快照读取失败：${err.message}`)}
  const verified=verifyFederationSnapshot(snapshot);
  if(verified.source.id===bundle.instance.id)throw new Error('拒绝把实例自己的快照重新导入自身');
  const store=await new FileStore(bundle.dataFile,{seed:false}).init();
  const result=await store.transaction(state=>applyFederationSnapshot(state,snapshot));
  return {snapshotPath,source:verified.source,result};
}

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];if(arg==='--service-stopped'){out['service-stopped']=true;continue}
    if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);out[arg.slice(2)]=value;
  }
  return {dir:out.dir||'.ltp-instance',file:out.file||'',serviceStoppedConfirmed:out['service-stopped']===true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const out=await importFederationSnapshot(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({status:'FEDERATION_IMPORT_PASS',file:out.snapshotPath,sourceInstanceId:out.source.id,sourceInstanceName:out.source.name,...out.result}));
  }catch(err){console.error(`FEDERATION_IMPORT_FAILED: ${err.message}`);process.exitCode=1;}
}
