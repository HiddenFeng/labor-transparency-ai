/* Source/UI contract and node-render tests, not a browser layout test. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),fixture=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const stub={addEventListener(){},querySelector(){return null},setAttribute(){},classList:{toggle(){return false}}};
const box={console,URL,URLSearchParams,crypto:require('crypto').webcrypto,setTimeout,clearTimeout,location:{hash:'#research'},document:{querySelector(){return stub},addEventListener(){}},window:{addEventListener(){}},fetch:async(url)=>{const k=String(url).replace('/api','');if(!(k in fixture))throw Error('fixture missing '+k);return {ok:true,json:async()=>structuredClone(fixture[k])};}};
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(root,'app/web/research.js'),'utf8'),box);
vm.runInContext(fs.readFileSync(path.join(root,'app/web/app.js'),'utf8').replace("window.addEventListener('hashchange',render);render();",''),box);
vm.runInContext('config='+JSON.stringify({...fixture['/config'],public_research_mode:true}),box);
let n=0;const check=(name,ok)=>{assert(ok,name);n++;console.log('PASS',name);};
(async()=>{
 check('operator login required',(await vm.runInContext('researchPage()',box)).includes('本地管理凭据'));
 vm.runInContext("adminToken='fixture';",box);
 fixture['/admin/research']={network_enabled:false,source:'GLEIF参考信息',tasks:[],scheduler:{active:false,worker:null,overdue:0,reserved_requests_today:0,source_pause_until:null}};
 let h=await vm.runInContext('researchPage()',box);check('empty queue',h.includes('目前没有真实'));check('disabled network button',h.includes('disabled'));check('no false schedule claim',h.includes('当前没有活跃调度心跳'));check('queue health visible',h.includes('队列健康'));
 fixture['/admin/research'].scheduler={active:true,worker:{heartbeat_at:'2026-09-14T00:00:00Z',mode:'NETWORK'},overdue:2,reserved_requests_today:12,source_pause_until:null};h=await vm.runInContext('researchPage()',box);check('active scheduler heartbeat visible',h.includes('调度器最近心跳'));check('overdue count visible',h.includes('<strong>2</strong>'));
 let reg=await vm.runInContext('registerPage()',box);check('opt in real company',reg.includes('name="real_company"'));check('privacy notice',reg.includes('不提交真实申诉'));
 const task={job_id:'j',company_id:'co',name:'<script>bad()</script>',state:'DRAFT_READY',batch_day:'2026-09-14',due_at:'2026-09-15T00:00:00Z',run:{id:'run',mode:'INJECTED_TEST_TRANSPORT',packet_hash:'a'.repeat(64),packet:{hello:'<script>bad()</script>'}}};box.task=task;
 h=vm.runInContext('researchTask(task)',box);check('frozen digest',h.includes('data-hash="'+'a'.repeat(64)));check('escaped names',!h.includes('<script>bad'));check('all review checks',(h.match(/type="checkbox"/g)||[]).length===5);check('mock mode visible',h.includes('INJECTED_TEST_TRANSPORT'));
 task.state='NEEDS_IDENTITY';task.run.candidates=[{lei:'X',name:'Candidate',country:'GB'}];h=vm.runInContext('researchTask(task)',box);check('candidate UI',h.includes('确认主体'));check('candidate enum',h.includes('Candidate · GB'));
 task.state='FAILED_FINAL';h=vm.runInContext('researchTask(task)',box);check('manual recovery',h.includes('重新排队'));
 box.progress={state:'RETRY_WAIT',label:'暂时不可用',target_at:'2026-09-15T00:00:00Z',overdue:true,note:'仍保留任务'};
 h=vm.runInContext('researchProgress(progress)',box);check('overdue visible',h.includes('已超过目标'));check('no retries leaked to public',!h.includes('lease_token'));
 const js=fs.readFileSync(path.join(root,'app/web/app.js'),'utf8');check('research route wired',js.includes("case'research'"));check('real registration binding',js.includes("synthetic:!data.has('real_company')"));
 check('research script linked',fs.readFileSync(path.join(root,'app/web/index.html'),'utf8').includes('/assets/research.js'));
 console.log(JSON.stringify({passed:n,scope:'Node UI contracts only, not browser'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
