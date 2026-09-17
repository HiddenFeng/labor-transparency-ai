import crypto from 'node:crypto';
import {nowIso,publicDataset} from './domain.mjs';

export const FEDERATION_SCHEMA='LTP_PUBLIC_EVIDENCE_SNAPSHOT';
export const FEDERATION_SCHEMA_VERSION=1;
export const FEDERATION_SNAPSHOT_MODE='FULL_AUTHORIZED_PUBLIC_DATASET';
const KINDS=new Set(['product','brand','company_fact','relationship','labour_claim','product_claim']);
const DIRECTIONS=new Set(['neutral','positive','negative']);
const STATUSES=new Set(['REVIEWED','VERIFIED']);
const EVIDENCE=new Set(['E0','E1','E2','E3','E4','E5']);

export function canonicalJson(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}
export function sha256(value){return crypto.createHash('sha256').update(typeof value==='string'?value:Buffer.from(value)).digest('hex');}
function exactKeys(value,allowed,label){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label}必须是对象`);
  const extras=Object.keys(value).filter(key=>!allowed.includes(key));if(extras.length)throw new Error(`${label}包含未定义字段：${extras.join(',')}`);
}
function text(value,{label='字段',min=0,max=2000}={}){
  if(typeof value!=='string')throw new Error(`${label}必须是文本`);
  if(value.length<min||value.length>max||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))throw new Error(`${label}无效`);
  return value;
}
function iso(value,label){
  text(value,{label,min:20,max:40});const t=Date.parse(value);if(!Number.isFinite(t))throw new Error(`${label}无效`);return value;
}
function date(value,label){if(!value)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error(`${label}无效`);return value;}
function httpsUrl(value,label){if(!value)return '';let u;try{u=new URL(value)}catch{throw new Error(`${label}无效`)}if(u.protocol!=='https:'||u.username||u.password)throw new Error(`${label}仅接受无凭据 HTTPS`);return u.href;}
function publicKeyObject(value){
  exactKeys(value,['algorithm','encoding','value'],'实例公钥');
  if(value.algorithm!=='Ed25519'||value.encoding!=='spki-der-base64'||!/^[A-Za-z0-9+/=]{40,500}$/.test(String(value.value||'')))throw new Error('实例公钥无效');
  return {algorithm:'Ed25519',encoding:'spki-der-base64',value:value.value};
}
export function publicKeyFingerprint(publicKey){return sha256(Buffer.from(publicKeyObject(publicKey).value,'base64'));}
function sourceInstance(instance){
  const normalized={id:String(instance?.id||''),name:String(instance?.name||''),mode:String(instance?.mode||''),operator:String(instance?.operator||''),publicUrl:String(instance?.publicUrl||''),publicKey:publicKeyObject(instance?.publicKey||{})};
  if(!/^[A-Za-z0-9._:-]{6,120}$/.test(normalized.id))throw new Error('实例 ID 无效');
  text(normalized.name,{label:'实例名称',min:2,max:120});
  if(normalized.mode!=='independent')throw new Error('联邦快照仅接受 independent 实例身份');
  if(normalized.operator)text(normalized.operator,{label:'实例运营者',max:160});
  normalized.publicUrl=httpsUrl(normalized.publicUrl,'实例公开 URL');
  return normalized;
}
function sourceRow(row,instanceId){
  const logicalId=`${instanceId}:${row.id}`;
  return {
    logicalId,
    sourceRecordId:row.id,
    version:Number(row.version),
    kind:row.kind,
    company:{name:row.companyName,region:row.region},
    claim:{
      title:row.title,description:row.description,scope:row.scope||'',periodStart:row.periodStart||'',periodEnd:row.periodEnd||'',direction:row.direction||'neutral',dimension:row.dimension||'other',
      productLogicalId:row.productId?`${instanceId}:${row.productId}`:'',brandLogicalId:row.brandId?`${instanceId}:${row.brandId}`:'',relationType:row.relationType||'',relation:row.relation||'',category:row.category||'',
      sources:(row.sources||[]).map(({id,url,title,type,publishedAt,supports})=>({id,url,title,type,publishedAt,supports})),
      creditName:row.creditName||'匿名贡献者',evidence:row.evidence,status:row.status,createdAt:row.createdAt,updatedAt:row.updatedAt
    },
    redistribution:{approved:true,license:row.license||'LicenseRef-LTP-Public-Interest-1.0'}
  };
}
function recordHash(record){return sha256(canonicalJson(record));}
function validateSource(source,index){
  exactKeys(source,['id','url','title','type','publishedAt','supports'],`来源[${index}]`);
  text(source.id,{label:'来源 ID',min:1,max:24});httpsUrl(source.url,'来源 URL');text(source.title,{label:'来源标题',min:2,max:200});text(source.type,{label:'来源类型',min:2,max:40});date(source.publishedAt,'来源日期');text(source.supports,{label:'来源支持范围',min:2,max:1000});
}
function validateRecord(record,sourceId){
  exactKeys(record,['logicalId','sourceRecordId','version','kind','company','claim','redistribution'],'联邦记录');
  text(record.logicalId,{label:'logicalId',min:8,max:260});text(record.sourceRecordId,{label:'sourceRecordId',min:4,max:120});
  if(record.logicalId!==`${sourceId}:${record.sourceRecordId}`)throw new Error('联邦记录 logicalId 与来源实例不一致');
  if(!Number.isInteger(record.version)||record.version<1)throw new Error('联邦记录版本无效');
  if(!KINDS.has(record.kind))throw new Error('联邦记录 kind 无效');
  exactKeys(record.company,['name','region'],'联邦公司');text(record.company.name,{label:'公司名称',min:2,max:120});text(record.company.region,{label:'公司地区',min:1,max:120});
  exactKeys(record.claim,['title','description','scope','periodStart','periodEnd','direction','dimension','productLogicalId','brandLogicalId','relationType','relation','category','sources','creditName','evidence','status','createdAt','updatedAt'],'联邦主张');
  text(record.claim.title,{label:'标题',min:2,max:120});text(record.claim.description,{label:'说明',min:2,max:2000});text(record.claim.scope,{label:'范围',max:300});date(record.claim.periodStart,'开始日期');date(record.claim.periodEnd,'结束日期');
  if(!DIRECTIONS.has(record.claim.direction))throw new Error('主张方向无效');text(record.claim.dimension,{label:'主张维度',min:2,max:40});
  for(const [key,value] of [['productLogicalId',record.claim.productLogicalId],['brandLogicalId',record.claim.brandLogicalId]])if(value){text(value,{label:key,max:260});if(!value.startsWith(`${sourceId}:`))throw new Error(`${key} 必须引用同一来源实例`);}
  text(record.claim.relationType,{label:'关系类型',max:80});text(record.claim.relation,{label:'关系',max:80});text(record.claim.category,{label:'类别',max:80});
  if(!Array.isArray(record.claim.sources)||record.claim.sources.length>10)throw new Error('来源数组无效');record.claim.sources.forEach(validateSource);
  text(record.claim.creditName,{label:'公开署名',min:1,max:40});if(!EVIDENCE.has(record.claim.evidence))throw new Error('证据等级无效');if(!STATUSES.has(record.claim.status))throw new Error('联邦记录必须来自已复核公开版本');iso(record.claim.createdAt,'创建时间');iso(record.claim.updatedAt,'更新时间');
  exactKeys(record.redistribution,['approved','license'],'再分发声明');if(record.redistribution.approved!==true)throw new Error('联邦记录缺少再分发批准');text(record.redistribution.license,{label:'许可证',min:4,max:120});
  return record;
}
function snapshotUnsigned(snapshot){
  return {schema:snapshot.schema,schemaVersion:snapshot.schemaVersion,snapshotMode:snapshot.snapshotMode,instance:snapshot.instance,generatedAt:snapshot.generatedAt,previousRoot:snapshot.previousRoot,contentRoot:snapshot.contentRoot,recordCount:snapshot.recordCount,records:snapshot.records,delta:snapshot.delta};
}
function createPublicKey(value){return crypto.createPublicKey({key:Buffer.from(publicKeyObject(value).value,'base64'),type:'spki',format:'der'});}
function createPrivateKey(value){
  if(value?.algorithm!=='Ed25519'||value?.encoding!=='pkcs8-der-base64'||!/^[A-Za-z0-9+/=]{40,500}$/.test(String(value?.value||'')))throw new Error('实例签名私钥无效');
  return crypto.createPrivateKey({key:Buffer.from(value.value,'base64'),type:'pkcs8',format:'der'});
}
function sameMap(a,b){if(a.size!==b.size)return false;for(const [key,value] of a)if(b.get(key)!==value)return false;return true;}
function evidenceId(sourceInstanceId,logicalId){return `fed_${sha256(`${sourceInstanceId}\u001f${logicalId}`).slice(0,24)}`;}
function importId(sourceInstanceId){return `fimp_${sha256(sourceInstanceId).slice(0,24)}`;}

export function buildFederationSnapshot({state,instance,signingPrivateKey,previousExportState=null,generatedAt=nowIso()}={}){
  const source=sourceInstance(instance);iso(generatedAt,'快照时间');
  const privateKey=createPrivateKey(signingPrivateKey);const derivedPublic=crypto.createPublicKey(privateKey).export({type:'spki',format:'der'}).toString('base64');
  if(derivedPublic!==source.publicKey.value)throw new Error('实例公钥与签名私钥不匹配');
  const dataset=publicDataset(state);const records=[];
  for(const kind of Object.keys(dataset.categories).sort())for(const row of dataset.categories[kind])if(!row.synthetic)records.push(sourceRow(row,source.id));
  records.sort((a,b)=>a.logicalId.localeCompare(b.logicalId));records.forEach(row=>validateRecord(row,source.id));
  const recordHashes=Object.fromEntries(records.map(row=>[row.logicalId,recordHash(row)]));
  const previousHashes=previousExportState?.recordHashes&&typeof previousExportState.recordHashes==='object'?previousExportState.recordHashes:{};
  const previousRoot=String(previousExportState?.lastSnapshotRoot||'');
  const upserts=records.filter(row=>previousHashes[row.logicalId]!==recordHashes[row.logicalId]);
  const tombstones=Object.keys(previousHashes).filter(logicalId=>!(logicalId in recordHashes)).sort();
  const contentRoot=sha256(canonicalJson(records));
  const unsigned={schema:FEDERATION_SCHEMA,schemaVersion:FEDERATION_SCHEMA_VERSION,snapshotMode:FEDERATION_SNAPSHOT_MODE,instance:source,generatedAt,previousRoot,contentRoot,recordCount:records.length,records,delta:{baseRoot:previousRoot,upserts,tombstones}};
  const snapshotRoot=sha256(canonicalJson(unsigned));
  const keyFingerprint=publicKeyFingerprint(source.publicKey);const signatureValue=crypto.sign(null,Buffer.from(snapshotRoot,'utf8'),privateKey).toString('base64');
  const snapshot={...unsigned,snapshotRoot,signature:{algorithm:'Ed25519',keyFingerprint,value:signatureValue}};
  return {snapshot,exportState:{schemaVersion:1,lastSnapshotRoot:snapshotRoot,lastGeneratedAt:generatedAt,recordHashes}};
}

export function verifyFederationSnapshot(snapshot){
  exactKeys(snapshot,['schema','schemaVersion','snapshotMode','instance','generatedAt','previousRoot','contentRoot','recordCount','records','delta','snapshotRoot','signature'],'联邦快照');
  if(snapshot.schema!==FEDERATION_SCHEMA||snapshot.schemaVersion!==FEDERATION_SCHEMA_VERSION||snapshot.snapshotMode!==FEDERATION_SNAPSHOT_MODE)throw new Error('联邦快照 schema/version/mode 不支持');
  const source=sourceInstance(snapshot.instance);iso(snapshot.generatedAt,'快照时间');text(snapshot.previousRoot,{label:'previousRoot',max:64});if(snapshot.previousRoot&&!/^[a-f0-9]{64}$/.test(snapshot.previousRoot))throw new Error('previousRoot 无效');
  if(!Array.isArray(snapshot.records)||snapshot.records.length>100000)throw new Error('联邦 records 无效');snapshot.records.forEach(row=>validateRecord(row,source.id));
  const logicalIds=new Set();for(const row of snapshot.records){if(logicalIds.has(row.logicalId))throw new Error('联邦 records 存在重复 logicalId');logicalIds.add(row.logicalId);}
  const sorted=[...snapshot.records].sort((a,b)=>a.logicalId.localeCompare(b.logicalId));if(canonicalJson(sorted)!==canonicalJson(snapshot.records))throw new Error('联邦 records 必须按 logicalId 排序');
  if(snapshot.recordCount!==snapshot.records.length)throw new Error('recordCount 不一致');
  const computedContentRoot=sha256(canonicalJson(snapshot.records));if(snapshot.contentRoot!==computedContentRoot)throw new Error('contentRoot 校验失败');
  exactKeys(snapshot.delta,['baseRoot','upserts','tombstones'],'联邦 delta');if(snapshot.delta.baseRoot!==snapshot.previousRoot)throw new Error('delta baseRoot 不一致');
  if(!Array.isArray(snapshot.delta.upserts)||!Array.isArray(snapshot.delta.tombstones))throw new Error('delta 格式无效');
  const fullById=new Map(snapshot.records.map(row=>[row.logicalId,row]));const upsertIds=new Set();
  for(const row of snapshot.delta.upserts){validateRecord(row,source.id);const full=fullById.get(row.logicalId);if(!full||recordHash(full)!==recordHash(row))throw new Error('delta upsert 与 full snapshot 不一致');if(upsertIds.has(row.logicalId))throw new Error('delta upsert 重复');upsertIds.add(row.logicalId);}
  const tombstoneSet=new Set();for(const logicalId of snapshot.delta.tombstones){text(logicalId,{label:'delta tombstone',min:8,max:260});if(!logicalId.startsWith(`${source.id}:`))throw new Error('delta tombstone 来源实例不一致');if(fullById.has(logicalId))throw new Error('delta tombstone 仍存在于 full snapshot');if(tombstoneSet.has(logicalId))throw new Error('delta tombstone 重复');tombstoneSet.add(logicalId);}
  exactKeys(snapshot.signature,['algorithm','keyFingerprint','value'],'联邦签名');if(snapshot.signature.algorithm!=='Ed25519')throw new Error('签名算法不支持');
  const fingerprint=publicKeyFingerprint(source.publicKey);if(snapshot.signature.keyFingerprint!==fingerprint)throw new Error('签名公钥 fingerprint 不一致');if(!/^[A-Za-z0-9+/=]{40,500}$/.test(String(snapshot.signature.value||'')))throw new Error('签名格式无效');
  const computedRoot=sha256(canonicalJson(snapshotUnsigned(snapshot)));if(snapshot.snapshotRoot!==computedRoot)throw new Error('snapshotRoot 校验失败');
  const verified=crypto.verify(null,Buffer.from(computedRoot,'utf8'),createPublicKey(source.publicKey),Buffer.from(snapshot.signature.value,'base64'));if(!verified)throw new Error('联邦快照签名校验失败');
  return {source,keyFingerprint:fingerprint,snapshotRoot:computedRoot,contentRoot:computedContentRoot,records:snapshot.records};
}

export function applyFederationSnapshot(state,snapshot,{importedAt=nowIso()}={}){
  const verified=verifyFederationSnapshot(snapshot);iso(importedAt,'导入时间');
  if(!Array.isArray(state.federatedEvidence))state.federatedEvidence=[];if(!Array.isArray(state.federationImports))state.federationImports=[];
  const sourceId=verified.source.id;const trackerKey=importId(sourceId);let tracker=state.federationImports.find(x=>x.id===trackerKey);
  const sourceRows=state.federatedEvidence.filter(x=>x.sourceInstanceId===sourceId);
  if(!tracker&&sourceRows.length)throw new Error('联邦导入状态损坏：存在来源记录但缺少来源 tracker');
  if(tracker){
    if(tracker.keyFingerprint!==verified.keyFingerprint)throw new Error('来源实例公钥发生变化，拒绝自动信任新密钥');
    if(tracker.lastSnapshotRoot===snapshot.snapshotRoot)return {alreadyApplied:true,sourceInstanceId:sourceId,snapshotRoot:snapshot.snapshotRoot,upserted:0,tombstoned:0};
    if(snapshot.previousRoot!==tracker.lastSnapshotRoot)throw new Error('联邦快照链不连续，拒绝跳过或分叉导入');
    const expected=new Map(sourceRows.filter(x=>x.status==='CURRENT').map(x=>[x.logicalId,x.recordHash]));
    for(const logicalId of snapshot.delta.tombstones)expected.delete(logicalId);
    for(const row of snapshot.delta.upserts)expected.set(row.logicalId,recordHash(row));
    const incoming=new Map(snapshot.records.map(row=>[row.logicalId,recordHash(row)]));
    if(!sameMap(expected,incoming))throw new Error('delta 与上一已导入状态无法重建当前 full snapshot');
  }else if(!snapshot.previousRoot){
    if(snapshot.delta.tombstones.length||snapshot.delta.upserts.length!==snapshot.records.length)throw new Error('创世 full snapshot 的 delta 必须包含全部记录且不能含 tombstone');
  }

  let upserted=0;let tombstoned=0;const incomingIds=new Set();
  for(const row of snapshot.records){
    incomingIds.add(row.logicalId);const hash=recordHash(row);const id=evidenceId(sourceId,row.logicalId);const existing=state.federatedEvidence.find(x=>x.id===id);
    if(existing&&existing.sourceVersion>row.version)throw new Error('来源记录版本倒退');
    if(existing&&existing.sourceVersion===row.version&&existing.recordHash!==hash)throw new Error('同一来源版本出现内容冲突');
    const changed=!existing||existing.status!=='CURRENT'||existing.recordHash!==hash||existing.sourceVersion!==row.version;
    if(!changed)continue;
    const history=Array.isArray(existing?.history)?structuredClone(existing.history):[];
    history.push({event:existing?.status==='TOMBSTONED'?'RESTORE':'UPSERT',snapshotRoot:snapshot.snapshotRoot,sourceVersion:row.version,recordHash:hash,at:importedAt});
    const next={id,sourceInstanceId:sourceId,sourceInstanceName:verified.source.name,sourcePublicKeyFingerprint:verified.keyFingerprint,logicalId:row.logicalId,sourceRecordId:row.sourceRecordId,sourceVersion:row.version,status:'CURRENT',recordHash:hash,record:structuredClone(row),snapshotRoot:snapshot.snapshotRoot,sourceGeneratedAt:snapshot.generatedAt,importedAt,history};
    if(existing)Object.assign(existing,next);else state.federatedEvidence.push(next);upserted++;
  }
  for(const existing of sourceRows){
    if(existing.status!=='CURRENT'||incomingIds.has(existing.logicalId))continue;
    existing.status='TOMBSTONED';existing.tombstoneReason='ABSENT_FROM_FULL_AUTHORIZED_SNAPSHOT';existing.tombstonedAt=importedAt;existing.snapshotRoot=snapshot.snapshotRoot;existing.sourceGeneratedAt=snapshot.generatedAt;existing.importedAt=importedAt;existing.record=null;
    if(!Array.isArray(existing.history))existing.history=[];existing.history.push({event:'TOMBSTONE',snapshotRoot:snapshot.snapshotRoot,sourceVersion:existing.sourceVersion,recordHash:existing.recordHash,at:importedAt});tombstoned++;
  }
  const trackerValue={id:trackerKey,sourceInstanceId:sourceId,sourceInstanceName:verified.source.name,keyFingerprint:verified.keyFingerprint,sourcePublicKey:verified.source.publicKey,chainStart:tracker?.chainStart||(snapshot.previousRoot?'TRUSTED_CURRENT_SNAPSHOT':'GENESIS'),lastSnapshotRoot:snapshot.snapshotRoot,lastContentRoot:snapshot.contentRoot,lastGeneratedAt:snapshot.generatedAt,lastImportedAt:importedAt,snapshotCount:Number(tracker?.snapshotCount||0)+1};
  if(tracker)Object.assign(tracker,trackerValue);else state.federationImports.push(trackerValue);
  return {alreadyApplied:false,sourceInstanceId:sourceId,snapshotRoot:snapshot.snapshotRoot,upserted,tombstoned,recordCount:snapshot.records.length,chainStart:trackerValue.chainStart};
}

export function publicFederatedEvidence(state,{sourceInstanceId='',includeTombstones=true}={}){
  const items=(state.federatedEvidence||[]).filter(x=>!sourceInstanceId||x.sourceInstanceId===sourceInstanceId).filter(x=>includeTombstones||x.status==='CURRENT').map(x=>({
    id:x.id,sourceInstance:{id:x.sourceInstanceId,name:x.sourceInstanceName,keyFingerprint:x.sourcePublicKeyFingerprint},logicalId:x.logicalId,sourceVersion:x.sourceVersion,status:x.status,record:x.status==='CURRENT'?x.record:null,recordHash:x.recordHash,snapshotRoot:x.snapshotRoot,sourceGeneratedAt:x.sourceGeneratedAt,importedAt:x.importedAt,tombstoneReason:x.tombstoneReason||'',tombstonedAt:x.tombstonedAt||'',history:(x.history||[]).map(event=>({event:event.event,snapshotRoot:event.snapshotRoot,sourceVersion:event.sourceVersion,recordHash:event.recordHash,at:event.at}))
  })).sort((a,b)=>a.sourceInstance.id.localeCompare(b.sourceInstance.id)||a.logicalId.localeCompare(b.logicalId));
  const sources=(state.federationImports||[]).filter(x=>!sourceInstanceId||x.sourceInstanceId===sourceInstanceId).map(x=>({sourceInstanceId:x.sourceInstanceId,sourceInstanceName:x.sourceInstanceName,keyFingerprint:x.keyFingerprint,chainStart:x.chainStart,lastSnapshotRoot:x.lastSnapshotRoot,lastContentRoot:x.lastContentRoot,lastGeneratedAt:x.lastGeneratedAt,lastImportedAt:x.lastImportedAt,snapshotCount:x.snapshotCount})).sort((a,b)=>a.sourceInstanceId.localeCompare(b.sourceInstanceId));
  return {items,sources,boundary:'这里只展示经过签名快照导入的可再分发公共证据及其纠正/撤回历史；tombstone 只保留 hash/版本/链路证明，不继续公开已撤正文；不包含用户身份、社区/劳动者投票身份关联、私有 feedback/advisory、联系方式、IP 或敏感材料。'};
}
