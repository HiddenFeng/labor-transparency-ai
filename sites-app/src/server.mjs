import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  VERSION, addCompany, addContribution, updateContribution, withdrawContribution, setBallot,
  flagContribution, reviewContribution, approveExport, listContributions, showcase, productMarket, publicLabourSignalSummary, publicDataset,
  reviewQueue, createReceiptCode, hashReceiptCode, addAdvisoryCase, listOwnAdvisory, accessAdvisoryByReceipt,
  advisoryAgentQueue, addAdvisoryAdvice, runAdvisoryAgent, publicAdvisoryReports, withdrawAdvisoryCase,
  addCommunityFeedback, listOwnCommunityFeedback, communityAgentQueue, respondCommunityFeedback,
  addPublicAnnouncement, publicAnnouncements, recordAgentDailyRun, upsertOfficialReferences, upsertOfficialRelations, upsertOfficialEvents
} from './domain.mjs';
import {FileStore} from './storage.mjs';
import {publicFederatedEvidence} from './federation.mjs';
import {companyResearchCoverage,publicCompanyResearch,publicResearchStatus,publicResearchHealth} from './research-status.mjs';
import {publicCompanyDetail} from './company-dossier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname,'../public');
const COOKIE = 'ltp_sites_session';
const BODY_LIMIT = 96 * 1024;

function parseCookies(header=''){
  return Object.fromEntries(header.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{
    const i=x.indexOf('='); return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))];
  }));
}
function hmac(secret,text){ return crypto.createHmac('sha256',secret).update(text).digest('hex'); }
function safeEqual(a,b){
  const aa=Buffer.from(String(a||'')); const bb=Buffer.from(String(b||''));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function json(res,status,body,headers={}){
  const data=Buffer.from(JSON.stringify(body));
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,...headers});
  res.end(data);
}
function securityHeaders(){
  return {
    'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',
    'Cache-Control':'no-store','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  };
}
async function bodyJson(req){
  const parts=[]; let size=0;
  for await (const part of req){
    size += part.length; if (size > BODY_LIMIT) throw Object.assign(new Error('请求过大'),{status:413});
    parts.push(part);
  }
  if (!parts.length) return {};
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw Object.assign(new Error('请求JSON无效'),{status:400}); }
}
function authToken(req){
  const value=req.headers.authorization||'';
  return value.startsWith('Bearer ')?value.slice(7):'';
}
function sameOrigin(req){
  const origin=req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function requestHostname(req){
  try{return new URL(`http://${String(req.headers.host||'')}`).hostname.toLowerCase()}catch{return ''}
}
function publicCompanyList(state){
  const researchByCompany=new Map((state.companyResearch||[]).map(x=>[x.companyId,x]));
  return state.companies.map(company=>{
    const signals=publicLabourSignalSummary(state,company.id);
    const products=state.contributions.filter(x=>x.companyId===company.id&&x.kind==='product'&&x.public&&x.status!=='WITHDRAWN'&&x.status!=='REJECTED');
    return {id:company.id,name:company.name,region:company.region,website:company.website,synthetic:company.synthetic,
      positive:signals.community.positive,
      negative:signals.community.negative,
      participants:signals.community.participants,
      workerPerspective:signals.workerPerspective,
      research:publicCompanyResearch(researchByCompany.get(company.id)),
      products:products.map(x=>({id:x.id,title:x.title,evidence:x.evidence,status:x.status,description:x.description}))};
  });
}

function normalizeInstanceInfo(raw){
  if(!raw)return null;
  if(typeof raw!=='object'||Array.isArray(raw))throw new Error('实例配置无效');
  const id=String(raw.id||raw.instanceId||'').trim();
  const name=String(raw.name||raw.instanceName||'').trim();
  const mode=String(raw.mode||raw.instanceMode||'independent').trim();
  if(!/^[A-Za-z0-9._:-]{6,120}$/.test(id))throw new Error('实例 ID 无效');
  if(name.length<2||name.length>120)throw new Error('实例名称无效');
  if(mode!=='independent')throw new Error('当前独立启动器只接受 independent 实例');
  const operator=String(raw.operator||'').trim().slice(0,160);
  const publicUrl=String(raw.publicUrl||'').trim();
  if(publicUrl){
    let u;try{u=new URL(publicUrl)}catch{throw new Error('实例公开 URL 无效')}
    if(u.protocol!=='https:'||u.username||u.password)throw new Error('实例公开 URL 仅接受无凭据 HTTPS 地址');
  }
  const publicKey=raw.publicKey&&typeof raw.publicKey==='object'&&!Array.isArray(raw.publicKey)?{
    algorithm:String(raw.publicKey.algorithm||'').trim(),
    encoding:String(raw.publicKey.encoding||'').trim(),
    value:String(raw.publicKey.value||'').trim()
  }:null;
  if(publicKey&&(!/^[A-Za-z0-9_-]{2,32}$/.test(publicKey.algorithm)||publicKey.encoding!=='spki-der-base64'||!/^[A-Za-z0-9+/=]{40,500}$/.test(publicKey.value)))throw new Error('实例公钥配置无效');
  return {id,name,mode,operator,publicUrl,publicKey,referenceProductionDependency:false};
}

export async function createRuntime(options={}){
  const dataFile = options.dataFile || process.env.LTP_SITES_DATA || path.resolve(__dirname,'../.local/state.json');
  const seed = options.seed ?? process.env.LTP_SITES_SEED === 'true';
  const sessionSecret = options.sessionSecret || process.env.LTP_SITES_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  const reviewToken = options.reviewToken || process.env.LTP_SITES_REVIEW_TOKEN || '';
  const exportToken = options.exportToken || process.env.LTP_SITES_EXPORT_TOKEN || '';
  const advisoryAgentToken = options.advisoryAgentToken || process.env.LTP_SITES_ADVISORY_AGENT_TOKEN || '';
  const communityAgentToken = options.communityAgentToken || process.env.LTP_SITES_COMMUNITY_AGENT_TOKEN || '';
  const secureCookie = options.secureCookie ?? process.env.LTP_SITES_SECURE_COOKIE === 'true';
  const allowedHosts = Array.isArray(options.allowedHosts)?options.allowedHosts.map(x=>String(x||'').trim().toLowerCase()).filter(Boolean):[];
  const instance = normalizeInstanceInfo(options.instance||null);
  const store = options.store || await new FileStore(dataFile,{seed}).init();
  return {store,sessionSecret,reviewToken,exportToken,advisoryAgentToken,communityAgentToken,secureCookie,allowedHosts,instance};
}

export async function createAppServer(options={}){
  const runtime = options.runtime || await createRuntime(options);
  const server = http.createServer(async(req,res)=>{
    Object.entries(securityHeaders()).forEach(([k,v])=>res.setHeader(k,v));
    try {
      if(runtime.allowedHosts?.length&&!runtime.allowedHosts.includes(requestHostname(req)))return json(res,403,{error:'请求 Host 未获允许'});
      const url=new URL(req.url,`http://${req.headers.host||'127.0.0.1'}`);
      const cookies=parseCookies(req.headers.cookie||'');
      let session=cookies[COOKIE]; let fresh=false;
      if (!session || !/^[A-Za-z0-9_-]{40,80}$/.test(session)) { session=crypto.randomBytes(32).toString('base64url'); fresh=true; }
      const owner=hmac(runtime.sessionSecret,`owner:${session}`);
      const csrf=hmac(runtime.sessionSecret,`csrf:${session}`);
      if (fresh) res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(session)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${runtime.secureCookie?'; Secure':''}`);

      const trustedAdvisoryAgent = url.pathname.startsWith('/api/advisory-agent/') && runtime.advisoryAgentToken && safeEqual(authToken(req),runtime.advisoryAgentToken);
      const trustedCommunityAgent = url.pathname.startsWith('/api/community-agent/') && runtime.communityAgentToken && safeEqual(authToken(req),runtime.communityAgentToken);
      if (url.pathname.startsWith('/api/') && !['GET','HEAD'].includes(req.method) && !trustedAdvisoryAgent && !trustedCommunityAgent) {
        if (!sameOrigin(req)) return json(res,403,{error:'跨站请求未获允许'});
        if (!safeEqual(req.headers['x-ltp-csrf'],csrf)) {
          return json(res,403,{error:'请求校验失败，请刷新页面后重试'});
        }
      }

      if (req.method==='GET' && url.pathname==='/api/config') return json(res,200,{version:VERSION,mode:runtime.instance?'INDEPENDENT_LOCAL_INSTANCE':'SITES_READY_LOCAL',instance:runtime.instance,csrfToken:csrf,cookieSecure:runtime.secureCookie,capabilities:{companies:true,ballots:true,workerPerspectiveSignals:true,productMarket:true,contributions:true,brandContributions:true,officialReferences:true,officialRelations:true,officialEvents:true,communityFeedback:true,publicAnnouncements:true,review:true,publicData:true,federatedPublicEvidence:true,anonymousAdvisory:true,advisoryDailyReports:true,automaticCompanyResearch:false,scheduledCompanyResearch:false,attachments:false,privateSensitiveInfo:false},privacy:'匿名辅导与社区意见仅接收非敏感结构化内容；不接收真实姓名、私人联系方式、身份证明、健康/支付信息或敏感附件'});
      if (req.method==='GET' && url.pathname==='/api/health') return json(res,200,{status:'ok',version:VERSION,storage:'local-file-adapter',instance:runtime.instance?{id:runtime.instance.id,mode:runtime.instance.mode}:null,attachments:false,anonymousAdvisory:true});
      if (req.method==='GET' && url.pathname==='/api/companies') return json(res,200,{items:publicCompanyList(runtime.store.read())});
      if (req.method==='GET' && /^\/api\/companies\/[^/]+$/.test(url.pathname)) { const companyId=decodeURIComponent(url.pathname.split('/').at(-1)); const detail=publicCompanyDetail(runtime.store.read(),companyId); return detail?json(res,200,detail):json(res,404,{error:'公司空间不存在'}); }
      if (req.method==='GET' && url.pathname==='/api/research/coverage') return json(res,200,companyResearchCoverage());
      if (req.method==='GET' && url.pathname==='/api/research/status') return json(res,200,publicResearchStatus(runtime.store.read()));
      if (req.method==='GET' && url.pathname==='/api/announcements') return json(res,200,{items:publicAnnouncements(runtime.store.read(),Number(url.searchParams.get('limit')||30))});
      if (req.method==='GET' && url.pathname==='/api/community-feedback') return json(res,200,{items:listOwnCommunityFeedback(runtime.store.read(),owner)});
      if (req.method==='GET' && url.pathname==='/api/research/health') { const health=publicResearchHealth(runtime.store.read()); return json(res,200,{...health,status:'LOCAL_REFERENCE_MODE',runtime:{companyResearchQueue:false,scheduledFallback:false},selfHealing:{...health.selfHealing,queue:false,scheduledReenqueue:false}}); }
      if (req.method==='POST' && url.pathname==='/api/companies') {
        const input=await bodyJson(req); const out=await runtime.store.transaction(s=>addCompany(s,input,owner)); return json(res,200,out);
      }
      if (req.method==='POST' && url.pathname==='/api/community-feedback') { const input=await bodyJson(req); const item=await runtime.store.transaction(s=>addCommunityFeedback(s,input,owner)); return json(res,200,{item:{id:item.id,type:item.type,companyId:item.companyId,status:item.status,createdAt:item.createdAt}}); }
      const ballot=url.pathname.match(/^\/api\/companies\/([^/]+)\/ballot$/);
      if (req.method==='POST' && ballot) { const input=await bodyJson(req); const out=await runtime.store.transaction(s=>setBallot(s,ballot[1],owner,input.direction??null,input.signalType||'community')); return json(res,200,out); }
      if (req.method==='GET' && url.pathname==='/api/contributions') return json(res,200,{items:listContributions(runtime.store.read(),{owner,mine:url.searchParams.get('mine')==='1',companyId:url.searchParams.get('companyId')||''})});
      if (req.method==='POST' && url.pathname==='/api/contributions') { const input=await bodyJson(req); const out=await runtime.store.transaction(s=>addContribution(s,input,owner)); return json(res,200,{item:{...out,owner:undefined}}); }
      const contribution=url.pathname.match(/^\/api\/contributions\/([^/]+)$/);
      if (req.method==='PATCH' && contribution) { const input=await bodyJson(req); const out=await runtime.store.transaction(s=>updateContribution(s,contribution[1],input,owner)); return json(res,200,{item:{...out,owner:undefined}}); }
      const withdraw=url.pathname.match(/^\/api\/contributions\/([^/]+)\/withdraw$/);
      if (req.method==='POST' && withdraw) { const out=await runtime.store.transaction(s=>withdrawContribution(s,withdraw[1],owner)); return json(res,200,{id:out.id,status:out.status}); }
      const flag=url.pathname.match(/^\/api\/contributions\/([^/]+)\/flag$/);
      if (req.method==='POST' && flag) { const input=await bodyJson(req); const out=await runtime.store.transaction(s=>flagContribution(s,flag[1],owner,input.reason)); return json(res,200,{id:out.id,status:out.status}); }
      if (req.method==='GET' && url.pathname==='/api/showcase') return json(res,200,showcase(runtime.store.read(),url.searchParams.get('lane')||'community_positive'));
      if (req.method==='GET' && url.pathname==='/api/product-market') return json(res,200,productMarket(runtime.store.read(),url.searchParams.get('lane')||'all'));
      if (req.method==='GET' && url.pathname==='/api/federation/evidence') return json(res,200,publicFederatedEvidence(runtime.store.read(),{sourceInstanceId:url.searchParams.get('sourceInstanceId')||'',includeTombstones:url.searchParams.get('includeTombstones')!=='0'}));
      if (req.method==='GET' && url.pathname==='/api/public-data') return json(res,200,publicDataset(runtime.store.read()));
      if (req.method==='POST' && url.pathname==='/api/advisory') {
        const input=await bodyJson(req); const receiptCode=createReceiptCode(); const receiptHash=hashReceiptCode(receiptCode);
        const out=await runtime.store.transaction(s=>addAdvisoryCase(s,input,owner,receiptHash));
        return json(res,200,{receiptCode,status:out.status,createdAt:out.createdAt,message:'匿名辅导已记录。请自行保存回执码；平台数据库不保存明文回执码。'});
      }
      if (req.method==='GET' && url.pathname==='/api/advisory/mine') return json(res,200,{items:listOwnAdvisory(runtime.store.read(),owner)});
      const advisoryWithdraw=url.pathname.match(/^\/api\/advisory\/([^/]+)\/withdraw$/);
      if (req.method==='POST' && advisoryWithdraw) { const out=await runtime.store.transaction(s=>withdrawAdvisoryCase(s,advisoryWithdraw[1],owner)); return json(res,200,out); }
      if (req.method==='POST' && url.pathname==='/api/advisory/access') {
        const input=await bodyJson(req); const out=accessAdvisoryByReceipt(runtime.store.read(),hashReceiptCode(String(input.receiptCode||'')));
        return json(res,200,{item:out});
      }
      if (req.method==='GET' && url.pathname==='/api/advisory/reports') return json(res,200,{items:publicAdvisoryReports(runtime.store.read(),Number(url.searchParams.get('limit')||30))});
      if (req.method==='GET' && url.pathname==='/api/advisory-agent/queue') {
        if (!runtime.advisoryAgentToken || !safeEqual(authToken(req),runtime.advisoryAgentToken)) return json(res,403,{error:'需要匿名辅导 Agent 运营凭据'});
        return json(res,200,{items:advisoryAgentQueue(runtime.store.read())});
      }
      const advisoryAdvice=url.pathname.match(/^\/api\/advisory-agent\/cases\/([^/]+)\/advice$/);
      if (req.method==='POST' && advisoryAdvice) {
        if (!runtime.advisoryAgentToken || !safeEqual(authToken(req),runtime.advisoryAgentToken)) return json(res,403,{error:'需要匿名辅导 Agent 运营凭据'});
        const input=await bodyJson(req); const out=await runtime.store.transaction(s=>addAdvisoryAdvice(s,advisoryAdvice[1],input,'advisory-agent'));
        return json(res,200,{id:out.case.id,status:out.case.status,advisedAt:out.case.advisedAt});
      }
      if (req.method==='POST' && url.pathname==='/api/advisory-agent/run') {
        if (!runtime.advisoryAgentToken || !safeEqual(authToken(req),runtime.advisoryAgentToken)) return json(res,403,{error:'需要匿名辅导 Agent 运营凭据'});
        const input=await bodyJson(req); const out=await runtime.store.transaction(s=>runAdvisoryAgent(s,{day:input.day||'',timeZone:input.timeZone||'Asia/Shanghai',agent:'daily-advisory-agent'}));
        return json(res,200,{processedCount:out.processedCount,report:out.report});
      }
      if (req.method==='GET' && url.pathname==='/api/community-agent/queue') {
        if (!runtime.communityAgentToken || !safeEqual(authToken(req),runtime.communityAgentToken)) return json(res,403,{error:'需要社区运营 Agent 凭据'});
        return json(res,200,{items:communityAgentQueue(runtime.store.read())});
      }
      if (req.method==='GET' && url.pathname==='/api/community-agent/state') {
        if (!runtime.communityAgentToken || !safeEqual(authToken(req),runtime.communityAgentToken)) return json(res,403,{error:'需要社区运营 Agent 凭据'});
        const state=runtime.store.read();return json(res,200,{companies:state.companies.filter(x=>!x.synthetic).map(x=>({id:x.id,name:x.name,region:x.region,website:x.website||''})),pendingFeedback:communityAgentQueue(state),officialReferenceCount:state.officialReferences.length,officialRelationCount:state.officialRelations.length,officialEventCount:state.officialEvents.length,latestAnnouncements:publicAnnouncements(state,7),dailyRuns:state.agentDailyRuns.slice(-14)});
      }
      if (req.method==='POST' && url.pathname==='/api/community-agent/official-references') {
        if (!runtime.communityAgentToken || !safeEqual(authToken(req),runtime.communityAgentToken)) return json(res,403,{error:'需要社区运营 Agent 凭据'});
        const input=await bodyJson(req);const out=await runtime.store.transaction(s=>upsertOfficialReferences(s,input));return json(res,200,{savedCount:out.savedCount});
      }
      if (req.method==='POST' && url.pathname==='/api/community-agent/official-relations') {
        if (!runtime.communityAgentToken || !safeEqual(authToken(req),runtime.communityAgentToken)) return json(res,403,{error:'需要社区运营 Agent 凭据'});
        const input=await bodyJson(req);const out=await runtime.store.transaction(s=>upsertOfficialRelations(s,input));return json(res,200,{savedCount:out.savedCount});
      }
      if (req.method==='POST' && url.pathname==='/api/community-agent/official-events') {
        if (!runtime.communityAgentToken || !safeEqual(authToken(req),runtime.communityAgentToken)) return json(res,403,{error:'需要社区运营 Agent 凭据'});
        const input=await bodyJson(req);const out=await runtime.store.transaction(s=>upsertOfficialEvents(s,input));return json(res,200,{savedCount:out.savedCount});
      }
      const feedbackResponse=url.pathname.match(/^\/api\/community-agent\/feedback\/([^/]+)\/respond$/);
      if (req.method==='POST' && feedbackResponse) {
        if (!runtime.communityAgentToken || !safeEqual(authToken(req),runtime.communityAgentToken)) return json(res,403,{error:'需要社区运营 Agent 凭据'});
        const input=await bodyJson(req);const out=await runtime.store.transaction(s=>respondCommunityFeedback(s,feedbackResponse[1],input,'daily-community-agent'));return json(res,200,{id:out.id,feedbackId:out.feedbackId,decision:out.decision,createdAt:out.createdAt});
      }
      if (req.method==='POST' && url.pathname==='/api/community-agent/announcements') {
        if (!runtime.communityAgentToken || !safeEqual(authToken(req),runtime.communityAgentToken)) return json(res,403,{error:'需要社区运营 Agent 凭据'});
        const input=await bodyJson(req);const out=await runtime.store.transaction(s=>addPublicAnnouncement(s,input,'daily-community-agent'));return json(res,200,{id:out.id,day:out.day,updatedAt:out.updatedAt});
      }
      if (req.method==='POST' && url.pathname==='/api/community-agent/daily-run') {
        if (!runtime.communityAgentToken || !safeEqual(authToken(req),runtime.communityAgentToken)) return json(res,403,{error:'需要社区运营 Agent 凭据'});
        const input=await bodyJson(req);const out=await runtime.store.transaction(s=>recordAgentDailyRun(s,input,'daily-community-agent'));return json(res,200,{id:out.id,day:out.day,phase:out.phase,status:out.status,updatedAt:out.updatedAt});
      }
      if (req.method==='GET' && url.pathname==='/api/review-queue') {
        if (!runtime.reviewToken || !safeEqual(authToken(req),runtime.reviewToken)) return json(res,403,{error:'需要审核员凭据'});
        return json(res,200,{items:reviewQueue(runtime.store.read())});
      }
      const review=url.pathname.match(/^\/api\/contributions\/([^/]+)\/review$/);
      if (req.method==='POST' && review) {
        if (!runtime.reviewToken || !safeEqual(authToken(req),runtime.reviewToken)) return json(res,403,{error:'需要审核员凭据'});
        const input=await bodyJson(req); const out=await runtime.store.transaction(s=>reviewContribution(s,review[1],input)); return json(res,200,{id:out.item.id,status:out.item.status,evidence:out.item.evidence});
      }
      const approve=url.pathname.match(/^\/api\/contributions\/([^/]+)\/approve-export$/);
      if (req.method==='POST' && approve) {
        if (!runtime.exportToken || !safeEqual(authToken(req),runtime.exportToken)) return json(res,403,{error:'需要独立再分发复核凭据'});
        const input=await bodyJson(req); const out=await runtime.store.transaction(s=>approveExport(s,approve[1],input)); return json(res,200,{id:out.item.id,exportApproved:true});
      }

      if (req.method==='GET' || req.method==='HEAD') {
        const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/editorial-content.js':'editorial-content.js','/runtime-config.js':'runtime-config.js','/styles.css':'styles.css'};
        const file=files[url.pathname];
        if (file){
          const raw=await fs.readFile(path.join(PUBLIC_DIR,file));
          const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8';
          res.writeHead(200,{'Content-Type':type,'Content-Length':raw.length}); if(req.method==='HEAD')res.end(); else res.end(raw); return;
        }
      }
      return json(res,404,{error:'未找到接口或资源'});
    } catch(err){
      const status=err.status||(/只能|需要|缺少|未获允许/.test(err.message)?403:400);
      return json(res,status,{error:err.message||'请求失败'});
    }
  });
  return {server,runtime};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||8787);
  const host=process.env.HOST||'127.0.0.1';
  const {server}=await createAppServer();
  server.listen(port,host,()=>console.log(`LTP Sites-ready ${VERSION} listening on http://${host}:${port}`));
}
