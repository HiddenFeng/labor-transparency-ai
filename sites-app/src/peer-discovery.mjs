import crypto from 'node:crypto';
import {canonicalJson,publicKeyFingerprint,sha256} from './federation.mjs';
import {validateMirrorIndex,verifyPublicationPayload} from './snapshot-mirror.mjs';

export const PEER_DESCRIPTOR_SCHEMA='LTP_PUBLIC_INSTANCE_DESCRIPTOR';
export const PEER_DESCRIPTOR_VERSION=1;
export const PEER_DESCRIPTOR_MODE='EXPLICIT_TRUSTED_PUBLIC_EVIDENCE_PULL';
export const PEER_TRUST_STORE_SCHEMA='LTP_PEER_TRUST_STORE';
export const PEER_TRUST_STORE_VERSION=1;
export const MAX_PEERS=512;
export const MAX_MIRRORS_PER_PEER=16;
const MAX_DESCRIPTOR_BYTES=256*1024;
const MAX_INDEX_BYTES=8*1024*1024;
const MAX_MANIFEST_BYTES=256*1024;
const MAX_SNAPSHOT_BYTES=32*1024*1024;

function exactKeys(value,allowed,label){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label}必须是对象`);
  const extra=Object.keys(value).filter(key=>!allowed.includes(key));if(extra.length)throw new Error(`${label}包含未定义字段：${extra.join(',')}`);
}
function text(value,{label='字段',min=0,max=500}={}){
  const out=String(value??'');
  if(out.length<min||out.length>max||/[\u0000-\u001f\u007f]/.test(out))throw new Error(`${label}无效`);
  return out;
}
function hash(value,label){const out=String(value||'');if(!/^[a-f0-9]{64}$/.test(out))throw new Error(`${label}无效`);return out;}
function iso(value,label){const out=text(value,{label,min:20,max:40});if(!Number.isFinite(Date.parse(out)))throw new Error(`${label}无效`);return out;}
function publicKey(value){
  exactKeys(value,['algorithm','encoding','value'],'实例公钥');
  if(value.algorithm!=='Ed25519'||value.encoding!=='spki-der-base64'||!/^[A-Za-z0-9+/=]{40,500}$/.test(String(value.value||'')))throw new Error('实例公钥无效');
  publicKeyFingerprint(value);
  return {algorithm:'Ed25519',encoding:'spki-der-base64',value:value.value};
}
function createPublicKey(value){return crypto.createPublicKey({key:Buffer.from(publicKey(value).value,'base64'),type:'spki',format:'der'});}
function createPrivateKey(value){
  if(value?.algorithm!=='Ed25519'||value?.encoding!=='pkcs8-der-base64'||!/^[A-Za-z0-9+/=]{40,500}$/.test(String(value?.value||'')))throw new Error('实例签名私钥无效');
  return crypto.createPrivateKey({key:Buffer.from(value.value,'base64'),type:'pkcs8',format:'der'});
}
function normalizeInstance(instance){
  const out={id:String(instance?.id||''),name:String(instance?.name||''),mode:String(instance?.mode||''),operator:String(instance?.operator||''),publicUrl:String(instance?.publicUrl||''),publicKey:publicKey(instance?.publicKey||{})};
  if(!/^[A-Za-z0-9._:-]{6,120}$/.test(out.id))throw new Error('实例 ID 无效');
  text(out.name,{label:'实例名称',min:2,max:120});if(out.mode!=='independent')throw new Error('peer descriptor 仅接受 independent 实例');if(out.operator)text(out.operator,{label:'运营者',max:160});
  if(out.publicUrl){let u;try{u=new URL(out.publicUrl)}catch{throw new Error('实例公开 URL 无效')}if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw new Error('实例公开 URL 必须是无凭据/查询/片段的 HTTPS 地址');out.publicUrl=u.href.replace(/\/$/,'');}
  return out;
}
function isLoopbackHost(hostname){
  const host=String(hostname||'').toLowerCase();
  return host==='localhost'||host==='127.0.0.1'||host==='::1'||host==='[::1]';
}
export function normalizeTransportUrl(value,{label='URL',requirePublicEvidencePath=false}={}){
  let u;try{u=new URL(String(value||''))}catch{throw new Error(`${label}无效`)}
  const loopback=isLoopbackHost(u.hostname);
  if(u.protocol!=='https:'&&!(u.protocol==='http:'&&loopback))throw new Error(`${label}只允许 HTTPS；本地测试可使用 loopback HTTP`);
  if(u.username||u.password||u.search||u.hash)throw new Error(`${label}不得包含凭据、query 或 fragment`);
  const cleanPath=u.pathname.replace(/\/{2,}/g,'/').replace(/\/$/,'')||'/';
  if(requirePublicEvidencePath&&cleanPath.split('/').filter(Boolean).at(-1)!=='public-evidence')throw new Error(`${label}必须直接指向 public-evidence 根目录`);
  u.pathname=cleanPath;return u.href.replace(/\/$/,'');
}
function descriptorUnsigned(descriptor){
  return {schema:descriptor.schema,schemaVersion:descriptor.schemaVersion,descriptorMode:descriptor.descriptorMode,instance:descriptor.instance,generatedAt:descriptor.generatedAt,latest:descriptor.latest,mirrors:descriptor.mirrors};
}
function latestObject(value){
  exactKeys(value,['snapshotRoot','contentRoot','previousRoot','generatedAt','recordCount','sourceKeyFingerprint'],'latest snapshot');
  hash(value.snapshotRoot,'latest snapshotRoot');hash(value.contentRoot,'latest contentRoot');if(value.previousRoot)hash(value.previousRoot,'latest previousRoot');iso(value.generatedAt,'latest generatedAt');hash(value.sourceKeyFingerprint,'latest sourceKeyFingerprint');if(!Number.isInteger(value.recordCount)||value.recordCount<0||value.recordCount>100000)throw new Error('latest recordCount 无效');
  return {...value};
}
function mirrorObjects(values){
  if(!Array.isArray(values)||values.length<1||values.length>MAX_MIRRORS_PER_PEER)throw new Error(`peer mirrors 必须是1—${MAX_MIRRORS_PER_PEER}个`);
  const normalized=values.map(value=>{
    const raw=typeof value==='string'?value:value?.publicEvidenceBaseUrl;
    return {publicEvidenceBaseUrl:normalizeTransportUrl(raw,{label:'mirror URL',requirePublicEvidencePath:true})};
  });
  const urls=normalized.map(x=>x.publicEvidenceBaseUrl);if(new Set(urls).size!==urls.length)throw new Error('peer mirrors 不得重复');normalized.sort((a,b)=>a.publicEvidenceBaseUrl.localeCompare(b.publicEvidenceBaseUrl));return normalized;
}

export function buildPeerDescriptor({instance,signingPrivateKey,latestManifest,mirrorUrls,generatedAt=new Date().toISOString()}={}){
  const source=normalizeInstance(instance);const latest=latestObject({snapshotRoot:latestManifest?.snapshotRoot,contentRoot:latestManifest?.contentRoot,previousRoot:latestManifest?.previousRoot||'',generatedAt:latestManifest?.generatedAt,recordCount:latestManifest?.recordCount,sourceKeyFingerprint:latestManifest?.sourceKeyFingerprint});
  const fingerprint=publicKeyFingerprint(source.publicKey);
  if(latestManifest?.sourceInstanceId!==source.id||latestManifest?.sourceInstanceName!==source.name||latest.sourceKeyFingerprint!==fingerprint)throw new Error('latest package manifest 与实例身份/公钥不一致');
  iso(generatedAt,'descriptor generatedAt');const mirrors=mirrorObjects(mirrorUrls||[]);
  const privateKey=createPrivateKey(signingPrivateKey);const derived=crypto.createPublicKey(privateKey).export({type:'spki',format:'der'}).toString('base64');if(derived!==source.publicKey.value)throw new Error('descriptor 签名私钥与实例公钥不匹配');
  const unsigned={schema:PEER_DESCRIPTOR_SCHEMA,schemaVersion:PEER_DESCRIPTOR_VERSION,descriptorMode:PEER_DESCRIPTOR_MODE,instance:source,generatedAt,latest,mirrors};const descriptorRoot=sha256(canonicalJson(unsigned));const signatureValue=crypto.sign(null,Buffer.from(descriptorRoot,'utf8'),privateKey).toString('base64');
  return {...unsigned,descriptorRoot,signature:{algorithm:'Ed25519',keyFingerprint:fingerprint,value:signatureValue}};
}

export function verifyPeerDescriptor(descriptor){
  exactKeys(descriptor,['schema','schemaVersion','descriptorMode','instance','generatedAt','latest','mirrors','descriptorRoot','signature'],'peer descriptor');
  if(descriptor.schema!==PEER_DESCRIPTOR_SCHEMA||descriptor.schemaVersion!==PEER_DESCRIPTOR_VERSION||descriptor.descriptorMode!==PEER_DESCRIPTOR_MODE)throw new Error('peer descriptor schema/version/mode 不支持');
  const instance=normalizeInstance(descriptor.instance);iso(descriptor.generatedAt,'descriptor generatedAt');const latest=latestObject(descriptor.latest);const mirrors=mirrorObjects(descriptor.mirrors);
  const fingerprint=publicKeyFingerprint(instance.publicKey);if(latest.sourceKeyFingerprint!==fingerprint)throw new Error('latest snapshot key fingerprint 与实例公钥不一致');
  exactKeys(descriptor.signature,['algorithm','keyFingerprint','value'],'peer descriptor signature');if(descriptor.signature.algorithm!=='Ed25519'||descriptor.signature.keyFingerprint!==fingerprint||!/^[A-Za-z0-9+/=]{40,500}$/.test(String(descriptor.signature.value||'')))throw new Error('peer descriptor signature 元数据无效');
  const normalized={schema:descriptor.schema,schemaVersion:descriptor.schemaVersion,descriptorMode:descriptor.descriptorMode,instance,generatedAt:descriptor.generatedAt,latest,mirrors};const root=sha256(canonicalJson(normalized));if(descriptor.descriptorRoot!==root)throw new Error('peer descriptorRoot 校验失败');
  if(!crypto.verify(null,Buffer.from(root,'utf8'),createPublicKey(instance.publicKey),Buffer.from(descriptor.signature.value,'base64')))throw new Error('peer descriptor 签名校验失败');
  return {...normalized,descriptorRoot:root,signature:{...descriptor.signature},keyFingerprint:fingerprint};
}

export function emptyPeerTrustStore(){return {schema:PEER_TRUST_STORE_SCHEMA,schemaVersion:PEER_TRUST_STORE_VERSION,peers:[]};}
function validatePeerEntry(entry){
  exactKeys(entry,['instanceId','instanceName','keyFingerprint','descriptor','descriptorSource','trustedAt','updatedAt','lastPulledSnapshotRoot','lastPulledAt'],'peer trust entry');
  const verified=verifyPeerDescriptor(entry.descriptor);if(entry.instanceId!==verified.instance.id||entry.instanceName!==verified.instance.name||entry.keyFingerprint!==verified.keyFingerprint)throw new Error('peer trust entry 与 descriptor 不一致');text(entry.descriptorSource,{label:'descriptorSource',max:1000});iso(entry.trustedAt,'trustedAt');iso(entry.updatedAt,'updatedAt');if(entry.lastPulledSnapshotRoot)hash(entry.lastPulledSnapshotRoot,'lastPulledSnapshotRoot');if(entry.lastPulledAt)iso(entry.lastPulledAt,'lastPulledAt');return entry;
}
export function validatePeerTrustStore(store){
  exactKeys(store,['schema','schemaVersion','peers'],'peer trust store');if(store.schema!==PEER_TRUST_STORE_SCHEMA||store.schemaVersion!==PEER_TRUST_STORE_VERSION)throw new Error('peer trust store schema/version 不支持');if(!Array.isArray(store.peers)||store.peers.length>MAX_PEERS)throw new Error('peer trust store peers 无效');const ids=new Set();for(const peer of store.peers){validatePeerEntry(peer);if(ids.has(peer.instanceId))throw new Error('peer trust store 存在重复 instanceId');ids.add(peer.instanceId);}const sorted=[...store.peers].sort((a,b)=>a.instanceId.localeCompare(b.instanceId));if(JSON.stringify(sorted)!==JSON.stringify(store.peers))throw new Error('peer trust store peers 必须确定性排序');return store;
}

export function trustPeerDescriptor(store,descriptor,{descriptorSource='',ownInstanceId='',trustedAt=new Date().toISOString()}={}){
  const current=store?structuredClone(validatePeerTrustStore(store)):emptyPeerTrustStore();const verified=verifyPeerDescriptor(descriptor);if(ownInstanceId&&verified.instance.id===ownInstanceId)throw new Error('拒绝把本实例自身加入 peer trust store');iso(trustedAt,'trustedAt');const source=text(descriptorSource,{label:'descriptorSource',max:1000});
  const existing=current.peers.find(x=>x.instanceId===verified.instance.id);
  if(existing){
    if(existing.keyFingerprint!==verified.keyFingerprint)throw new Error('peer 公钥发生变化，拒绝自动信任新密钥');
    const oldTime=Date.parse(existing.descriptor.generatedAt),newTime=Date.parse(verified.generatedAt);if(newTime<oldTime)throw new Error('peer descriptor 时间倒退，拒绝回滚');if(newTime===oldTime&&existing.descriptor.descriptorRoot!==verified.descriptorRoot)throw new Error('peer descriptor 同一时间出现内容冲突');
    if(existing.descriptor.descriptorRoot===verified.descriptorRoot){if(source)existing.descriptorSource=source;existing.updatedAt=trustedAt;return {store:current,peer:existing,alreadyTrusted:true,updated:false};}
    existing.instanceName=verified.instance.name;existing.descriptor=descriptor;existing.descriptorSource=source||existing.descriptorSource;existing.updatedAt=trustedAt;return {store:current,peer:existing,alreadyTrusted:true,updated:true};
  }
  if(current.peers.length>=MAX_PEERS)throw new Error('peer trust store 已达安全上限');const entry={instanceId:verified.instance.id,instanceName:verified.instance.name,keyFingerprint:verified.keyFingerprint,descriptor,descriptorSource:source,trustedAt,updatedAt:trustedAt,lastPulledSnapshotRoot:'',lastPulledAt:''};current.peers.push(entry);current.peers.sort((a,b)=>a.instanceId.localeCompare(b.instanceId));return {store:current,peer:entry,alreadyTrusted:false,updated:true};
}
export function markPeerPulled(store,instanceId,snapshotRoot,{pulledAt=new Date().toISOString()}={}){
  const current=structuredClone(validatePeerTrustStore(store));hash(snapshotRoot,'pulled snapshotRoot');iso(pulledAt,'pulledAt');const peer=current.peers.find(x=>x.instanceId===instanceId);if(!peer)throw new Error('peer 未受信任');peer.lastPulledSnapshotRoot=snapshotRoot;peer.lastPulledAt=pulledAt;peer.updatedAt=pulledAt;return current;
}

function boundedNumber(value,min,max,label){const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${label}无效`);return n;}
export async function fetchBytesBounded(url,{allowNetwork=false,maxBytes=MAX_SNAPSHOT_BYTES,timeoutMs=10000,label='远程资源'}={}){
  const normalized=normalizeTransportUrl(url,{label});const parsed=new URL(normalized);const loopback=isLoopbackHost(parsed.hostname);if(!loopback&&!allowNetwork)throw new Error(`${label}需要显式 allowNetwork 才能访问非本机网络`);boundedNumber(maxBytes,1,64*1024*1024,'maxBytes');boundedNumber(timeoutMs,100,60000,'timeoutMs');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);let response;
  try{response=await fetch(normalized,{method:'GET',headers:{Accept:'application/json'},redirect:'manual',signal:controller.signal});}catch(err){clearTimeout(timer);throw new Error(`${label}请求失败：${err.name==='AbortError'?'timeout':err.message}`)}
  if(response.status>=300&&response.status<400){clearTimeout(timer);throw new Error(`${label}拒绝 HTTP redirect`)}if(!response.ok){clearTimeout(timer);throw new Error(`${label} HTTP ${response.status}`)}const declared=Number(response.headers.get('content-length')||0);if(declared&&declared>maxBytes){clearTimeout(timer);throw new Error(`${label}超过大小上限`)}
  const chunks=[];let size=0;try{const reader=response.body?.getReader();if(!reader)throw new Error('响应没有 body');while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error(`${label}超过大小上限`)}chunks.push(Buffer.from(value));}}catch(err){clearTimeout(timer);throw err}clearTimeout(timer);return {url:normalized,bytes:Buffer.concat(chunks),headers:response.headers,status:response.status};
}
export async function fetchJsonBounded(url,options={}){const out=await fetchBytesBounded(url,options);let data;try{data=JSON.parse(out.bytes.toString('utf8'))}catch{throw new Error(`${options.label||'远程 JSON'} JSON 无效`)}return {...out,data};}
export async function fetchPeerDescriptor(url,{allowNetwork=false}={}){const out=await fetchJsonBounded(url,{allowNetwork,maxBytes:MAX_DESCRIPTOR_BYTES,timeoutMs:10000,label:'peer descriptor'});const verified=verifyPeerDescriptor(out.data);return {url:out.url,descriptor:out.data,verified};}
export async function fetchPeerMirrorIndex(publicEvidenceBaseUrl,{allowNetwork=false}={}){const base=normalizeTransportUrl(publicEvidenceBaseUrl,{label:'mirror URL',requirePublicEvidencePath:true});const out=await fetchJsonBounded(`${base}/index.json`,{allowNetwork,maxBytes:MAX_INDEX_BYTES,timeoutMs:10000,label:'mirror index'});return {baseUrl:base,index:validateMirrorIndex(out.data)};}
export async function fetchPeerSnapshot(publicEvidenceBaseUrl,entry,{allowNetwork=false,expectedSourceInstanceId='',expectedKeyFingerprint=''}={}){
  const base=normalizeTransportUrl(publicEvidenceBaseUrl,{label:'mirror URL',requirePublicEvidencePath:true});const packageBase=`${base}/${entry.packagePath}`;const manifestOut=await fetchJsonBounded(`${packageBase}/manifest.json`,{allowNetwork,maxBytes:MAX_MANIFEST_BYTES,timeoutMs:10000,label:'mirror manifest'});const snapshotOut=await fetchBytesBounded(`${packageBase}/${entry.snapshotFile}`,{allowNetwork,maxBytes:MAX_SNAPSHOT_BYTES,timeoutMs:20000,label:'mirror snapshot'});const verified=verifyPublicationPayload({manifest:manifestOut.data,snapshotBytes:snapshotOut.bytes,expectedSnapshotRoot:entry.snapshotRoot,expectedSourceInstanceId:expectedSourceInstanceId||entry.sourceInstanceId});if(verified.manifest.snapshotFileSha256!==entry.snapshotFileSha256)throw new Error('mirror index 与远程 package snapshot hash 不一致');if(expectedKeyFingerprint&&verified.verified.keyFingerprint!==expectedKeyFingerprint)throw new Error('远程 snapshot source key 与 trusted peer 不一致');return {baseUrl:base,...verified};
}
