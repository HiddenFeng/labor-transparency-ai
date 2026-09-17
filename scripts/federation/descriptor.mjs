import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildPeerDescriptor,verifyPeerDescriptor} from '../../sites-app/src/peer-discovery.mjs';
import {verifyPublicationPackage} from '../../sites-app/src/snapshot-mirror.mjs';
import {loadInstanceBundle} from '../instance/start.mjs';

async function atomicWrite(file,text){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.${Date.now()}.tmp`;try{await fs.writeFile(tmp,text,{mode:0o644});await fs.rename(tmp,file)}catch(err){await fs.rm(tmp,{force:true});throw err}}

export async function createPeerDescriptor({dir='.ltp-instance',packageDir,mirrorUrls,out='',generatedAt=new Date().toISOString()}={}){
  if(!packageDir)throw new Error('必须提供 --package');if(!Array.isArray(mirrorUrls)||!mirrorUrls.length)throw new Error('至少提供一个 --mirror-url');
  const bundle=await loadInstanceBundle({dir});const pkg=await verifyPublicationPackage(packageDir,{expectedSourceInstanceId:bundle.instance.id});
  const descriptor=buildPeerDescriptor({instance:bundle.instance,signingPrivateKey:bundle.secrets.signingPrivateKey,latestManifest:pkg.manifest,mirrorUrls,generatedAt});verifyPeerDescriptor(descriptor);
  const target=path.resolve(out||path.join(bundle.root,'publication','peer-descriptor.json'));await atomicWrite(target,JSON.stringify(descriptor,null,2)+'\n');return {target,descriptor};
}
function parseArgs(argv){const out={dir:'.ltp-instance',packageDir:'',mirrorUrls:[],out:'',generatedAt:''};for(let i=0;i<argv.length;i++){const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--dir')out.dir=value;else if(arg==='--package')out.packageDir=value;else if(arg==='--mirror-url')out.mirrorUrls.push(value);else if(arg==='--out')out.out=value;else if(arg==='--generated-at')out.generatedAt=value;else throw new Error(`未知参数：${arg}`);}if(!out.generatedAt)out.generatedAt=new Date().toISOString();return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const out=await createPeerDescriptor(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({status:'PEER_DESCRIPTOR_PASS',file:out.target,instanceId:out.descriptor.instance.id,keyFingerprint:out.descriptor.signature.keyFingerprint,latestSnapshotRoot:out.descriptor.latest.snapshotRoot,mirrorCount:out.descriptor.mirrors.length,descriptorRoot:out.descriptor.descriptorRoot}));}
  catch(err){console.error(`PEER_DESCRIPTOR_FAILED: ${err.message}`);process.exitCode=1;}
}
