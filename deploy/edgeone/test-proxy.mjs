import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const built=path.join(here,'dist','edge-functions','api','[[default]].js');
await fs.access(built);
const builtSource=await fs.readFile(built,'utf8');
const upstreamMatch=builtSource.match(/^const UPSTREAM=(.+);$/m);
assert.ok(upstreamMatch,'built proxy must embed an upstream origin');
const expectedUpstream=JSON.parse(upstreamMatch[1]);
const handler=(await import(pathToFileURL(built).href+'?t='+Date.now())).default;
const originalFetch=globalThis.fetch;
let seen=null;
globalThis.fetch=async (url,init)=>{
  seen={url:String(url),method:init.method,headers:Object.fromEntries(init.headers),body:init.body?new TextDecoder().decode(init.body):''};
  return new Response(JSON.stringify({status:'ok',version:'test'}),{status:200,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':'999',
    'Content-Encoding':'gzip',
    'Connection':'keep-alive',
    'Set-Cookie':'ltp_session=test; HttpOnly; Secure'
  }});
};
try{
  const request=new Request('https://front.example/api/health?x=1',{method:'POST',headers:{'content-type':'application/json','content-length':'7','origin':'https://front.example'},body:'{"a":1}'});
  const response=await handler({request});
  assert.equal(response.status,200);
  assert.equal(await response.text(),'{"status":"ok","version":"test"}');
  assert.equal(response.headers.get('content-length'),null);
  assert.equal(response.headers.get('content-encoding'),null);
  assert.equal(response.headers.get('connection'),null);
  assert.equal(response.headers.get('x-ltp-edgeone-proxy'),'v1');
  assert.match(response.headers.get('set-cookie')||'',/HttpOnly/);
  assert.equal(seen.url,new URL('/api/health?x=1',expectedUpstream).href);
  assert.equal(seen.method,'POST');
  assert.equal(seen.headers.host,undefined);
  assert.equal(seen.headers['content-length'],undefined);
  assert.equal(seen.headers['x-ltp-edgeone-proxy'],'v1');
  assert.equal(seen.body,'{"a":1}');

  const huge=new Request('https://front.example/api/test',{method:'POST',body:'x'.repeat(96*1024+1)});
  const blocked=await handler({request:huge});
  assert.equal(blocked.status,413);
  assert.match(await blocked.text(),/请求过大/);

  const missing=await handler({request:new Request('https://front.example/not-api')});
  assert.equal(missing.status,404);
  console.log(JSON.stringify({status:'PASS',bufferedResponse:true,hopHeadersStripped:true,cookiePreserved:true,bodyLimit:true,pathGate:true}));
} finally {
  globalThis.fetch=originalFetch;
}
