import {pathToFileURL} from 'node:url';
import {resolveSnapshotFromMirrors} from '../../sites-app/src/snapshot-mirror.mjs';

export async function verifyMirrorSnapshot({mirrorRoot,snapshotRoot,sourceInstanceId=''}={}){
  if(!mirrorRoot)throw new Error('必须提供 --mirror');if(!snapshotRoot)throw new Error('必须提供 --snapshot-root');return resolveSnapshotFromMirrors({mirrorRoots:[mirrorRoot],snapshotRoot,sourceInstanceId});
}
function parseArgs(argv){const out={};for(let i=0;i<argv.length;i++){const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);out[arg.slice(2)]=value;}return {mirrorRoot:out.mirror||'',snapshotRoot:out['snapshot-root']||'',sourceInstanceId:out['source-instance-id']||''};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const out=await verifyMirrorSnapshot(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({status:'MIRROR_VERIFY_PASS',snapshotRoot:out.snapshotRoot,sourceInstanceId:out.sourceInstanceId,snapshotFileSha256:out.snapshotFileSha256,mirror:out.validMirrors[0]}));}
  catch(err){console.error(`MIRROR_VERIFY_FAILED: ${err.message}`);process.exitCode=1;}
}
