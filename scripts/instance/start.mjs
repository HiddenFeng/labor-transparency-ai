import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRuntime,createAppServer} from '../../sites-app/src/server.mjs';

function assertPrivateMode(stat,file){
  if(process.platform==='win32')return;
  if((stat.mode&0o077)!==0)throw new Error(`${file} 权限过宽；要求仅当前用户可读写`);
}
function readJson(text,file){try{return JSON.parse(text)}catch{throw new Error(`${file} JSON 无效`)}}
function assertIndependentConfig(instance){
  if(!instance||typeof instance!=='object'||Array.isArray(instance))throw new Error('instance.json 无效');
  if(instance.mode!=='independent')throw new Error('仅允许 independent 实例启动');
  if(instance.runtime?.sameOrigin!==true)throw new Error('独立实例必须使用 same-origin API');
  if(instance.runtime?.referenceProductionDependency!==false)throw new Error('独立实例不得依赖 reference production');
  for(const key of ['apiBase','proxyApiOrigin','upstreamApi','referenceApi'])if(instance.runtime?.[key])throw new Error(`独立实例禁止远程上游配置：${key}`);
  if(!/^[A-Za-z0-9._:-]{6,120}$/.test(String(instance.id||'')))throw new Error('实例 ID 无效');
}
function assertSecrets(secrets){
  const tokenFields=['sessionSecret','reviewToken','exportToken','advisoryAgentToken','communityAgentToken'];
  for(const field of tokenFields)if(String(secrets?.[field]||'').length<32)throw new Error(`实例 secret 缺失或过短：${field}`);
  const key=secrets?.signingPrivateKey;
  if(key?.algorithm!=='Ed25519'||key?.encoding!=='pkcs8-der-base64'||!/^[A-Za-z0-9+/=]{40,500}$/.test(String(key?.value||'')))throw new Error('实例签名私钥无效');
}

export async function loadInstanceBundle({dir='.ltp-instance'}={}){
  const root=path.resolve(dir);
  const configFile=path.join(root,'instance.json');
  const secretsFile=path.join(root,'secrets.json');
  const [configText,secretsText,secretsStat]=await Promise.all([fs.readFile(configFile,'utf8'),fs.readFile(secretsFile,'utf8'),fs.stat(secretsFile)]);
  assertPrivateMode(secretsStat,secretsFile);
  const instance=readJson(configText,configFile);const secrets=readJson(secretsText,secretsFile);
  assertIndependentConfig(instance);assertSecrets(secrets);
  const storageRel=String(instance.runtime?.storageFile||'data/state.json');
  if(path.isAbsolute(storageRel)||storageRel.split(/[\\/]/).includes('..'))throw new Error('storageFile 必须位于实例目录内');
  const dataFile=path.resolve(root,storageRel);
  if(!dataFile.startsWith(root+path.sep))throw new Error('storageFile 越界');
  return {root,instance,secrets,dataFile};
}

export async function createIndependentApp({dir='.ltp-instance',seed=false,secureCookieOverride=null,allowedHosts=[]}={}){
  const bundle=await loadInstanceBundle({dir});
  const secureCookie=typeof secureCookieOverride==='boolean'?secureCookieOverride:Boolean(bundle.instance.runtime?.secureCookie);
  const runtime=await createRuntime({
    dataFile:bundle.dataFile,
    seed,
    sessionSecret:bundle.secrets.sessionSecret,
    reviewToken:bundle.secrets.reviewToken,
    exportToken:bundle.secrets.exportToken,
    advisoryAgentToken:bundle.secrets.advisoryAgentToken,
    communityAgentToken:bundle.secrets.communityAgentToken,
    secureCookie,
    allowedHosts,
    instance:bundle.instance
  });
  const {server}=await createAppServer({runtime});
  return {server,runtime,bundle};
}

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);
    const key=arg.slice(2);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);out[key]=value;
  }
  return {dir:out.dir||'.ltp-instance',host:out.host||'',port:out.port===undefined?null:Number(out.port)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const args=parseArgs(process.argv.slice(2));const app=await createIndependentApp({dir:args.dir});
    const host=args.host||app.bundle.instance.runtime?.host||'127.0.0.1';
    const port=args.port??Number(app.bundle.instance.runtime?.port||8787);
    if(!/^(127\.0\.0\.1|localhost|::1)$/.test(host))throw new Error('P0 启动器只允许本机监听；公网部署需使用后续专用部署层');
    if(!Number.isInteger(port)||port<0||port>65535)throw new Error('端口无效');
    app.server.listen(port,host,()=>{
      const actual=app.server.address();const actualPort=typeof actual==='object'&&actual?actual.port:port;
      console.log(JSON.stringify({status:'RUNNING',instanceId:app.bundle.instance.id,instanceName:app.bundle.instance.name,mode:'independent',url:`http://${host.includes(':')?`[${host}]`:host}:${actualPort}`,storage:'local-file',sameOrigin:true,referenceProductionDependency:false}));
    });
  }catch(err){
    console.error(`INSTANCE_START_FAILED: ${err.message}`);process.exitCode=1;
  }
}
