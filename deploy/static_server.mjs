// Read-only artifact server. It cannot access application databases or private uploads.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(process.env.SITE_DIR||'public-site'),port=Number(process.env.PORT||8080),host=process.env.HOST||'127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8'};
const top=new Set(['index.html','whitepaper.html','styles.css','site.js','LICENSE.txt','LICENSE-DATA.md','CONTRIBUTING.md']);
const data=new Set(['dataset.json','manifest.json','changes.json','contributions.json','README.txt',...['product','company_fact','relationship','labour_claim','product_claim'].flatMap(k=>[k+'.json',k+'.csv'])]);
http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-cache');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end('Read-only');return;}
 try{let name=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\//,'')||'index.html';
 if(!(top.has(name)||(name.startsWith('data/')&&data.has(name.slice(5))))){res.writeHead(404);res.end('Not found');return;}
 const file=await fs.readFile(path.join(root,name));res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.writeHead(200);res.end(req.method==='HEAD'?undefined:file);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,host,()=>console.log('Read-only site server listening on '+host+':'+port));
