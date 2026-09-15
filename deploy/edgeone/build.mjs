import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const publicSrc=path.join(root,'sites-app/public');
const out=path.join(here,'dist');
const template=path.join(here,'proxy-template.mjs');
const upstream=String(process.env.LTP_EDGEONE_UPSTREAM||'').replace(/\/$/,'');
const deployment=String(process.env.LTP_DEPLOYMENT_LABEL||'edgeone-v0.8.1-rc2');

if(!upstream)throw new Error('LTP_EDGEONE_UPSTREAM is required');
const u=new URL(upstream);
if(u.protocol!=='https:'||u.username||u.password)throw new Error('LTP_EDGEONE_UPSTREAM must be a credential-free HTTPS origin');

await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
await fs.cp(publicSrc,out,{recursive:true});
await fs.writeFile(path.join(out,'runtime-config.js'),`globalThis.__LTP_CONFIG__=${JSON.stringify({apiBase:'',deployment})};\n`);

const proxy=(await fs.readFile(template,'utf8')).replace('__LTP_UPSTREAM_JSON__',JSON.stringify(upstream));
const fnDir=path.join(out,'edge-functions','api');
await fs.mkdir(fnDir,{recursive:true});
await fs.writeFile(path.join(fnDir,'[[default]].js'),proxy);

const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const config={
  name:'labor-transparency-public',
  headers:[{
    source:'/*',
    headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'no-referrer'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      {key:'Content-Security-Policy',value:csp},
      {key:'Cache-Control',value:'public, max-age=0, must-revalidate'}
    ]
  }]
};
await fs.writeFile(path.join(out,'edgeone.json'),JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({status:'BUILT',out,upstream,deployment,files:(await fs.readdir(out)).length}));
