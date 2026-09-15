import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'deploy/frontend/dist');
const forbidden=[/\/Users\//i,/[A-Za-z0-9._%+-]+@(?:gmail|qq|outlook|hotmail)\.com/i,/ADV-[A-Za-z0-9_-]{32}/,/LTP_(SESSION_SECRET|REVIEW_TOKEN|EXPORT_TOKEN|ADVISORY_AGENT_TOKEN|RESEARCH_AGENT_TOKEN)\s*=/i,/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/];
let bad=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else{const b=await fs.readFile(p);if(b.includes(0))continue;const s=b.toString('utf8');for(const re of forbidden)if(re.test(s))bad.push({file:path.relative(root,p),pattern:String(re)})}}}
await walk(root);if(bad.length){console.error(JSON.stringify({status:'FAIL',bad},null,2));process.exit(2)}console.log(JSON.stringify({status:'PASS',root,forbiddenMatches:0}));
