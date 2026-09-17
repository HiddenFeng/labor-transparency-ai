import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {FileStore} from '../../sites-app/src/storage.mjs';
import {fetchPeerMirrorIndex,fetchPeerSnapshot,markPeerPulled,trustPeerDescriptor,verifyPeerDescriptor} from '../../sites-app/src/peer-discovery.mjs';
import {importFederationSnapshot} from './import.mjs';
import {loadDescriptorInput,loadPeerContext,savePeerStore} from './peer-store.mjs';

async function refreshPeerIfRequested(ctx,peer,{refreshDescriptor=false,allowNetwork=false}={}){
  if(!refreshDescriptor)return {ctx,peer,refreshed:false};
  if(!peer.descriptorSource)throw new Error('peer 没有保存 descriptorSource，无法 refresh');
  const loaded=await loadDescriptorInput(peer.descriptorSource,{allowNetwork});const trusted=trustPeerDescriptor(ctx.store,loaded.descriptor,{descriptorSource:loaded.source,ownInstanceId:ctx.bundle.instance.id});ctx.store=await savePeerStore(ctx.file,trusted.store);peer=ctx.store.peers.find(x=>x.instanceId===peer.instanceId);return {ctx,peer,refreshed:trusted.updated};
}
function latestMatchesDescriptor(snapshot,descriptor){
  const latest=descriptor.latest;
  if(snapshot.snapshotRoot!==latest.snapshotRoot||snapshot.contentRoot!==latest.contentRoot||snapshot.previousRoot!==latest.previousRoot||snapshot.generatedAt!==latest.generatedAt||snapshot.recordCount!==latest.recordCount||snapshot.signature?.keyFingerprint!==latest.sourceKeyFingerprint)throw new Error('peer descriptor latest 元数据与实际 source-signed snapshot 不一致');
}
async function loadMirrorIndexes(peer,{allowNetwork=false}={}){
  const good=[];const failures=[];
  for(const mirror of peer.descriptor.mirrors){try{const out=await fetchPeerMirrorIndex(mirror.publicEvidenceBaseUrl,{allowNetwork});good.push(out);}catch(err){failures.push({mirror:mirror.publicEvidenceBaseUrl,error:err.message});}}
  if(!good.length)throw new Error(`所有 peer mirror index 都不可用：${failures.map(x=>`${x.mirror}: ${x.error}`).join(' | ')}`);return {good,failures};
}
async function fetchRoot(root,peer,indexes,{allowNetwork=false,targetRoot='' }={}){
  const valid=[];const failures=[];
  for(const mirror of indexes.good){
    const matches=mirror.index.entries.filter(x=>x.sourceInstanceId===peer.instanceId&&x.sourceKeyFingerprint===peer.keyFingerprint&&x.snapshotRoot===root);
    if(!matches.length){failures.push({mirror:mirror.baseUrl,error:'index 未声明该 snapshotRoot'});continue}
    if(matches.length!==1){failures.push({mirror:mirror.baseUrl,error:'index 对该 snapshotRoot 不唯一'});continue}
    try{const out=await fetchPeerSnapshot(mirror.baseUrl,matches[0],{allowNetwork,expectedSourceInstanceId:peer.instanceId,expectedKeyFingerprint:peer.keyFingerprint});valid.push(out);}catch(err){failures.push({mirror:mirror.baseUrl,error:err.message});}
  }
  if(!valid.length)throw new Error(`snapshot ${root} 没有可验证镜像：${failures.map(x=>`${x.mirror}: ${x.error}`).join(' | ')}`);
  const byteHashes=new Set(valid.map(x=>x.manifest.snapshotFileSha256));if(byteHashes.size!==1)throw new Error(`snapshot ${root} 在多个有效镜像上不是 byte-identical source artifact`);
  const out=valid[0];if(targetRoot&&root===targetRoot)latestMatchesDescriptor(out.snapshot,peer.descriptor);return {snapshot:out.snapshot,snapshotBytes:out.snapshotBytes,validMirrors:valid.map(x=>x.baseUrl),failures};
}

export async function pullTrustedPeer({dir='.ltp-instance',peerId,serviceStoppedConfirmed=false,allowNetwork=false,refreshDescriptor=false,maxChain=256}={}){
  if(serviceStoppedConfirmed!==true)throw new Error('peer pull 会修改本地 FileStore，必须在目标实例服务停止后显式 --service-stopped');
  if(!/^[A-Za-z0-9._:-]{6,120}$/.test(String(peerId||'')))throw new Error('必须提供有效 --peer instanceId');if(!Number.isInteger(maxChain)||maxChain<1||maxChain>2048)throw new Error('maxChain 无效');
  let ctx=await loadPeerContext(dir);let peer=ctx.store.peers.find(x=>x.instanceId===peerId);if(!peer)throw new Error('peer 未受信任；请先显式 trust descriptor');verifyPeerDescriptor(peer.descriptor);
  ({ctx,peer}=await refreshPeerIfRequested(ctx,peer,{refreshDescriptor,allowNetwork}));
  const targetRoot=peer.descriptor.latest.snapshotRoot;const store=await new FileStore(ctx.bundle.dataFile,{seed:false}).init();const state=store.read();const tracker=(state.federationImports||[]).find(x=>x.sourceInstanceId===peer.instanceId);const currentRoot=tracker?.lastSnapshotRoot||'';
  if(tracker&&tracker.keyFingerprint!==peer.keyFingerprint)throw new Error('本地 federation source key 与 trusted peer key 不一致');
  if(currentRoot===targetRoot){ctx.store=markPeerPulled(ctx.store,peer.instanceId,targetRoot);await savePeerStore(ctx.file,ctx.store);return {status:'UP_TO_DATE',peerId:peer.instanceId,currentRoot,targetRoot,chainLength:0,imports:[],mirrorIndexFailures:[]};}
  const indexes=await loadMirrorIndexes(peer,{allowNetwork});const backward=[];let cursor=targetRoot;
  if(!currentRoot){const latest=await fetchRoot(cursor,peer,indexes,{allowNetwork,targetRoot});backward.push(latest);}else{
    const seen=new Set();while(cursor!==currentRoot){if(seen.has(cursor))throw new Error('peer snapshot chain 出现循环');seen.add(cursor);if(backward.length>=maxChain)throw new Error('peer snapshot chain 超过 maxChain 安全上限');const item=await fetchRoot(cursor,peer,indexes,{allowNetwork,targetRoot});backward.push(item);cursor=item.snapshot.previousRoot;if(!cursor)throw new Error('peer snapshot chain 无法连接到本地已接受 root，拒绝跳链/回滚');}
  }
  const forward=[...backward].reverse();const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ltp-peer-pull-'));const imports=[];
  try{
    for(const item of forward){const file=path.join(tmp,`${item.snapshot.snapshotRoot}.json`);await fs.writeFile(file,item.snapshotBytes,{mode:0o600});const imported=await importFederationSnapshot({dir:ctx.bundle.root,file,serviceStoppedConfirmed:true});imports.push({snapshotRoot:item.snapshot.snapshotRoot,previousRoot:item.snapshot.previousRoot,validMirrors:item.validMirrors,mirrorFailures:item.failures,result:imported.result});}
  }finally{await fs.rm(tmp,{recursive:true,force:true});}
  ctx=await loadPeerContext(ctx.bundle.root);ctx.store=markPeerPulled(ctx.store,peer.instanceId,targetRoot);await savePeerStore(ctx.file,ctx.store);
  return {status:'PULL_PASS',peerId:peer.instanceId,previousLocalRoot:currentRoot,targetRoot,chainLength:forward.length,imports,mirrorIndexFailures:indexes.failures};
}

function parseArgs(argv){const out={dir:'.ltp-instance',peerId:'',serviceStoppedConfirmed:false,allowNetwork:false,refreshDescriptor:false,maxChain:256};for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==='--service-stopped'){out.serviceStoppedConfirmed=true;continue}if(arg==='--allow-network'){out.allowNetwork=true;continue}if(arg==='--refresh-descriptor'){out.refreshDescriptor=true;continue}if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--dir')out.dir=value;else if(arg==='--peer')out.peerId=value;else if(arg==='--max-chain')out.maxChain=Number(value);else throw new Error(`未知参数：${arg}`);}return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{const out=await pullTrustedPeer(parseArgs(process.argv.slice(2)));console.log(JSON.stringify(out));}
  catch(err){console.error(`PEER_PULL_FAILED: ${err.message}`);process.exitCode=1;}
}
