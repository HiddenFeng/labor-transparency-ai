import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.env.PORT||8791);
const proxyOrigin=String(process.env.LTP_PROXY_API_ORIGIN||'').replace(/\/$/,'');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const hop=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade','host','content-length','content-encoding']);
async function proxy(req,res){
  const target=new URL(req.url,proxyOrigin);
  const headers={};for(const [k,v] of Object.entries(req.headers)){if(!hop.has(k.toLowerCase())&&v!==undefined)headers[k]=v;}
  const parts=[];for await(const part of req)parts.push(part);const body=parts.length?Buffer.concat(parts):undefined;
  const upstream=await fetch(target,{method:req.method,headers,body,redirect:'manual'});
  const out={};upstream.headers.forEach((v,k)=>{if(!hop.has(k.toLowerCase()))out[k]=v;});
  res.writeHead(upstream.status,out);res.end(Buffer.from(await upstream.arrayBuffer()));
}
http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://local');
  if(proxyOrigin&&u.pathname.startsWith('/api/'))return await proxy(req,res);
  let rel=u.pathname==='/'?'index.html':u.pathname.replace(/^\//,'');if(rel.includes('..'))throw new Error('bad path');const file=path.join(dir,rel);const raw=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(raw)
}catch(err){res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});res.end(proxyOrigin&&String(req.url).startsWith('/api/')?'Upstream unavailable':'Not found')}}).listen(port,'127.0.0.1',()=>console.log(`frontend http://127.0.0.1:${port}${proxyOrigin?` proxy->${proxyOrigin}`:''}`));
