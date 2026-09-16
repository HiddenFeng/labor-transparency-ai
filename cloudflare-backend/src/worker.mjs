import crypto from 'node:crypto';
import {
  VERSION as DOMAIN_VERSION, addCompany, addContribution, updateContribution, withdrawContribution, setBallot,
  flagContribution, reviewContribution, approveExport, listContributions, showcase, publicDataset,
  reviewQueue, createReceiptCode, hashReceiptCode, addAdvisoryCase, listOwnAdvisory, accessAdvisoryByReceipt,
  advisoryAgentQueue, addAdvisoryAdvice, runAdvisoryAgent, publicAdvisoryReports, withdrawAdvisoryCase
} from '../../sites-app/src/domain.mjs';
import {companyResearchCoverage,publicCompanyResearch,publicResearchStatus} from '../../sites-app/src/research-status.mjs';
import {D1StateStore} from './d1-store.mjs';
import {collectCompanyResearch,selectResearchCompanies,mergeCompanyResearch,queueCompanyResearch,markCompanyResearchStarted,markCompanyResearchFailed} from './company-research.mjs';

const BACKEND_VERSION='0.8.1-rc.2';
const COOKIE='ltp_session';
const BODY_LIMIT=96*1024;

function parseCookies(header=''){
  return Object.fromEntries(String(header).split(';').map(x=>x.trim()).filter(Boolean).map(x=>{
    const i=x.indexOf('=');
    try{return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))];}
    catch{return i<0?[x,'']:[x.slice(0,i),x.slice(i+1)];}
  }));
}
function hmac(secret,text){return crypto.createHmac('sha256',secret).update(text).digest('hex');}
function safeEqual(a,b){
  const aa=Buffer.from(String(a||''));const bb=Buffer.from(String(b||''));
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
function authToken(request){const value=request.headers.get('authorization')||'';return value.startsWith('Bearer ')?value.slice(7):'';}
function allowedOrigins(env){return new Set(String(env.LTP_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean));}
function requestOrigin(request){return request.headers.get('origin')||'';}
function isAllowedOrigin(request,env){const origin=requestOrigin(request);return Boolean(origin&&allowedOrigins(env).has(origin));}
function securityHeaders(){return {
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Cache-Control':'no-store',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Resource-Policy':'same-site'
};}
function corsHeaders(request,env){
  const origin=requestOrigin(request);
  if(!origin||!allowedOrigins(env).has(origin))return {};
  return {
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Credentials':'true',
    'Access-Control-Allow-Methods':'GET,HEAD,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, X-LTP-CSRF, Authorization',
    'Access-Control-Max-Age':'600',
    'Vary':'Origin'
  };
}
function headersFor(request,env,extra={}){return {...securityHeaders(),...corsHeaders(request,env),...extra};}
function json(request,env,status,body,extra={}){
  return new Response(JSON.stringify(body),{status,headers:headersFor(request,env,{'Content-Type':'application/json; charset=utf-8',...extra})});
}
function empty(request,env,status=204,extra={}){return new Response(null,{status,headers:headersFor(request,env,extra)});}
async function bodyJson(request){
  const length=Number(request.headers.get('content-length')||0);
  if(length>BODY_LIMIT)throw Object.assign(new Error('请求过大'),{status:413});
  const raw=new Uint8Array(await request.arrayBuffer());
  if(raw.byteLength>BODY_LIMIT)throw Object.assign(new Error('请求过大'),{status:413});
  if(!raw.byteLength)return {};
  try{return JSON.parse(new TextDecoder().decode(raw));}
  catch{throw Object.assign(new Error('请求JSON无效'),{status:400});}
}
function publicCompanyList(state){
  const researchByCompany=new Map((state.companyResearch||[]).map(x=>[x.companyId,x]));
  return state.companies.map(company=>{
    const ballots=state.ballots.filter(x=>x.companyId===company.id);
    const products=state.contributions.filter(x=>x.companyId===company.id&&x.kind==='product'&&x.public&&x.status!=='WITHDRAWN'&&x.status!=='REJECTED');
    const research=researchByCompany.get(company.id);
    return {id:company.id,name:company.name,region:company.region,website:company.website,synthetic:company.synthetic,
      positive:ballots.filter(x=>x.direction==='positive').length,
      negative:ballots.filter(x=>x.direction==='negative').length,
      participants:ballots.length,
      research:publicCompanyResearch(research),
      products:products.map(x=>({id:x.id,title:x.title,evidence:x.evidence,status:x.status,description:x.description}))};
  });
}
function requireSecrets(env){
  if(!env.LTP_SESSION_SECRET||String(env.LTP_SESSION_SECRET).length<32)throw Object.assign(new Error('服务端会话密钥未配置'),{status:503});
}
function cookieValue(session,env){
  const secure=String(env.LTP_COOKIE_SECURE||'true')!=='false';
  return `${COOKIE}=${encodeURIComponent(session)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure?'; Secure':''}`;
}
function makeSessionContext(request,env){
  requireSecrets(env);
  const cookies=parseCookies(request.headers.get('cookie')||'');
  let session=cookies[COOKIE];let fresh=false;
  if(!session||!/^[A-Za-z0-9_-]{40,80}$/.test(session)){session=crypto.randomBytes(32).toString('base64url');fresh=true;}
  return {session,fresh,owner:hmac(env.LTP_SESSION_SECRET,`owner:${session}`),csrf:hmac(env.LTP_SESSION_SECRET,`csrf:${session}`)};
}
function responseWithSession(response,ctx,env){
  if(!ctx.fresh)return response;
  const h=new Headers(response.headers);h.append('Set-Cookie',cookieValue(ctx.session,env));
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
function trustedAdvisoryAgent(request,url,env){return url.pathname.startsWith('/api/advisory-agent/')&&env.LTP_ADVISORY_AGENT_TOKEN&&safeEqual(authToken(request),env.LTP_ADVISORY_AGENT_TOKEN);}
function trustedResearchAgent(request,url,env){return url.pathname.startsWith('/api/research-agent/')&&env.LTP_RESEARCH_AGENT_TOKEN&&safeEqual(authToken(request),env.LTP_RESEARCH_AGENT_TOKEN);}
function mutationAuthorized(request,url,env,ctx){
  if(['GET','HEAD','OPTIONS'].includes(request.method))return true;
  if(trustedAdvisoryAgent(request,url,env)||trustedResearchAgent(request,url,env))return true;
  if(!isAllowedOrigin(request,env))return false;
  return safeEqual(request.headers.get('x-ltp-csrf'),ctx.csrf);
}
function storeFor(env){return new D1StateStore(env.DB,{seed:String(env.LTP_SEED||'false')==='true'});}
function researchQueueEnabled(env){return Boolean(env?.COMPANY_RESEARCH_QUEUE)&&String(env.LTP_RESEARCH_QUEUE_DISPATCH||'true')!=='false';}

export async function createCompanyWithAutoResearch(store,input,owner,{now=new Date()}={}){
  return store.transaction(state=>{
    const out=addCompany(state,input,owner);
    const queued=queueCompanyResearch(state,out.company,{now});
    return {...out,researchQueued:queued.queued,research:publicCompanyResearch(queued.record)};
  });
}

export async function dispatchCompanyResearch(env,result,{reason='USER_CREATE',allowRefresh=false}={}){
  const research=result?.research;
  if(!researchQueueEnabled(env)||!result?.company?.id||!research)return 'QUEUE_UNAVAILABLE';
  const dispatchable=['QUEUED','COLLECTION_FAILED'].includes(research.status)||(allowRefresh&&['REVIEW_REQUIRED','REVIEW_REQUIRED_WITH_SOURCE_GAPS'].includes(research.status));
  if(!dispatchable)return 'NOT_DISPATCHED';
  try{
    await env.COMPANY_RESEARCH_QUEUE.send({type:'COMPANY_RESEARCH',companyId:result.company.id,reason,allowRefresh,enqueuedAt:new Date().toISOString()});
    return 'QUEUE_SENT';
  }catch{
    console.error(JSON.stringify({event:'company_research_queue_send_failed',companyId:result.company.id,reason}));
    return 'QUEUE_SEND_FAILED';
  }
}

export async function enqueueEligibleResearch(store,env,{maxCompanies,now=new Date(),reason='SCHEDULED_FALLBACK'}={}){
  if(!researchQueueEnabled(env))return {eligibleCompanies:0,enqueuedCompanies:0,companyIds:[],status:'QUEUE_UNAVAILABLE'};
  const before=await store.read();
  const max=Math.max(1,Math.min(10,Number(maxCompanies||env.LTP_RESEARCH_MAX_COMPANIES_PER_RUN||2)));
  const companies=selectResearchCompanies(before,max,{now});
  if(!companies.length)return {eligibleCompanies:0,enqueuedCompanies:0,companyIds:[],status:'NO_ELIGIBLE_COMPANIES'};
  const messages=companies.map(company=>({body:{type:'COMPANY_RESEARCH',companyId:company.id,reason,allowRefresh:true,enqueuedAt:now.toISOString()}}));
  try{
    await env.COMPANY_RESEARCH_QUEUE.sendBatch(messages);
    return {eligibleCompanies:companies.length,enqueuedCompanies:companies.length,companyIds:companies.map(x=>x.id),status:'QUEUE_SENT'};
  }catch{
    console.error(JSON.stringify({event:'company_research_queue_batch_send_failed',eligibleCompanies:companies.length,reason}));
    return {eligibleCompanies:companies.length,enqueuedCompanies:0,companyIds:[],status:'QUEUE_SEND_FAILED'};
  }
}

export async function runResearchForCompany(store,companyId,{fetchImpl=fetch,now=new Date(),allowRefresh=false}={}){
  const claim=await store.transaction(state=>{
    const company=(state.companies||[]).find(x=>x.id===companyId&&!x.synthetic);
    if(!company)return {started:false,reason:'COMPANY_NOT_FOUND'};
    const lifecycle=markCompanyResearchStarted(state,company,{now,allowRefresh});
    if(!lifecycle)return {started:false,reason:'NOT_ELIGIBLE_OR_ALREADY_COLLECTING'};
    return {started:true,company:structuredClone(company),queuedAt:lifecycle.queuedAt,startedAt:lifecycle.startedAt};
  });
  if(!claim.started)return {processed:false,companyId,reason:claim.reason};
  try{
    const record=await collectCompanyResearch(claim.company,{fetchImpl,now});
    record.queuedAt=claim.queuedAt;record.startedAt=claim.startedAt;
    await store.transaction(state=>mergeCompanyResearch(state,[record]));
    return {processed:true,companyId,candidateCount:record.candidateCount||0,sourceErrors:record.sourceErrorCount||0,status:record.status};
  }catch{
    await store.transaction(state=>markCompanyResearchFailed(state,companyId,{now,error:'COLLECTION_RUNTIME_FAILED'}));
    return {processed:false,companyId,failed:true,reason:'COLLECTION_RUNTIME_FAILED'};
  }
}

export async function runResearchBatch(store,env,{maxCompanies,fetchImpl=fetch,now=new Date()}={}){
  const before=await store.read();
  const max=Math.max(1,Math.min(10,Number(maxCompanies||env.LTP_RESEARCH_MAX_COMPANIES_PER_RUN||2)));
  const companies=selectResearchCompanies(before,max,{now});
  const results=[];
  for(const company of companies)results.push(await runResearchForCompany(store,company.id,{fetchImpl,now,allowRefresh:true}));
  return {
    attemptedCompanies:companies.length,
    processedCompanies:results.filter(x=>x.processed).length,
    failedCompanies:results.filter(x=>x.failed).length,
    companyIds:results.filter(x=>x.processed).map(x=>x.companyId),
    candidateCount:results.reduce((n,x)=>n+(x.candidateCount||0),0),
    sourceErrors:results.reduce((n,x)=>n+(x.sourceErrors||0),0)
  };
}

export async function consumeResearchQueueBatch(batch,env,{fetchImpl=fetch,now=new Date(),store:providedStore=null}={}){
  const store=providedStore||await storeFor(env).init();
  for(const message of batch.messages||[]){
    const body=message?.body;
    const companyId=String(body?.companyId||'');
    if(body?.type!=='COMPANY_RESEARCH'||!/^co_[a-f0-9]+$/i.test(companyId)){
      console.error(JSON.stringify({event:'company_research_queue_invalid_message'}));
      message.ack();
      continue;
    }
    const result=await runResearchForCompany(store,companyId,{fetchImpl,now,allowRefresh:body.allowRefresh===true});
    if(result.processed){
      console.log(JSON.stringify({event:'company_research_queue_complete',companyId,status:result.status,candidateCount:result.candidateCount,sourceErrors:result.sourceErrors,attempts:message.attempts||1}));
      message.ack();
    }else if(result.failed){
      const attempts=Math.max(1,Number(message.attempts||1));
      const delaySeconds=Math.min(900,30*(2**Math.min(attempts-1,4)));
      console.error(JSON.stringify({event:'company_research_queue_retry',companyId,attempts,delaySeconds}));
      message.retry({delaySeconds});
    }else{
      console.log(JSON.stringify({event:'company_research_queue_noop',companyId,reason:result.reason}));
      message.ack();
    }
  }
}

async function handleApi(request,env){
  const url=new URL(request.url);
  if(request.method==='OPTIONS'){
    if(!isAllowedOrigin(request,env))return empty(request,env,403);
    return empty(request,env,204);
  }
  const ctx=makeSessionContext(request,env);
  const store=await storeFor(env).init();
  if(!mutationAuthorized(request,url,env,ctx))return responseWithSession(json(request,env,403,{error:'跨站请求或请求校验未获允许'}),ctx,env);

  let response;
  if(request.method==='GET'&&url.pathname==='/api/config') response=json(request,env,200,{version:BACKEND_VERSION,domainVersion:DOMAIN_VERSION,mode:'CLOUDFLARE_WORKER_D1',csrfToken:ctx.csrf,cookieSecure:String(env.LTP_COOKIE_SECURE||'true')!=='false',capabilities:{companies:true,ballots:true,contributions:true,review:true,publicData:true,anonymousAdvisory:true,advisoryDailyReports:true,scheduledAdvisory:true,automaticCompanyResearch:researchQueueEnabled(env),companyResearchQueue:researchQueueEnabled(env),scheduledCompanyResearch:String(env.LTP_RESEARCH_SCHEDULED||'false')==='true',attachments:false,privateSensitiveInfo:false},privacy:'匿名辅导仅接收非敏感结构化问题；不接收真实姓名、私人联系方式、身份证明、健康/支付信息或敏感附件'});
  else if(request.method==='GET'&&url.pathname==='/api/health') response=json(request,env,200,{status:'ok',version:BACKEND_VERSION,storage:'cloudflare-d1',scheduledAdvisory:true,companyResearchQueue:researchQueueEnabled(env),scheduledCompanyResearch:String(env.LTP_RESEARCH_SCHEDULED||'false')==='true',attachments:false,anonymousAdvisory:true});
  else if(request.method==='GET'&&url.pathname==='/api/companies') response=json(request,env,200,{items:publicCompanyList(await store.read())});
  else if(request.method==='GET'&&url.pathname==='/api/research/coverage') response=json(request,env,200,companyResearchCoverage());
  else if(request.method==='GET'&&url.pathname==='/api/research/status') response=json(request,env,200,publicResearchStatus(await store.read()));
  else if(request.method==='POST'&&url.pathname==='/api/companies'){
    const input=await bodyJson(request);const out=await createCompanyWithAutoResearch(store,input,ctx.owner);
    const researchDispatch=await dispatchCompanyResearch(env,out,{reason:out.duplicate?'DUPLICATE_RETRY':'USER_CREATE'});
    response=json(request,env,200,{...out,researchDispatch});
  }
  else {
    const ballot=url.pathname.match(/^\/api\/companies\/([^/]+)\/ballot$/);
    const contribution=url.pathname.match(/^\/api\/contributions\/([^/]+)$/);
    const withdraw=url.pathname.match(/^\/api\/contributions\/([^/]+)\/withdraw$/);
    const flag=url.pathname.match(/^\/api\/contributions\/([^/]+)\/flag$/);
    const advisoryWithdraw=url.pathname.match(/^\/api\/advisory\/([^/]+)\/withdraw$/);
    const advisoryAdvice=url.pathname.match(/^\/api\/advisory-agent\/cases\/([^/]+)\/advice$/);
    const review=url.pathname.match(/^\/api\/contributions\/([^/]+)\/review$/);
    const approve=url.pathname.match(/^\/api\/contributions\/([^/]+)\/approve-export$/);
    if(request.method==='POST'&&ballot){const input=await bodyJson(request);response=json(request,env,200,await store.transaction(s=>setBallot(s,ballot[1],ctx.owner,input.direction??null)));}
    else if(request.method==='GET'&&url.pathname==='/api/contributions') response=json(request,env,200,{items:listContributions(await store.read(),{owner:ctx.owner,mine:url.searchParams.get('mine')==='1',companyId:url.searchParams.get('companyId')||''})});
    else if(request.method==='POST'&&url.pathname==='/api/contributions'){const input=await bodyJson(request);const out=await store.transaction(s=>addContribution(s,input,ctx.owner));const item={...out};delete item.owner;response=json(request,env,200,{item});}
    else if(request.method==='PATCH'&&contribution){const input=await bodyJson(request);const out=await store.transaction(s=>updateContribution(s,contribution[1],input,ctx.owner));const item={...out};delete item.owner;response=json(request,env,200,{item});}
    else if(request.method==='POST'&&withdraw){const out=await store.transaction(s=>withdrawContribution(s,withdraw[1],ctx.owner));response=json(request,env,200,{id:out.id,status:out.status});}
    else if(request.method==='POST'&&flag){const input=await bodyJson(request);const out=await store.transaction(s=>flagContribution(s,flag[1],ctx.owner,input.reason));response=json(request,env,200,{id:out.id,status:out.status});}
    else if(request.method==='GET'&&url.pathname==='/api/showcase') response=json(request,env,200,showcase(await store.read(),url.searchParams.get('lane')||'community_positive'));
    else if(request.method==='GET'&&url.pathname==='/api/public-data') response=json(request,env,200,publicDataset(await store.read()));
    else if(request.method==='POST'&&url.pathname==='/api/advisory'){
      const input=await bodyJson(request);const receiptCode=createReceiptCode();const receiptHash=hashReceiptCode(receiptCode);
      const out=await store.transaction(s=>addAdvisoryCase(s,input,ctx.owner,receiptHash));
      response=json(request,env,200,{receiptCode,status:out.status,createdAt:out.createdAt,message:'匿名辅导已记录。请自行保存回执码；平台数据库不保存明文回执码。'});
    }
    else if(request.method==='GET'&&url.pathname==='/api/advisory/mine') response=json(request,env,200,{items:listOwnAdvisory(await store.read(),ctx.owner)});
    else if(request.method==='POST'&&advisoryWithdraw){const out=await store.transaction(s=>withdrawAdvisoryCase(s,advisoryWithdraw[1],ctx.owner));response=json(request,env,200,out);}
    else if(request.method==='POST'&&url.pathname==='/api/advisory/access'){const input=await bodyJson(request);response=json(request,env,200,{item:accessAdvisoryByReceipt(await store.read(),hashReceiptCode(String(input.receiptCode||'')))});}
    else if(request.method==='GET'&&url.pathname==='/api/advisory/reports') response=json(request,env,200,{items:publicAdvisoryReports(await store.read(),Number(url.searchParams.get('limit')||30))});
    else if(request.method==='GET'&&url.pathname==='/api/advisory-agent/queue'){
      if(!env.LTP_ADVISORY_AGENT_TOKEN||!safeEqual(authToken(request),env.LTP_ADVISORY_AGENT_TOKEN))response=json(request,env,403,{error:'需要匿名辅导 Agent 运营凭据'});
      else response=json(request,env,200,{items:advisoryAgentQueue(await store.read())});
    }
    else if(request.method==='POST'&&advisoryAdvice){
      if(!env.LTP_ADVISORY_AGENT_TOKEN||!safeEqual(authToken(request),env.LTP_ADVISORY_AGENT_TOKEN))response=json(request,env,403,{error:'需要匿名辅导 Agent 运营凭据'});
      else {const input=await bodyJson(request);const out=await store.transaction(s=>addAdvisoryAdvice(s,advisoryAdvice[1],input,'advisory-agent'));response=json(request,env,200,{id:out.case.id,status:out.case.status,advisedAt:out.case.advisedAt});}
    }
    else if(request.method==='POST'&&url.pathname==='/api/advisory-agent/run'){
      if(!env.LTP_ADVISORY_AGENT_TOKEN||!safeEqual(authToken(request),env.LTP_ADVISORY_AGENT_TOKEN))response=json(request,env,403,{error:'需要匿名辅导 Agent 运营凭据'});
      else {const input=await bodyJson(request);const out=await store.transaction(s=>runAdvisoryAgent(s,{day:input.day||'',timeZone:input.timeZone||'Asia/Shanghai',agent:'daily-advisory-agent'}));response=json(request,env,200,{processedCount:out.processedCount,report:out.report});}
    }
    else if(request.method==='GET'&&url.pathname==='/api/research-agent/queue'){
      if(!env.LTP_RESEARCH_AGENT_TOKEN||!safeEqual(authToken(request),env.LTP_RESEARCH_AGENT_TOKEN))response=json(request,env,403,{error:'需要公司研究 Agent 运营凭据'});
      else {const state=await store.read();response=json(request,env,200,{items:state.companyResearch||[],status:publicResearchStatus(state)});}
    }
    else if(request.method==='POST'&&url.pathname==='/api/research-agent/run'){
      if(!env.LTP_RESEARCH_AGENT_TOKEN||!safeEqual(authToken(request),env.LTP_RESEARCH_AGENT_TOKEN))response=json(request,env,403,{error:'需要公司研究 Agent 运营凭据'});
      else {const input=await bodyJson(request);response=json(request,env,200,await runResearchBatch(store,env,{maxCompanies:input.maxCompanies}));}
    }
    else if(request.method==='GET'&&url.pathname==='/api/review-queue'){
      if(!env.LTP_REVIEW_TOKEN||!safeEqual(authToken(request),env.LTP_REVIEW_TOKEN))response=json(request,env,403,{error:'需要审核员凭据'});else response=json(request,env,200,{items:reviewQueue(await store.read())});
    }
    else if(request.method==='POST'&&review){
      if(!env.LTP_REVIEW_TOKEN||!safeEqual(authToken(request),env.LTP_REVIEW_TOKEN))response=json(request,env,403,{error:'需要审核员凭据'});
      else {const input=await bodyJson(request);const out=await store.transaction(s=>reviewContribution(s,review[1],input));response=json(request,env,200,{id:out.item.id,status:out.item.status,evidence:out.item.evidence});}
    }
    else if(request.method==='POST'&&approve){
      if(!env.LTP_EXPORT_TOKEN||!safeEqual(authToken(request),env.LTP_EXPORT_TOKEN))response=json(request,env,403,{error:'需要独立再分发复核凭据'});
      else {const input=await bodyJson(request);const out=await store.transaction(s=>approveExport(s,approve[1],input));response=json(request,env,200,{id:out.item.id,exportApproved:true});}
    }
    else response=json(request,env,404,{error:'未找到接口'});
  }
  return responseWithSession(response,ctx,env);
}

export default {
  async fetch(request,env){
    try{
      const url=new URL(request.url);
      if(!url.pathname.startsWith('/api/')) return json(request,env,404,{error:'仅提供 API 服务'});
      return await handleApi(request,env);
    }catch(err){
      const message=String(err?.message||'请求失败');
      const status=Number(err?.status)||(/只能|需要|缺少|未获允许/.test(message)?403:400);
      const safeStatus=status>=400&&status<=599?status:500;
      return json(request,env,safeStatus,{error:safeStatus>=500?'服务暂时不可用':message});
    }
  },
  async queue(batch,env,ctx){
    ctx.waitUntil(consumeResearchQueueBatch(batch,env));
  },
  async scheduled(controller,env,ctx){
    ctx.waitUntil((async()=>{
      try{
        const store=await storeFor(env).init();
        const cron=String(controller.cron||'');
        if(cron==='*/5 * * * *'){
          if(String(env.LTP_RESEARCH_SCHEDULED||'false')==='true'){
            const research=await enqueueEligibleResearch(store,env,{reason:'FIVE_MINUTE_FALLBACK'});
            console.log(JSON.stringify({event:'company_research_fallback_enqueue_complete',eligibleCompanies:research.eligibleCompanies,enqueuedCompanies:research.enqueuedCompanies,status:research.status}));
          }
          return;
        }
        const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(controller.scheduledTime));
        const out=await store.transaction(s=>runAdvisoryAgent(s,{day,timeZone:'Asia/Shanghai',agent:'cloudflare-daily-advisory-agent'}));
        console.log(JSON.stringify({event:'advisory_daily_complete',day,processedCount:out.processedCount,receivedCount:out.report.receivedCount,advisedCount:out.report.advisedCount,pendingCount:out.report.pendingCount}));
        if(String(env.LTP_RESEARCH_SCHEDULED||'false')==='true'){
          const research=await enqueueEligibleResearch(store,env,{reason:'DAILY_REFRESH_FALLBACK'});
          console.log(JSON.stringify({event:'company_research_daily_enqueue_complete',eligibleCompanies:research.eligibleCompanies,enqueuedCompanies:research.enqueuedCompanies,status:research.status}));
        }
      }catch(err){console.error(JSON.stringify({event:'scheduled_processing_failed',error:'scheduled_processing_failed'}));throw err;}
    })());
  }
};
