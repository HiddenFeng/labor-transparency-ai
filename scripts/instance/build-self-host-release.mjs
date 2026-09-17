import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {VERSION} from '../../sites-app/src/domain.mjs';
import {canonicalJson} from '../../sites-app/src/federation.mjs';

export const SELF_HOST_RELEASE_SCHEMA='LTP_SELF_HOST_RELEASE';
export const SELF_HOST_RELEASE_VERSION=1;
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const SOURCES=['sites-app/public','sites-app/src','scripts/instance','scripts/federation','deploy/self-host','LICENSE','LICENSE-DATA.md','NOTICE','README.md','NON_COMMERCIAL_POLICY.md','PRIVACY.md','SECURITY.md','INSTANCE_OPERATORS.md','TRADEMARK.md','BRANDING.md','AUTHORS.md'];
function hash(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
async function exists(file){try{await fs.stat(file);return true}catch(err){if(err?.code==='ENOENT')return false;throw err}}
function include(source){const base=path.basename(source);if(base==='.DS_Store'||base.endsWith('.test.mjs')||base==='backups'||base==='.env')return false;return true;}
async function listFiles(root,dir=root,out=[]){for(const name of (await fs.readdir(dir)).sort()){const p=path.join(dir,name);const stat=await fs.stat(p);if(stat.isDirectory())await listFiles(root,p,out);else if(stat.isFile()){const rel=path.relative(root,p).split(path.sep).join('/');const bytes=await fs.readFile(p);out.push({path:rel,sha256:hash(bytes),size:bytes.length});}}return out;}

export async function buildSelfHostRelease({out,revision='local',createdAt=new Date().toISOString()}={}){
  if(!out)throw new Error('必须提供 --out');if(!/^[A-Za-z0-9._-]{1,120}$/.test(String(revision)))throw new Error('release revision 无效');if(!Number.isFinite(Date.parse(createdAt)))throw new Error('release createdAt 无效');const target=path.resolve(out);if(await exists(target))throw new Error(`release 目标已存在，拒绝覆盖：${target}`);await fs.mkdir(path.dirname(target),{recursive:true});const tmp=`${target}.tmp-${process.pid}-${Date.now()}`;await fs.mkdir(tmp,{mode:0o755});
  try{
    for(const rel of SOURCES){const src=path.join(ROOT,rel);if(!await exists(src))throw new Error(`release source 缺失：${rel}`);const dest=path.join(tmp,rel);const stat=await fs.stat(src);if(stat.isDirectory())await fs.cp(src,dest,{recursive:true,filter:include});else{await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(src,dest);}}
    const files=await listFiles(tmp);const manifest={schema:SELF_HOST_RELEASE_SCHEMA,schemaVersion:SELF_HOST_RELEASE_VERSION,appVersion:VERSION,revision:String(revision),createdAt,fileRoot:hash(Buffer.from(canonicalJson(files),'utf8')),files};await fs.writeFile(path.join(tmp,'SELF_HOST_RELEASE.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o644});await fs.rename(tmp,target);return {target,manifest};
  }catch(err){await fs.rm(tmp,{recursive:true,force:true});throw err}
}
export async function verifySelfHostRelease(dir){
  const root=path.resolve(dir);let manifest;try{manifest=JSON.parse(await fs.readFile(path.join(root,'SELF_HOST_RELEASE.json'),'utf8'))}catch(err){throw new Error(`release manifest 读取失败：${err.message}`)}if(manifest.schema!==SELF_HOST_RELEASE_SCHEMA||manifest.schemaVersion!==SELF_HOST_RELEASE_VERSION||manifest.appVersion!==VERSION)throw new Error('release manifest schema/version/appVersion 不支持');if(!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('release manifest files 无效');const actual=await listFiles(root);const filtered=actual.filter(x=>x.path!=='SELF_HOST_RELEASE.json');if(canonicalJson(filtered)!==canonicalJson(manifest.files)||hash(Buffer.from(canonicalJson(filtered),'utf8'))!==manifest.fileRoot)throw new Error('release 文件 hash/root 不一致');for(const forbidden of ['secrets.json','state.json','peers.json','.ltp-instance'])if(filtered.some(x=>x.path.split('/').includes(forbidden)||x.path.includes(forbidden)))throw new Error(`release 包含实例私有状态：${forbidden}`);for(const required of ['sites-app/src/server.mjs','sites-app/public/index.html','scripts/instance/self-host-server.mjs','scripts/instance/backup.mjs','scripts/instance/restore.mjs','deploy/self-host/Dockerfile','deploy/self-host/compose.yml','deploy/self-host/Caddyfile'])if(!filtered.some(x=>x.path===required))throw new Error(`release 缺少必需文件：${required}`);return {root,manifest};
}
function parseArgs(argv){const out={out:'',revision:'local'};for(let i=0;i<argv.length;i++){const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--out')out.out=value;else if(arg==='--revision')out.revision=value;else throw new Error(`未知参数：${arg}`);}return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const out=await buildSelfHostRelease(parseArgs(process.argv.slice(2)));console.log(JSON.stringify({status:'SELF_HOST_RELEASE_BUILD_PASS',directory:out.target,appVersion:out.manifest.appVersion,revision:out.manifest.revision,fileRoot:out.manifest.fileRoot,fileCount:out.manifest.files.length}));}catch(err){console.error(`SELF_HOST_RELEASE_BUILD_FAILED: ${err.message}`);process.exitCode=1;}}
