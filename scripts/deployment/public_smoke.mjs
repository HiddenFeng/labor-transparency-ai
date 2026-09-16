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
  assert.equal(data.capabilities?.automaticCompanyResearch,true,`${label}: automatic company research`);
  assert.equal(data.capabilities?.unattendedCompanyIntelligence,true,`${label}: unattended company intelligence`);
  assert.equal(data.capabilities?.companyResearchQueue,true,`${label}: company research queue`);
  assert.equal(data.capabilities?.communityFeedback,true,`${label}: community feedback`);
  assert.equal(data.capabilities?.officialReferences,true,`${label}: official reference layer`);
  assert.equal(data.capabilities?.officialRelations,true,`${label}: official relationship layer`);
  assert.equal(data.capabilities?.officialEvents,true,`${label}: official event layer`);
  assert.equal(data.capabilities?.publicAnnouncements,true,`${label}: public announcements`);
  assert.ok(typeof data.csrfToken==='string'&&data.csrfToken.length>=32,`${label}: csrf token`);
  const cookie=header(response,'set-cookie');
  assert.match(cookie,/ltp_session=/i,`${label}: session cookie`);
  assert.match(cookie,/HttpOnly/i,`${label}: HttpOnly cookie`);
  assert.match(cookie,/Secure/i,`${label}: Secure cookie`);
  assert.match(cookie,/SameSite=Strict/i,`${label}: SameSite cookie`);
  validateSecurityHeaders(label,response);
}

export function validateResearchHealth(label,response,data){
  assert.equal(response.status,200,`${label}: HTTP status`);
  assert.match(header(response,'content-type'),/application\/json/i,`${label}: content-type`);
  assert.equal(data.unattendedOperation,true,`${label}: unattended operation`);
  assert.equal(data.runtime?.companyResearchQueue,true,`${label}: queue configured`);
  assert.equal(data.runtime?.scheduledFallback,true,`${label}: scheduled fallback configured`);
  assert.equal(data.selfHealing?.manualOperatorRequired,false,`${label}: no named operator required`);
  assert.ok(['HEALTHY','DEGRADED_SOURCE_COVERAGE','RECOVERY_NEEDED'].includes(data.status),`${label}: health state`);
  assert.equal(Number(data.missingResearch||0),0,`${label}: no company missing research lifecycle`);
  assert.equal(Number(data.staleQueued||0),0,`${label}: no stale queued work`);
  assert.equal(Number(data.staleCollecting||0),0,`${label}: no stale collecting lease`);
  assert.equal(Number(data.failedRecords||0),0,`${label}: no failed research records`);
  assert.equal(Number(data.retryEligibleFailures||0),0,`${label}: no retry-due failures`);
  assert.equal(Number(data.missingCurrentPolicy||0),0,`${label}: no stale autonomous-policy records`);
  validateSecurityHeaders(label,response);
}

export function validateCompanyDetail(label,response,data){
  assert.equal(response.status,200,`${label}: HTTP status`);
  assert.match(header(response,'content-type'),/application\/json/i,`${label}: content-type`);
  assert.ok(data.company?.id&&data.company?.name,`${label}: public company identity container`);
  assert.ok(data.community&&Number.isInteger(data.community.positive)&&Number.isInteger(data.community.negative),`${label}: community counts`);
  assert.match(String(data.community?.boundary||''),/社区/,`${label}: community boundary`);
  assert.ok(data.research?.intelligence?.dossier,`${label}: autonomous dossier projection`);
  assert.equal(data.research.intelligence.policyVersion,'auto-intelligence-0.8.3',`${label}: current dossier policy`);
  assert.ok(['REFERENCE_READY','CONTEXT_READY','SIGNALS_READY','LIMITED_DATA'].includes(data.research.intelligence.dossier.status),`${label}: dossier status`);
  assert.ok(data.contributions&&Array.isArray(data.contributions.products)&&Array.isArray(data.contributions.labourClaims),`${label}: grouped public contributions`);
  assert.ok(Array.isArray(data.officialReferences),`${label}: official reference projection`);
  assert.ok(Array.isArray(data.officialRelations),`${label}: official relation projection`);
  assert.ok(Array.isArray(data.officialEvents),`${label}: official event projection`);
  if(/(^|[\s,，·/])(cn|china)($|[\s,，·/])|中国|中华人民共和国|中国大陆/i.test(String(data.company?.region||''))){
    assert.equal(data.chinaInvestigation?.jurisdiction,'CN',`${label}: China investigation projection`);
    assert.ok(Array.isArray(data.chinaInvestigation?.sourceCoverage),`${label}: China source coverage`);
    assert.ok(Array.isArray(data.chinaInvestigation?.gaps),`${label}: China investigation gaps`);
    assert.match(String(data.chinaInvestigation?.boundary||''),/不是信用评级/,`${label}: China analysis boundary`);
  }
  const raw=JSON.stringify(data);for(const forbidden of ['\"owner\"','\"receiptHash\"','\"rightsNote\"','\"records\"','\"sampleRecord\"'])assert.equal(raw.includes(forbidden),false,`${label}: forbidden public field ${forbidden}`);
  assert.match(String(data.boundary||''),/公司详情/,`${label}: dossier boundary`);
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
  const primaryResearchHealth=await getJson('primary research health',`${primaryOrigin}/api/research/health`,validateResearchHealth);
  const primaryCompanies=await getJson('primary companies',`${primaryOrigin}/api/companies`,(label,response,data)=>{assert.equal(response.status,200,`${label}: HTTP status`);assert.ok(Array.isArray(data.items),`${label}: items`);validateSecurityHeaders(label,response);});
  const realCompany=primaryCompanies.items.find(x=>!x.synthetic);
  if(realCompany) await getJson('primary company dossier',`${primaryOrigin}/api/companies/${encodeURIComponent(realCompany.id)}`,validateCompanyDetail);

  await getHtml('vercel fallback root',`${vercelOrigin}/`);
  const vercelHealth=await getJson('vercel fallback health',`${vercelOrigin}/api/health`,validateHealth);
  await getJson('vercel fallback config',`${vercelOrigin}/api/config`,validateConfig);

  const workerHealth=await getJson('worker health',`${workerOrigin}/api/health`,validateHealth);
  await getJson('worker config',`${workerOrigin}/api/config`,validateConfig);
  const workerResearchHealth=await getJson('worker research health',`${workerOrigin}/api/research/health`,validateResearchHealth);

  assert.equal(primaryHealth.version,workerHealth.version,'primary rewrite backend version matches worker');
  assert.equal(vercelHealth.version,workerHealth.version,'vercel rewrite backend version matches worker');
  assert.equal(primaryResearchHealth.policyVersion,workerResearchHealth.policyVersion,'primary rewrite autonomous policy matches worker');

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
