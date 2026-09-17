import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {canonicalJson} from '../../sites-app/src/federation.mjs';

export const BACKUP_SCHEMA='LTP_INSTANCE_BACKUP';
export const BACKUP_SCHEMA_VERSION=1;
const ALLOWED_FILES=new Map([
  ['instance.json',0o644],
  ['secrets.json',0o600],
  ['data/state.json',0o600],
  ['peers.json',0o600],
  ['federation/export-state.json',0o600]
]);

function exactKeys(value,allowed,label){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label}必须是对象`);const extra=Object.keys(value).filter(x=>!allowed.includes(x));if(extra.length)throw new Error(`${label}包含未定义字段：${extra.join(',')}`);}
function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function safeRel(value){const rel=String(value||'');if(!ALLOWED_FILES.has(rel)||path.isAbsolute(rel)||rel.split(/[\\/]/).includes('..')||rel.includes('\\'))throw new Error(`备份文件路径不允许：${rel}`);return rel;}
function iso(value,label){const s=String(value||'');if(!Number.isFinite(Date.parse(s)))throw new Error(`${label}无效`);return s;}
async function exists(file){try{await fs.stat(file);return true}catch(err){if(err?.code==='ENOENT')return false;throw err}}
function assertOwnerPrivate(stat,label){if(process.platform!=='win32'&&(stat.mode&0o077)!==0)throw new Error(`${label}权限过宽`);}

export async function collectBackupFiles(instanceRoot){
  const root=path.resolve(instanceRoot);const files=[];
  for(const [rel,expectedMode] of ALLOWED_FILES){const source=path.join(root,...rel.split('/'));if(!await exists(source)){if(['peers.json','federation/export-state.json'].includes(rel))continue;throw new Error(`备份所需文件缺失：${rel}`)}const stat=await fs.stat(source);if(!stat.isFile())throw new Error(`备份路径不是文件：${rel}`);if(expectedMode===0o600)assertOwnerPrivate(stat,rel);const bytes=await fs.readFile(source);files.push({path:rel,sha256:sha256(bytes),size:bytes.length,mode:expectedMode.toString(8)});}
  files.sort((a,b)=>a.path.localeCompare(b.path));return files;
}
export function buildBackupManifest({instanceId,createdAt=new Date().toISOString(),files}={}){
  if(!/^[A-Za-z0-9._:-]{6,120}$/.test(String(instanceId||'')))throw new Error('backup instanceId 无效');iso(createdAt,'backup createdAt');if(!Array.isArray(files)||files.length<3||files.length>ALLOWED_FILES.size)throw new Error('backup files 无效');for(const file of files){exactKeys(file,['path','sha256','size','mode'],'backup file');safeRel(file.path);if(!/^[a-f0-9]{64}$/.test(String(file.sha256||'')))throw new Error('backup file sha256 无效');if(!Number.isInteger(file.size)||file.size<0||file.size>128*1024*1024)throw new Error('backup file size 无效');if(file.mode!==ALLOWED_FILES.get(file.path).toString(8))throw new Error('backup file mode 无效');}
  const fileRoot=sha256(Buffer.from(canonicalJson(files),'utf8'));return {schema:BACKUP_SCHEMA,schemaVersion:BACKUP_SCHEMA_VERSION,instanceId,createdAt,fileRoot,files};
}
export function validateBackupManifest(manifest){
  exactKeys(manifest,['schema','schemaVersion','instanceId','createdAt','fileRoot','files'],'backup manifest');if(manifest.schema!==BACKUP_SCHEMA||manifest.schemaVersion!==BACKUP_SCHEMA_VERSION)throw new Error('backup manifest schema/version 不支持');const rebuilt=buildBackupManifest({instanceId:manifest.instanceId,createdAt:manifest.createdAt,files:manifest.files});if(rebuilt.fileRoot!==manifest.fileRoot)throw new Error('backup manifest fileRoot 不一致');return manifest;
}
export async function verifyBackupDirectory(backupDir){
  const root=path.resolve(backupDir);let manifest;try{manifest=validateBackupManifest(JSON.parse(await fs.readFile(path.join(root,'backup-manifest.json'),'utf8')))}catch(err){throw new Error(`backup manifest 读取/校验失败：${err.message}`)}const fileRoot=path.join(root,'instance');const actual=[];
  for(const entry of manifest.files){const rel=safeRel(entry.path);const file=path.join(fileRoot,...rel.split('/'));const stat=await fs.stat(file).catch(err=>{throw new Error(`backup 文件缺失 ${rel}: ${err.message}`)});if(!stat.isFile())throw new Error(`backup 路径不是文件：${rel}`);if(entry.mode==='600')assertOwnerPrivate(stat,`backup/${rel}`);const bytes=await fs.readFile(file);if(bytes.length!==entry.size||sha256(bytes)!==entry.sha256)throw new Error(`backup 文件 hash/size 不一致：${rel}`);actual.push({path:rel,sha256:entry.sha256,size:entry.size,mode:entry.mode});}
  if(sha256(Buffer.from(canonicalJson(actual),'utf8'))!==manifest.fileRoot)throw new Error('backup 实际文件 root 不一致');return {root,fileRoot,manifest};
}
export async function pathExists(file){return exists(file);}
export function expectedModeFor(rel){return ALLOWED_FILES.get(safeRel(rel));}
