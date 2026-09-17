import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {bootstrapInstance} from './bootstrap.mjs';
import {preflightInstance} from './preflight.mjs';
import {createIndependentApp,loadInstanceBundle} from './start.mjs';

async function exists(file){try{await fs.stat(file);return true}catch(err){if(err?.code==='ENOENT')return false;throw err}}
function boolEnv(name,defaultValue){const raw=process.env[name];if(raw===undefined||raw==='')return defaultValue;if(raw==='true')return true;if(raw==='false')return false;throw new Error(`${name} 必须是 true/false`)}
function portEnv(){const port=Number(process.env.PORT||8787);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT 无效');return port;}
function hostAllowedForBind(host){return ['127.0.0.1','localhost','::1'].includes(host)||boolEnv('LTP_SELF_HOST_CONTAINER',false);}
function parseAllowedHosts(instance){
  const values=String(process.env.LTP_SELF_HOST_ALLOWED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);if(instance.publicUrl)values.push(new URL(instance.publicUrl).hostname.toLowerCase());values.push('127.0.0.1','localhost','::1');const unique=[...new Set(values)];for(const value of unique)if(value==='*'||value.includes('/')||value.includes(' '))throw new Error('LTP_SELF_HOST_ALLOWED_HOSTS 只接受精确 hostname，不接受 wildcard/CIDR');return unique;
}

export async function startSelfHostFromEnv(){
  const dir=path.resolve(process.env.LTP_INSTANCE_DIR||'/var/lib/ltp/instance');const instanceFile=path.join(dir,'instance.json');const port=portEnv();const host=String(process.env.HOST||'0.0.0.0').trim();if(!hostAllowedForBind(host))throw new Error('非回环监听仅允许专用 self-host container 模式');
  if(!await exists(instanceFile)){
    if(await exists(dir)){const entries=await fs.readdir(dir);if(entries.length)throw new Error('instance 目录已有内容但缺少 instance.json，拒绝自动覆盖');await fs.rmdir(dir);}
    const name=String(process.env.LTP_INSTANCE_NAME||'').trim();if(name.length<2)throw new Error('首次 self-host 启动必须设置 LTP_INSTANCE_NAME');
    await bootstrapInstance({dir,name,operator:String(process.env.LTP_INSTANCE_OPERATOR||''),publicUrl:String(process.env.LTP_INSTANCE_PUBLIC_URL||''),host:'127.0.0.1',port});
  }
  const bundle=await loadInstanceBundle({dir});const secureCookie=boolEnv('LTP_SELF_HOST_SECURE_COOKIE',true);const allowedHosts=parseAllowedHosts(bundle.instance);const app=await createIndependentApp({dir,secureCookieOverride:secureCookie,allowedHosts});await preflightInstance({dir});
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,host,resolve)});const address=app.server.address();const actualPort=typeof address==='object'&&address?address.port:port;
  const result={status:'SELF_HOST_RUNNING',instanceId:bundle.instance.id,instanceName:bundle.instance.name,host,port:actualPort,secureCookie,allowedHosts,referenceProductionDependency:false};console.log(JSON.stringify(result));
  let closing=false;const shutdown=signal=>{if(closing)return;closing=true;app.server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),5000).unref();console.error(JSON.stringify({event:'SELF_HOST_SHUTDOWN',signal,instanceId:bundle.instance.id}));};process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));return {...app,bundle,result};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{await startSelfHostFromEnv()}catch(err){console.error(`SELF_HOST_START_FAILED: ${err.message}`);process.exitCode=1;}}
