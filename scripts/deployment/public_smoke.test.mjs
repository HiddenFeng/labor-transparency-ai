import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHtml,validateHealth,validateConfig,validateSecurityHeaders} from './public_smoke.mjs';

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
  validateConfig('config',r,{mode:'CLOUDFLARE_WORKER_D1',cookieSecure:true,csrfToken:'x'.repeat(64),capabilities:{attachments:false,privateSensitiveInfo:false,anonymousAdvisory:true}});
  const insecure=response(200,{...security,'content-type':'application/json','set-cookie':'ltp_session=abc; Path=/'});
  assert.throws(()=>validateConfig('config',insecure,{mode:'CLOUDFLARE_WORKER_D1',cookieSecure:true,csrfToken:'x'.repeat(64),capabilities:{attachments:false,privateSensitiveInfo:false,anonymousAdvisory:true}}),/HttpOnly/);
});

test('security validator rejects framing regression',()=>{
  const bad=response(200,{...security,'x-frame-options':'SAMEORIGIN'});
  assert.throws(()=>validateSecurityHeaders('root',bad,{csp:true}),/x-frame-options/);
});
