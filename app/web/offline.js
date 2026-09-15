'use strict';
window.LTP_OFFLINE=true;
const OFFLINE_KEY='ltp-prototype-v0.2';
const sid=p=>p+'_'+Math.random().toString(36).slice(2,12);
const NOW=()=>new Date().toISOString();
const sectionKeys=['identity','business','ownership','facilities','supply_chain','work_conditions','channels'];
let mem;
try {mem=JSON.parse(localStorage.getItem(OFFLINE_KEY)||'null');}catch(_){mem=null;}
if(!mem)mem={companies:[],requests:[],features:[],forum:false,posts:[],votes:[]};
function save(){try{localStorage.setItem(OFFLINE_KEY,JSON.stringify(mem));}catch(_){/* Private mode may disable storage; this preview is not a durability guarantee. */}}
function cohortNow(){
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'});
 const p=Object.fromEntries(fmt.formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 const day=`${p.year}-${p.month}-${p.day}`;
 const due=new Date(day+'T09:00:00+09:00');due.setUTCDate(due.getUTCDate()+1);
 return {day,due:due.toISOString()};
}
function previewPacket(c){
 const sections=Object.fromEntries(sectionKeys.map(k=>[k,{status:'NO_DATA',items:[],gap:'本轮没有可核验资料，不代表不存在。'}]));
 const texts={identity:`${c.name}：这是虚构演示主体，不代表现实企业。`,business:'演示产品：设备连接件、金属外壳；仅用于界面验证。',ownership:'示例青禾集团（虚构）为母公司；关系只存在于合成测试数据中。',facilities:'示例工厂A（虚构）为生产地点，不等同用工法定主体。',supply_chain:'示例品牌B（虚构）在2025年合成供应名单中列出本公司；当前关系未知。'};
 for(const [k,text] of Object.entries(texts)){sections[k]={status:'PARTIAL',items:[{text,source_ids:['synthetic-source'],as_of:'2025（合成演示）',basis:'合成测试材料，非真实调查',...(['ownership','facilities','supply_chain'].includes(k)?{relationship_type:({ownership:'PARENT_DISCLOSED',facilities:'OPERATES_SITE',supply_chain:'HISTORICAL_SUPPLIER_DISCLOSURE'})[k]}:{})}],gap:'资料仅覆盖此处列出的演示条目，不表示完整。'};}
 return {version:'0.2',company_id:c.id,synthetic:true,identity_status:'MATCHED',review:{status:'APPROVED',reviewer:'SYNTHETIC_FIXTURE'},sections,sources:[{id:'synthetic-source',title:'虚构演示披露（不是现实来源）',url:'https://example.invalid/synthetic',publisher:'离线演示夹具',accessed_at:NOW(),reuse_status:'SYNTHETIC_FIXTURE_ONLY'}]};
}
window.simulateCompany=cid=>{
 const c=mem.companies.find(x=>x.id===cid);if(!c)return;
 if(!c.snapshots.length){c.snapshots.push({id:sid('snap'),company_id:cid,batch_day:cohortNow().day,published_at:NOW(),status:'PUBLISHED_PARTIAL',digest:'OFFLINE_PREVIEW_NO_CRYPTOGRAPHIC_DIGEST',packet:previewPacket(c)});}
 c.status='PUBLISHED_PARTIAL';for(const r of mem.requests.filter(x=>x.company_id===cid))r.status=c.status;save();
};
if(!mem.companies.length){const co={id:'co_preview_seed',name:'青禾精密制造（虚构）',region:'示例地区',website:'',registry_id:'',public:true,synthetic:true,created_at:NOW(),due_at:cohortNow().due,status:'QUEUED',snapshots:[]};mem.companies.push(co);window.simulateCompany(co.id);}
window.offlineApi=async(path,data)=>{
 if(path==='/config')return {timezone:'Asia/Tokyo',publish_hour:9,forum_enabled:mem.forum,mode:'OFFLINE_BROWSER_DEMO',network_research:false,scheduler_installed:false};
 if(path==='/companies')return mem.companies.filter(c=>c.public);
 if(path==='/me')return {requests:mem.requests,features:mem.features};
 if(path==='/requests'&&data){
  if(!data.consent||!data.name.trim()||!data.region.trim()||!data.needs.length)throw Error('请填写名称、地区、需求并确认演示说明。');
  const {day,due}=cohortNow();let c=data.company_id?mem.companies.find(x=>x.id===data.company_id):null;
  if(data.company_id&&!c)throw Error('指定公司空间不存在，请重新选择。');
  if(!c){c={id:sid('co'),name:data.name,region:data.region,website:data.website,registry_id:data.registry_id,public:data.public,synthetic:true,created_at:NOW(),due_at:due,status:'QUEUED',snapshots:[]};mem.companies.push(c);}
  const r={id:sid('rq'),company_id:c.id,name:c.name,needs:data.needs,public:c.public,created_at:NOW(),batch_day:day,due_at:due,status:c.status};mem.requests.unshift(r);save();return r;
 }
 if(path==='/features'&&data){const f={id:sid('ft'),...data,created_at:NOW()};mem.features.unshift(f);save();return f;}
 let match=path.match(/^\/companies\/([^/]+)$/);
 if(match){const c=mem.companies.find(x=>x.id===match[1]);if(!c)throw Error('公司空间不存在');return {...c,forum_enabled:mem.forum&&c.public};}
 match=path.match(/^\/companies\/([^/]+)\/posts$/);
 if(match){const cid=match[1];const company=mem.companies.find(c=>c.id===cid);if(!company||!company.public)throw Error('此空间未公开讨论');if(data){if(!mem.forum)throw Error('论坛未开放');const p={id:sid('post'),company_id:cid,title:data.title,body:data.body,evidence:'E0',votes:0,created_at:NOW()};mem.posts.unshift(p);save();return p;}return mem.posts.filter(p=>p.company_id===cid);}
 match=path.match(/^\/posts\/([^/]+)\/vote$/);
 if(match&&data){if(!mem.forum)throw Error('论坛未开放');if(!mem.votes.includes(match[1])){mem.votes.push(match[1]);const p=mem.posts.find(x=>x.id===match[1]);if(p)p.votes++;save();}return {ok:true};}
 throw Error('此离线预览不支持该操作');
};
document.addEventListener('DOMContentLoaded',()=>{
 const bar=document.querySelector('.demo-bar');bar.textContent='离线交互预览 · 数据仅在此浏览器 · 所有公司与资料均为虚构 · 无真实研究/调度';
 const btn=document.createElement('button');btn.type='button';btn.className='small';btn.textContent=mem.forum?'关闭论坛演示':'开启论坛演示';btn.style.marginLeft='14px';btn.style.padding='3px 8px';btn.style.fontSize='10px';btn.addEventListener('click',()=>{mem.forum=!mem.forum;save();btn.textContent=mem.forum?'关闭论坛演示':'开启论坛演示';window.dispatchEvent(new HashChangeEvent('hashchange'));});bar.append(btn);
});
