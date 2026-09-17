import {pathToFileURL} from 'node:url';
import {resolveSnapshotFromMirrors} from '../../sites-app/src/snapshot-mirror.mjs';

export async function resolveFromMirrors(options){return resolveSnapshotFromMirrors(options);}
function parseArgs(argv){const out={mirrorRoots:[],snapshotRoot:'',sourceInstanceId:'',outFile:''};for(let i=0;i<argv.length;i++){const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--mirror')out.mirrorRoots.push(value);else if(arg==='--snapshot-root')out.snapshotRoot=value;else if(arg==='--source-instance-id')out.sourceInstanceId=value;else if(arg==='--out')out.outFile=value;else throw new Error(`未知参数：${arg}`);}return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const out=await resolveFromMirrors(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({status:'MIRROR_RESOLVE_PASS',snapshotRoot:out.snapshotRoot,sourceInstanceId:out.sourceInstanceId,snapshotFileSha256:out.snapshotFileSha256,validMirrorCount:out.validMirrors.length,failedMirrorCount:out.failures.length,recoveredFrom:out.recoveredFrom,outFile:out.outFile,failures:out.failures}));}
  catch(err){console.error(`MIRROR_RESOLVE_FAILED: ${err.message}`);process.exitCode=1;}
}
