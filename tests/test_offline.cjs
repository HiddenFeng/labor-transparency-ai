// Logic-only checks. This is not DOM, rendering, or browser E2E verification.
const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const storage=new Map();const ctx=vm.createContext({window:{},document:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Intl,console});
vm.runInContext(fs.readFileSync('app/web/offline.js','utf8'),ctx);
const api=ctx.window.offlineApi;let passed=0;
function check(name,condition){assert.ok(condition,name);passed++;console.log('PASS '+name)}
(async()=>{
 const config=await api('/config');check('offline mode declares no research and no scheduler',config.network_research===false&&config.scheduler_installed===false);
 const seed=(await api('/companies'))[0];check('seed is clearly synthetic',seed.synthetic&&seed.name.includes('虚构'));
 await assert.rejects(api('/requests',{name:'示例',region:'演示',needs:['help'],consent:false}));check('consent required',true);
 const privateR=await api('/requests',{name:'私密示例（虚构）',region:'演示地区',needs:['help'],consent:true,public:false});
 check('private company absent from public directory',!(await api('/companies')).some(c=>c.id===privateR.company_id));
 check('private purpose visible in own receipts',(await api('/me')).requests[0].needs[0]==='help');
 const publicR=await api('/requests',{name:'公开示例（虚构）',region:'演示地区',needs:['company'],consent:true,public:true});
 const c=await api('/companies/'+publicR.company_id);check('zero dossier company exists immediately',c.snapshots.length===0);
 await assert.rejects(api('/companies/'+c.id+'/posts',{title:'测试',body:'合成讨论'}));check('forum closed independently',true);
 vm.runInContext('mem.forum=true',ctx);
 const post=await api('/companies/'+c.id+'/posts',{title:'测试',body:'合成讨论'});check('E0 without dossier or attachment',post.evidence==='E0'&&c.snapshots.length===0);
 await assert.rejects(api('/companies/'+privateR.company_id+'/posts',{title:'测试',body:'合成讨论'}));check('private space cannot publish discussion',true);
 await api('/posts/'+post.id+'/vote',{});await api('/posts/'+post.id+'/vote',{});check('repeat vote deduplicated',(await api('/companies/'+c.id+'/posts'))[0].votes===1);
 ctx.window.simulateCompany(c.id);let d=await api('/companies/'+c.id);check('partial snapshot seven sections with five populated',Object.keys(d.snapshots[0].packet.sections).length===7&&Object.values(d.snapshots[0].packet.sections).filter(s=>s.items.length).length===5);
 ctx.window.simulateCompany(c.id);check('simulated update not duplicated',(await api('/companies/'+c.id)).snapshots.length===1);
 await api('/features',{title:'需要更好的薪资口径',detail:'合成测试'});check('feature receipt preserved',(await api('/me')).features[0].title==='需要更好的薪资口径');
 check('local persistence adapter invoked',storage.get('ltp-prototype-v0.2').includes('需要更好的薪资口径'));
 console.log(JSON.stringify({passed,scope:'Node VM logic only; not browser validation'}));
})().catch(e=>{console.error(e);process.exitCode=1});
