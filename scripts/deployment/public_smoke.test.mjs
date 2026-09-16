import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHtml,validateHealth,validateConfig,validateResearchHealth,validateSecurityHeaders} from './public_smoke.mjs';

function response(status=200,headers={}){return new Response('',{status,headers});}
const security={
  'content-type':'text/html; charset=utf-8',
  'x-content-type-options':'nosniff',
  'x-frame-options':'DENY',
  'referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'self'; frame-ancestors 'none'"
};

test('HTML validator requires product semantics and security headers',()=>{
  validateHtml('root',response(200,security),'<!doctype html><title>劳动透明计划</title><h1>劳动透明计划</h1>');
  assert.throws(()=>validateHtml('wrong',response(200,security),'<title>unrelated</title>'),/product marker/);
});

test('health validator pins Worker D1 privacy contract',()=>{
  const r=response(200,{...security,'content-type':'application/json'});
  validateHealth('health',r,{status:'ok',version:'0.8.0-rc.1',storage:'cloudflare-d1',attachments:false,anonymousAdvisory:true});
  assert.throws(()=>validateHealth('health',r,{status:'ok',version:'0.8.0-rc.1',storage:'memory',attachments:false,anonymousAdvisory:true}),/storage/);
});

test('config validator requires secure session and disabled sensitive-data capability',()=>{
  const r=response(200,{...security,'content-type':'application/json','set-cookie':'ltp_session=abc; HttpOnly; Secure; SameSite=Strict; Path=/'});
  const capabilities={attachments:false,privateSensitiveInfo:false,anonymousAdvisory:true,automaticCompanyResearch:true,unattendedCompanyIntelligence:true,companyResearchQueue:true};
  validateConfig('config',r,{mode:'CLOUDFLARE_WORKER_D1',cookieSecure:true,csrfToken:'x'.repeat(64),capabilities});
  const insecure=response(200,{...security,'content-type':'application/json','set-cookie':'ltp_session=abc; Path=/'});
  assert.throws(()=>validateConfig('config',insecure,{mode:'CLOUDFLARE_WORKER_D1',cookieSecure:true,csrfToken:'x'.repeat(64),capabilities}),/HttpOnly/);
});

test('research health validator requires autonomous runtime and no named operator dependency',()=>{
  const r=response(200,{...security,'content-type':'application/json'});
  validateResearchHealth('research-health',r,{status:'DEGRADED_SOURCE_COVERAGE',unattendedOperation:true,missingResearch:0,staleQueued:0,staleCollecting:0,retryEligibleFailures:0,runtime:{companyResearchQueue:true,scheduledFallback:true},selfHealing:{manualOperatorRequired:false}});
  assert.throws(()=>validateResearchHealth('research-health',r,{status:'HEALTHY',unattendedOperation:true,missingResearch:0,staleQueued:0,staleCollecting:0,retryEligibleFailures:0,runtime:{companyResearchQueue:false,scheduledFallback:true},selfHealing:{manualOperatorRequired:false}}),/queue configured/);
});

test('security validator rejects framing regression',()=>{
  const bad=response(200,{...security,'x-frame-options':'SAMEORIGIN'});
  assert.throws(()=>validateSecurityHeaders('root',bad,{csp:true}),/x-frame-options/);
});
