import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const DEFAULTS={
  primaryOrigin:'https://workermanifestfellowship.dpdns.org',
  vercelOrigin:'https://workermanifestfellowship.vercel.app',
  workerOrigin:'https://labor-transparency-api.labor-transparency-public.workers.dev',
  pagesUrl:'https://hiddenfeng.github.io/labor-transparency-ai/'
};
const RETIRED_ORIGINS=[
  'https://labor-transparency-public.edgeone.cool',
  'https://labor-transparency-overseas.edgeone.dev'
];

function normalizeOrigin(value){return String(value||'').replace(/\/$/,'');}
function header(response,name){return response.headers.get(name)||'';}

export function validateSecurityHeaders(label,response,{csp=false}={}){
  assert.equal(header(response,'x-content-type-options').toLowerCase(),'nosniff',`${label}: x-content-type-options`);
  assert.equal(header(response,'x-frame-options').toUpperCase(),'DENY',`${label}: x-frame-options`);
  assert.equal(header(response,'referrer-policy').toLowerCase(),'no-referrer',`${label}: referrer-policy`);
  if(csp) assert.match(header(response,'content-security-policy'),/frame-ancestors\s+'none'/i,`${label}: CSP frame-ancestors`);
}

export function validateHtml(label,response,body,{security=true}={}){
  assert.equal(response.status,200,`${label}: HTTP status`);
  assert.match(header(response,'content-type'),/text\/html/i,`${label}: content-type`);
  assert.match(body,/劳动透明计划/,`${label}: product marker`);
  assert.match(body,/<title>[\s\S]*?<\/title>/i,`${label}: title marker`);
  if(security) validateSecurityHeaders(label,response,{csp:true});
}

export function validateHealth(label,response,data){
  assert.equal(response.status,200,`${label}: HTTP status`);
  assert.match(header(response,'content-type'),/application\/json/i,`${label}: content-type`);
  assert.equal(data.status,'ok',`${label}: status`);
  assert.equal(data.storage,'cloudflare-d1',`${label}: storage`);
  assert.equal(data.attachments,false,`${label}: attachments privacy boundary`);
  assert.equal(data.anonymousAdvisory,true,`${label}: advisory capability`);
  assert.match(String(data.version||''),/^0\.8\./,`${label}: backend version`);
  validateSecurityHeaders(label,response);
}

export function validateConfig(label,response,data){
  assert.equal(response.status,200,`${label}: HTTP status`);
  assert.match(header(response,'content-type'),/application\/json/i,`${label}: content-type`);
  assert.equal(data.mode,'CLOUDFLARE_WORKER_D1',`${label}: runtime mode`);
  assert.equal(data.cookieSecure,true,`${label}: secure cookie mode`);
  assert.equal(data.capabilities?.attachments,false,`${label}: attachments disabled`);
  assert.equal(data.capabilities?.privateSensitiveInfo,false,`${label}: private sensitive info disabled`);
  assert.equal(data.capabilities?.anonymousAdvisory,true,`${label}: anonymous advisory capability`);
  assert.ok(typeof data.csrfToken==='string'&&data.csrfToken.length>=32,`${label}: csrf token`);
  const cookie=header(response,'set-cookie');
  assert.match(cookie,/ltp_session=/i,`${label}: session cookie`);
  assert.match(cookie,/HttpOnly/i,`${label}: HttpOnly cookie`);
  assert.match(cookie,/Secure/i,`${label}: Secure cookie`);
  assert.match(cookie,/SameSite=Strict/i,`${label}: SameSite cookie`);
  validateSecurityHeaders(label,response);
}

async function request(label,url,options={}){
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(url,{redirect:'follow',...options,signal:controller.signal});
      clearTimeout(timer);
      return response;
    }catch(error){
      clearTimeout(timer);lastError=error;
      if(attempt<3) await new Promise(resolve=>setTimeout(resolve,500*attempt));
    }
  }
  throw new Error(`${label}: request failed after retries: ${lastError?.message||lastError}`);
}

async function getHtml(label,url,{security=true}={}){
  const response=await request(label,url);
  const body=await response.text();
  validateHtml(label,response,body,{security});
  console.log(`PASS ${label} http=${response.status} bytes=${Buffer.byteLength(body)}`);
}

async function getJson(label,url,validator){
  const response=await request(label,url);
  const text=await response.text();
  let data;
  try{data=JSON.parse(text);}catch{throw new Error(`${label}: invalid JSON body`);}
  validator(label,response,data);
  console.log(`PASS ${label} http=${response.status}`);
  return data;
}

async function checkOrigin(label,workerOrigin,origin,expected){
  const response=await request(label,`${workerOrigin}/api/health`,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-ltp-csrf'}});
  assert.equal(response.status,expected,`${label}: OPTIONS status`);
  if(expected===204){
    assert.equal(header(response,'access-control-allow-origin'),origin,`${label}: exact ACAO`);
    assert.equal(header(response,'access-control-allow-credentials'),'true',`${label}: credentials`);
  }else{
    assert.equal(header(response,'access-control-allow-origin'),'',`${label}: rejected origin must not receive ACAO`);
  }
  console.log(`PASS ${label} http=${response.status}`);
}

export async function runPublicSmoke(env=process.env){
  const primaryOrigin=normalizeOrigin(env.LTP_SMOKE_PRIMARY_ORIGIN||DEFAULTS.primaryOrigin);
  const vercelOrigin=normalizeOrigin(env.LTP_SMOKE_VERCEL_ORIGIN||DEFAULTS.vercelOrigin);
  const workerOrigin=normalizeOrigin(env.LTP_SMOKE_WORKER_ORIGIN||DEFAULTS.workerOrigin);
  const pagesUrl=env.LTP_SMOKE_PAGES_URL||DEFAULTS.pagesUrl;

  await getHtml('primary root',`${primaryOrigin}/`);
  const primaryHealth=await getJson('primary health',`${primaryOrigin}/api/health`,validateHealth);
  await getJson('primary config',`${primaryOrigin}/api/config`,validateConfig);

  await getHtml('vercel fallback root',`${vercelOrigin}/`);
  const vercelHealth=await getJson('vercel fallback health',`${vercelOrigin}/api/health`,validateHealth);
  await getJson('vercel fallback config',`${vercelOrigin}/api/config`,validateConfig);

  const workerHealth=await getJson('worker health',`${workerOrigin}/api/health`,validateHealth);
  await getJson('worker config',`${workerOrigin}/api/config`,validateConfig);

  assert.equal(primaryHealth.version,workerHealth.version,'primary rewrite backend version matches worker');
  assert.equal(vercelHealth.version,workerHealth.version,'vercel rewrite backend version matches worker');

  await checkOrigin('primary origin allowed',workerOrigin,primaryOrigin,204);
  await checkOrigin('vercel origin allowed',workerOrigin,vercelOrigin,204);
  await checkOrigin('unknown origin rejected',workerOrigin,'https://example.invalid',403);
  for(const origin of RETIRED_ORIGINS) await checkOrigin(`retired origin rejected ${origin}`,workerOrigin,origin,403);

  await getHtml('GitHub Pages read-only fallback',pagesUrl,{security:false});
  console.log('PUBLIC_SMOKE=PASS');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  runPublicSmoke().catch(error=>{console.error(`PUBLIC_SMOKE=FAIL ${error.stack||error}`);process.exitCode=1;});
}
