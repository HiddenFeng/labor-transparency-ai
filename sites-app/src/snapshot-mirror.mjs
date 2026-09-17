import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {verifyFederationSnapshot} from './federation.mjs';

export const PUBLICATION_SCHEMA='LTP_PUBLIC_SNAPSHOT_PACKAGE';
export const PUBLICATION_SCHEMA_VERSION=1;
export const PUBLICATION_MODE='COPY_EXACT_SOURCE_SIGNED_SNAPSHOT';
export const MIRROR_INDEX_SCHEMA='LTP_PUBLIC_SNAPSHOT_MIRROR_INDEX';
export const MIRROR_INDEX_VERSION=1;
export const MAX_MIRROR_INDEX_ENTRIES=100000;

export function byteSha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
export function sourcePathId(instanceId){return `src_${byteSha256(Buffer.from(String(instanceId),'utf8')).slice(0,24)}`;}
function exactKeys(value,allowed,label){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label}必须是对象`);
  const extra=Object.keys(value).filter(key=>!allowed.includes(key));if(extra.length)throw new Error(`${label}包含未定义字段：${extra.join(',')}`);
}
function nonEmpty(value,label,max=300){const text=String(value??'');if(!text||text.length>max||/[\u0000-\u001f\u007f]/.test(text))throw new Error(`${label}无效`);return text;}
function hash(value,label){const text=String(value||'');if(!/^[a-f0-9]{64}$/.test(text))throw new Error(`${label}无效`);return text;}
function safeRelative(value,label){const text=String(value||'');if(!text||path.isAbsolute(text)||text.split(/[\\/]/).includes('..')||text.includes('\\'))throw new Error(`${label}必须是安全相对路径`);return text;}
function iso(value,label){const text=String(value||'');if(!Number.isFinite(Date.parse(text)))throw new Error(`${label}无效`);return text;}

export function buildPublicationManifest(snapshot,snapshotBytes){
  if(!Buffer.isBuffer(snapshotBytes))snapshotBytes=Buffer.from(snapshotBytes);
  const verified=verifyFederationSnapshot(snapshot);
  const snapshotFile=`${snapshot.snapshotRoot}.snapshot.json`;
  return {
    schema:PUBLICATION_SCHEMA,
    schemaVersion:PUBLICATION_SCHEMA_VERSION,
    packageMode:PUBLICATION_MODE,
    sourceInstanceId:verified.source.id,
    sourceInstanceName:verified.source.name,
    sourcePathId:sourcePathId(verified.source.id),
    sourceKeyFingerprint:verified.keyFingerprint,
    snapshotRoot:snapshot.snapshotRoot,
    contentRoot:snapshot.contentRoot,
    previousRoot:snapshot.previousRoot,
    generatedAt:snapshot.generatedAt,
    recordCount:snapshot.recordCount,
    snapshotFile,
    snapshotFileSha256:byteSha256(snapshotBytes),
    snapshotSchema:snapshot.schema,
    snapshotSchemaVersion:snapshot.schemaVersion
  };
}

export function validatePublicationManifest(manifest){
  exactKeys(manifest,['schema','schemaVersion','packageMode','sourceInstanceId','sourceInstanceName','sourcePathId','sourceKeyFingerprint','snapshotRoot','contentRoot','previousRoot','generatedAt','recordCount','snapshotFile','snapshotFileSha256','snapshotSchema','snapshotSchemaVersion'],'发布 manifest');
  if(manifest.schema!==PUBLICATION_SCHEMA||manifest.schemaVersion!==PUBLICATION_SCHEMA_VERSION||manifest.packageMode!==PUBLICATION_MODE)throw new Error('发布 manifest schema/version/mode 不支持');
  nonEmpty(manifest.sourceInstanceId,'sourceInstanceId',120);nonEmpty(manifest.sourceInstanceName,'sourceInstanceName',120);
  if(manifest.sourcePathId!==sourcePathId(manifest.sourceInstanceId))throw new Error('sourcePathId 与 sourceInstanceId 不一致');
  hash(manifest.sourceKeyFingerprint,'sourceKeyFingerprint');hash(manifest.snapshotRoot,'snapshotRoot');hash(manifest.contentRoot,'contentRoot');if(manifest.previousRoot)hash(manifest.previousRoot,'previousRoot');iso(manifest.generatedAt,'generatedAt');
  if(!Number.isInteger(manifest.recordCount)||manifest.recordCount<0||manifest.recordCount>100000)throw new Error('recordCount 无效');
  const expectedFile=`${manifest.snapshotRoot}.snapshot.json`;if(manifest.snapshotFile!==expectedFile)throw new Error('snapshotFile 不是 content-addressed 文件名');safeRelative(manifest.snapshotFile,'snapshotFile');hash(manifest.snapshotFileSha256,'snapshotFileSha256');
  if(manifest.snapshotSchema!=='LTP_PUBLIC_EVIDENCE_SNAPSHOT'||manifest.snapshotSchemaVersion!==1)throw new Error('snapshot schema/version 不支持');
  return manifest;
}

export function publicationRelativePath(manifest){validatePublicationManifest(manifest);return path.posix.join('sources',manifest.sourcePathId,manifest.snapshotRoot);}
export function mirrorEntryFromManifest(manifest){
  validatePublicationManifest(manifest);
  return {
    sourceInstanceId:manifest.sourceInstanceId,
    sourceInstanceName:manifest.sourceInstanceName,
    sourcePathId:manifest.sourcePathId,
    sourceKeyFingerprint:manifest.sourceKeyFingerprint,
    snapshotRoot:manifest.snapshotRoot,
    contentRoot:manifest.contentRoot,
    previousRoot:manifest.previousRoot,
    generatedAt:manifest.generatedAt,
    recordCount:manifest.recordCount,
    packagePath:publicationRelativePath(manifest),
    snapshotFile:manifest.snapshotFile,
    snapshotFileSha256:manifest.snapshotFileSha256
  };
}
function validateMirrorEntry(entry){
  exactKeys(entry,['sourceInstanceId','sourceInstanceName','sourcePathId','sourceKeyFingerprint','snapshotRoot','contentRoot','previousRoot','generatedAt','recordCount','packagePath','snapshotFile','snapshotFileSha256'],'mirror index entry');
  const manifestLike={schema:PUBLICATION_SCHEMA,schemaVersion:PUBLICATION_SCHEMA_VERSION,packageMode:PUBLICATION_MODE,sourceInstanceId:entry.sourceInstanceId,sourceInstanceName:entry.sourceInstanceName,sourcePathId:entry.sourcePathId,sourceKeyFingerprint:entry.sourceKeyFingerprint,snapshotRoot:entry.snapshotRoot,contentRoot:entry.contentRoot,previousRoot:entry.previousRoot,generatedAt:entry.generatedAt,recordCount:entry.recordCount,snapshotFile:entry.snapshotFile,snapshotFileSha256:entry.snapshotFileSha256,snapshotSchema:'LTP_PUBLIC_EVIDENCE_SNAPSHOT',snapshotSchemaVersion:1};
  validatePublicationManifest(manifestLike);const expected=publicationRelativePath(manifestLike);if(entry.packagePath!==expected)throw new Error('mirror packagePath 与 content address 不一致');safeRelative(entry.packagePath,'packagePath');return entry;
}
export function emptyMirrorIndex(){return {schema:MIRROR_INDEX_SCHEMA,schemaVersion:MIRROR_INDEX_VERSION,entries:[]};}
export function validateMirrorIndex(index){
  exactKeys(index,['schema','schemaVersion','entries'],'mirror index');if(index.schema!==MIRROR_INDEX_SCHEMA||index.schemaVersion!==MIRROR_INDEX_VERSION)throw new Error('mirror index schema/version 不支持');
  if(!Array.isArray(index.entries)||index.entries.length>MAX_MIRROR_INDEX_ENTRIES)throw new Error('mirror index entries 无效');
  const keys=new Set();for(const entry of index.entries){validateMirrorEntry(entry);const key=`${entry.sourceInstanceId}\u001f${entry.snapshotRoot}`;if(keys.has(key))throw new Error('mirror index 存在重复 snapshot');keys.add(key);}
  const sorted=[...index.entries].sort((a,b)=>a.sourceInstanceId.localeCompare(b.sourceInstanceId)||a.generatedAt.localeCompare(b.generatedAt)||a.snapshotRoot.localeCompare(b.snapshotRoot));
  if(JSON.stringify(sorted)!==JSON.stringify(index.entries))throw new Error('mirror index entries 必须使用确定性排序');return index;
}
export function upsertMirrorIndex(index,manifest){
  const current=index?structuredClone(validateMirrorIndex(index)):emptyMirrorIndex();const entry=mirrorEntryFromManifest(manifest);const i=current.entries.findIndex(x=>x.sourceInstanceId===entry.sourceInstanceId&&x.snapshotRoot===entry.snapshotRoot);
  if(i>=0){if(JSON.stringify(current.entries[i])!==JSON.stringify(entry))throw new Error('mirror index 同一 snapshotRoot 元数据冲突');return current;}
  if(current.entries.length>=MAX_MIRROR_INDEX_ENTRIES)throw new Error('mirror index 已达到安全上限，拒绝静默裁剪历史');current.entries.push(entry);current.entries.sort((a,b)=>a.sourceInstanceId.localeCompare(b.sourceInstanceId)||a.generatedAt.localeCompare(b.generatedAt)||a.snapshotRoot.localeCompare(b.snapshotRoot));return current;
}

export function verifyPublicationPayload({manifest,snapshotBytes,expectedSnapshotRoot='',expectedSourceInstanceId=''}={}){
  if(!Buffer.isBuffer(snapshotBytes))snapshotBytes=Buffer.from(snapshotBytes||'');
  validatePublicationManifest(manifest);
  if(expectedSnapshotRoot&&manifest.snapshotRoot!==expectedSnapshotRoot)throw new Error('package snapshotRoot 与请求不一致');
  if(expectedSourceInstanceId&&manifest.sourceInstanceId!==expectedSourceInstanceId)throw new Error('package sourceInstanceId 与请求不一致');
  if(byteSha256(snapshotBytes)!==manifest.snapshotFileSha256)throw new Error('snapshot 文件字节 hash 不一致');
  let snapshot;try{snapshot=JSON.parse(snapshotBytes.toString('utf8'))}catch{throw new Error('snapshot JSON 无效')}
  const verified=verifyFederationSnapshot(snapshot);
  if(snapshot.snapshotRoot!==manifest.snapshotRoot||snapshot.contentRoot!==manifest.contentRoot||snapshot.previousRoot!==manifest.previousRoot||snapshot.generatedAt!==manifest.generatedAt||snapshot.recordCount!==manifest.recordCount)throw new Error('manifest 与 source-signed snapshot 元数据不一致');
  if(verified.source.id!==manifest.sourceInstanceId||verified.source.name!==manifest.sourceInstanceName||verified.keyFingerprint!==manifest.sourceKeyFingerprint)throw new Error('manifest 与 snapshot source identity 不一致');
  return {manifest,snapshot,snapshotBytes,entry:mirrorEntryFromManifest(manifest),verified};
}

export async function verifyPublicationPackage(packageDir,{expectedSnapshotRoot='',expectedSourceInstanceId=''}={}){
  const dir=path.resolve(packageDir);const manifestPath=path.join(dir,'manifest.json');let manifest;
  try{manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'))}catch(err){throw new Error(`发布 manifest 读取失败：${err.message}`)}
  validatePublicationManifest(manifest);
  if(expectedSnapshotRoot&&manifest.snapshotRoot!==expectedSnapshotRoot)throw new Error('package snapshotRoot 与请求不一致');if(expectedSourceInstanceId&&manifest.sourceInstanceId!==expectedSourceInstanceId)throw new Error('package sourceInstanceId 与请求不一致');
  if(path.basename(dir)!==manifest.snapshotRoot||path.basename(path.dirname(dir))!==manifest.sourcePathId||path.basename(path.dirname(path.dirname(dir)))!=='sources')throw new Error('package 目录与 content address 不一致');
  const snapshotPath=path.join(dir,manifest.snapshotFile);const snapshotBytes=await fs.readFile(snapshotPath);const payload=verifyPublicationPayload({manifest,snapshotBytes,expectedSnapshotRoot,expectedSourceInstanceId});
  return {dir,...payload,snapshotPath,manifestPath};
}

export async function readMirrorIndex(mirrorRoot){const file=path.join(path.resolve(mirrorRoot),'public-evidence','index.json');try{return {file,index:validateMirrorIndex(JSON.parse(await fs.readFile(file,'utf8')))}}catch(err){throw new Error(`mirror index 读取/校验失败：${err.message}`)}}

export async function resolveSnapshotFromMirrors({mirrorRoots,snapshotRoot,sourceInstanceId='',outFile=''}={}){
  hash(snapshotRoot,'请求 snapshotRoot');if(!Array.isArray(mirrorRoots)||!mirrorRoots.length||mirrorRoots.length>64)throw new Error('mirrorRoots 需为1—64个目录');if(sourceInstanceId)nonEmpty(sourceInstanceId,'sourceInstanceId',120);
  const valid=[];const failures=[];
  for(const rootRaw of mirrorRoots){const root=path.resolve(rootRaw);try{
    const {index}=await readMirrorIndex(root);const matches=index.entries.filter(x=>x.snapshotRoot===snapshotRoot&&(!sourceInstanceId||x.sourceInstanceId===sourceInstanceId));if(!matches.length)throw new Error('mirror index 未声明请求的 snapshot');if(matches.length!==1)throw new Error('mirror index 对请求 snapshot 不唯一');const entry=matches[0];const packageDir=path.resolve(root,'public-evidence',entry.packagePath);const publicRoot=path.resolve(root,'public-evidence');if(!packageDir.startsWith(publicRoot+path.sep))throw new Error('mirror packagePath 越界');const verified=await verifyPublicationPackage(packageDir,{expectedSnapshotRoot:snapshotRoot,expectedSourceInstanceId:sourceInstanceId||entry.sourceInstanceId});if(verified.manifest.snapshotFileSha256!==entry.snapshotFileSha256)throw new Error('mirror index 与 package snapshot hash 不一致');valid.push({mirrorRoot:root,...verified});
  }catch(err){failures.push({mirrorRoot:root,error:err.message});}}
  if(!valid.length)throw new Error(`没有可验证的镜像：${failures.map(x=>`${x.mirrorRoot}: ${x.error}`).join(' | ')}`);
  const sourceIds=new Set(valid.map(x=>x.manifest.sourceInstanceId));const fileHashes=new Set(valid.map(x=>x.manifest.snapshotFileSha256));if(sourceIds.size!==1)throw new Error('多个有效镜像对 source instance 产生冲突');if(fileHashes.size!==1)throw new Error('多个有效镜像不是 byte-identical source snapshot');
  if(outFile){const out=path.resolve(outFile);await fs.mkdir(path.dirname(out),{recursive:true});const tmp=`${out}.${process.pid}.${Date.now()}.tmp`;try{await fs.writeFile(tmp,valid[0].snapshotBytes,{mode:0o644});await fs.rename(tmp,out)}catch(err){await fs.rm(tmp,{force:true});throw err}}
  return {snapshotRoot,sourceInstanceId:valid[0].manifest.sourceInstanceId,snapshotFileSha256:valid[0].manifest.snapshotFileSha256,validMirrors:valid.map(x=>x.mirrorRoot),failures,recoveredFrom:valid[0].mirrorRoot,outFile:outFile?path.resolve(outFile):''};
}
