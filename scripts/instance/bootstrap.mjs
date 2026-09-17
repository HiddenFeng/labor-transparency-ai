import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

function safeLabel(value,{field,min=2,max=160}={}){
  const text=String(value??'').trim();
  if(text.length<min||text.length>max)throw new Error(`${field||'字段'}长度无效`);
  if(/[\u0000-\u001f\u007f]/.test(text))throw new Error(`${field||'字段'}包含控制字符`);
  return text;
}
function safePublicUrl(value){
  const text=String(value||'').trim();if(!text)return '';
  let url;try{url=new URL(text)}catch{throw new Error('公开 URL 无效')}
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('公开 URL 仅接受无凭据 HTTPS 地址');
  return url.href.replace(/\/$/,'');
}
function randomToken(bytes=32){return crypto.randomBytes(bytes).toString('base64url');}
async function pathExists(target){try{await fs.lstat(target);return true}catch(err){if(err?.code==='ENOENT')return false;throw err}}

export async function bootstrapInstance({dir='.ltp-instance',name='劳动透明计划独立实例',operator='',publicUrl='',host='127.0.0.1',port=8787}={}){
  const target=path.resolve(dir);
  if(await pathExists(target))throw new Error(`实例目录已存在，拒绝覆盖：${target}`);
  const instanceName=safeLabel(name,{field:'实例名称',min:2,max:120});
  const operatorName=operator?safeLabel(operator,{field:'运营者名称',min:2,max:160}):'';
  const normalizedUrl=safePublicUrl(publicUrl);
  const normalizedHost=String(host||'127.0.0.1').trim();
  if(!/^(127\.0\.0\.1|localhost|::1)$/.test(normalizedHost))throw new Error('P0 bootstrap 默认只允许本机监听；公网监听需在后续部署层显式配置');
  const normalizedPort=Number(port);
  if(!Number.isInteger(normalizedPort)||normalizedPort<0||normalizedPort>65535)throw new Error('端口无效');

  await fs.mkdir(path.dirname(target),{recursive:true});
  const tmp=`${target}.tmp-${process.pid}-${crypto.randomBytes(5).toString('hex')}`;
  await fs.mkdir(tmp,{mode:0o700});
  try{
    const instanceId=`ltp_${crypto.randomBytes(12).toString('hex')}`;
    const createdAt=new Date().toISOString();
    const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
    const publicKeyValue=publicKey.export({type:'spki',format:'der'}).toString('base64');
    const privateKeyValue=privateKey.export({type:'pkcs8',format:'der'}).toString('base64');
    const instance={
      schemaVersion:1,
      id:instanceId,
      name:instanceName,
      mode:'independent',
      operator:operatorName,
      publicUrl:normalizedUrl,
      createdAt,
      publicKey:{algorithm:'Ed25519',encoding:'spki-der-base64',value:publicKeyValue},
      runtime:{host:normalizedHost,port:normalizedPort,sameOrigin:true,storage:'local-file',storageFile:'data/state.json',secureCookie:false,referenceProductionDependency:false},
      privacy:{attachments:false,privateSensitiveInfo:false,federateUsers:false,federatePrivateData:false}
    };
    const secrets={
      schemaVersion:1,
      generatedAt:createdAt,
      sessionSecret:crypto.randomBytes(32).toString('hex'),
      reviewToken:randomToken(),
      exportToken:randomToken(),
      advisoryAgentToken:randomToken(),
      communityAgentToken:randomToken(),
      signingPrivateKey:{algorithm:'Ed25519',encoding:'pkcs8-der-base64',value:privateKeyValue}
    };
    await fs.mkdir(path.join(tmp,'data'),{mode:0o700});
    await fs.writeFile(path.join(tmp,'instance.json'),JSON.stringify(instance,null,2)+'\n',{mode:0o644});
    await fs.writeFile(path.join(tmp,'secrets.json'),JSON.stringify(secrets,null,2)+'\n',{mode:0o600});
    await fs.chmod(path.join(tmp,'secrets.json'),0o600);
    await fs.rename(tmp,target);
    return {directory:target,instance,paths:{config:path.join(target,'instance.json'),secrets:path.join(target,'secrets.json'),data:path.join(target,'data','state.json')}};
  }catch(err){
    await fs.rm(tmp,{recursive:true,force:true});
    throw err;
  }
}

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);
    const key=arg.slice(2);const value=argv[++i];
    if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);
    out[key]=value;
  }
  return {dir:out.dir||'.ltp-instance',name:out.name||'劳动透明计划独立实例',operator:out.operator||'',publicUrl:out['public-url']||'',host:out.host||'127.0.0.1',port:out.port===undefined?8787:Number(out.port)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await bootstrapInstance(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({status:'BOOTSTRAPPED',directory:result.directory,instanceId:result.instance.id,instanceName:result.instance.name,mode:result.instance.mode,publicKey:result.instance.publicKey,storage:'data/state.json',referenceProductionDependency:false},null,2));
  }catch(err){
    console.error(`BOOTSTRAP_FAILED: ${err.message}`);
    process.exitCode=1;
  }
}
