import {pathToFileURL} from 'node:url';

export async function healthcheck({url='http://127.0.0.1:8787',expectedInstanceId=''}={}){
  let base;try{base=new URL(url)}catch{throw new Error('healthcheck URL 无效')}if(!['http:','https:'].includes(base.protocol))throw new Error('healthcheck URL 必须是 HTTP(S)');base.pathname='';base.search='';base.hash='';const root=base.href.replace(/\/$/,'');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);try{
    const [healthRes,configRes]=await Promise.all([fetch(`${root}/api/health`,{signal:controller.signal,redirect:'manual'}),fetch(`${root}/api/config`,{signal:controller.signal,redirect:'manual'})]);
    if(!healthRes.ok||!configRes.ok)throw new Error(`health/config HTTP ${healthRes.status}/${configRes.status}`);const health=await healthRes.json();const config=await configRes.json();if(health.status!=='ok'||health.storage!=='local-file-adapter')throw new Error('health contract 无效');if(config.mode!=='INDEPENDENT_LOCAL_INSTANCE'||config.instance?.mode!=='independent'||config.instance?.referenceProductionDependency!==false)throw new Error('independent instance config contract 无效');if(expectedInstanceId&&config.instance?.id!==expectedInstanceId)throw new Error('healthcheck instance ID 不匹配');if(config.capabilities?.attachments!==false||config.capabilities?.privateSensitiveInfo!==false)throw new Error('privacy capability contract 无效');if(healthRes.headers.get('x-frame-options')!=='DENY'||configRes.headers.get('x-content-type-options')!=='nosniff')throw new Error('security headers 缺失');return {status:'HEALTHCHECK_PASS',version:config.version,instanceId:config.instance.id,instanceName:config.instance.name,cookieSecure:config.cookieSecure};
  }finally{clearTimeout(timer)}
}
function parseArgs(argv){const out={url:'http://127.0.0.1:8787',expectedInstanceId:''};for(let i=0;i<argv.length;i++){const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--url')out.url=value;else if(arg==='--instance-id')out.expectedInstanceId=value;else throw new Error(`未知参数：${arg}`);}return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await healthcheck(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result));
  }catch(err){
    console.error(`HEALTHCHECK_FAILED: ${err.message}`);
    process.exitCode=1;
  }
}
