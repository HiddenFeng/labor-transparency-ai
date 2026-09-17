import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const src=path.join(root,'sites-app/public');
const out=path.join(here,'dist');
const apiBase=String(process.env.LTP_PUBLIC_API_BASE||'').replace(/\/$/,'');
const proxyApiOrigin=String(process.env.LTP_PROXY_API_ORIGIN||'').replace(/\/$/,'');
const mode=String(process.env.LTP_DEPLOYMENT_LABEL||'independent-static');
const independentInstance=String(process.env.LTP_INDEPENDENT_INSTANCE||'false')==='true';
if(process.env.VERCEL && !apiBase && !proxyApiOrigin) throw new Error('Vercel build requires LTP_PUBLIC_API_BASE or LTP_PROXY_API_ORIGIN');
if(apiBase&&proxyApiOrigin) throw new Error('Choose direct API base or same-origin API proxy, not both');
if(independentInstance&&(apiBase||proxyApiOrigin)) throw new Error('Independent instance mode must use its own same-origin API; remote upstream API/proxy is forbidden');
if(apiBase){const u=new URL(apiBase);if(!['https:','http:'].includes(u.protocol))throw new Error('LTP_PUBLIC_API_BASE must be HTTP(S)');}
if(proxyApiOrigin){const u=new URL(proxyApiOrigin);if(!['https:','http:'].includes(u.protocol))throw new Error('LTP_PROXY_API_ORIGIN must be HTTP(S)');}
await fs.rm(out,{recursive:true,force:true});
await fs.cp(src,out,{recursive:true});
await fs.writeFile(path.join(out,'runtime-config.js'),`globalThis.__LTP_CONFIG__=${JSON.stringify({apiBase,deployment:mode,independentInstance})};\n`);
const connect=apiBase?new URL(apiBase).origin:"'self'";
const csp=`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ${connect}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
const headers=`/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: ${csp}\n  Cache-Control: public, max-age=0, must-revalidate\n`;
await fs.writeFile(path.join(out,'_headers'),headers);
const vercel={cleanUrls:false,headers:[{source:'/(.*)',headers:[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'no-referrer'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
  {key:'Content-Security-Policy',value:csp},
  {key:'Cache-Control',value:'public, max-age=0, must-revalidate'}
]}]};
if(proxyApiOrigin)vercel.rewrites=[{source:'/api/:path*',destination:`${proxyApiOrigin}/api/:path*`}];
await fs.writeFile(path.join(out,'vercel.json'),JSON.stringify(vercel,null,2)+'\n');
console.log(JSON.stringify({status:'BUILT',out,apiBase:apiBase||'(same-origin)',proxyApiOrigin:proxyApiOrigin||'',independentInstance,files:(await fs.readdir(out)).length}));
