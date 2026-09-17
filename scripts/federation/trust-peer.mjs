import {pathToFileURL} from 'node:url';
import {trustDescriptorIntoInstance} from './peer-store.mjs';

export async function trustPeer({dir='.ltp-instance',descriptorInput,allowNetwork=false,trust=false}={}){
  if(trust!==true)throw new Error('首次/更新 peer 信任必须显式 --trust');
  return trustDescriptorIntoInstance({dir,descriptorInput,allowNetwork});
}
function parseArgs(argv){const out={dir:'.ltp-instance',descriptorInput:'',allowNetwork:false,trust:false};for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==='--trust'){out.trust=true;continue}if(arg==='--allow-network'){out.allowNetwork=true;continue}if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--dir')out.dir=value;else if(arg==='--descriptor')out.descriptorInput=value;else throw new Error(`未知参数：${arg}`);}return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const out=await trustPeer(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({status:'PEER_TRUST_PASS',peerStore:out.file,instanceId:out.peer.instanceId,keyFingerprint:out.peer.keyFingerprint,latestSnapshotRoot:out.peer.descriptor.latest.snapshotRoot,alreadyTrusted:out.alreadyTrusted,updated:out.updated,descriptorSource:out.source}));}
  catch(err){console.error(`PEER_TRUST_FAILED: ${err.message}`);process.exitCode=1;}
}
