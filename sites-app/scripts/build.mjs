import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');const out=path.join(root,'dist');
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
for(const dir of ['src','public']) await fs.cp(path.join(root,dir),path.join(out,dir),{recursive:true});
await fs.mkdir(path.join(out,'scripts'),{recursive:true});await fs.copyFile(path.join(root,'scripts/advisory-agent.mjs'),path.join(out,'scripts/advisory-agent.mjs'));
for(const file of ['package.json','README.md','DEPLOYMENT_HANDOFF.md']) await fs.copyFile(path.join(root,file),path.join(out,file));
const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else files.push(p)}}await walk(out);
const manifest={version:'0.8.5-rc.1',generatedAt:new Date().toISOString(),files:{}};for(const p of files.sort()){const rel=path.relative(out,p);manifest.files[rel]=crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex')}
await fs.writeFile(path.join(out,'BUILD_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:'BUILT',directory:out,files:Object.keys(manifest.files).length+1,version:manifest.version}));
