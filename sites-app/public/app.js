import {ISSUE_GUIDES, RIGHTS_PRIMER, PUBLIC_CASES, RESOURCE_GROUPS, RESOURCE_DISCLAIMER, SOURCE_NOTE} from './editorial-content.js';

const runtimeConfig=globalThis.__LTP_CONFIG__||{};
const API_BASE=String(runtimeConfig.apiBase||'').replace(/\/$/,'');
const state={csrf:'',companies:[],mine:[],advisory:[],lane:'community_positive',editId:'',reviewToken:'',exportToken:'',resourceGroup:'all',focusIssue:'',activeCompanyId:''};
let researchPollTimer=null;
let researchPollRemaining=0;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function toast(message,error=false){
  const el=$('#toast');
  if(!el)return;
  el.textContent=message;
  el.className=error?'show error':'show';
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.className='',3300);
}
function text(tag,value,cls=''){const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=value;return e}
function link(label,url,cls=''){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';if(cls)a.className=cls;return a}
async function api(path,{method='GET',body,token}={}){
  const headers={Accept:'application/json'};
  if(body!==undefined){headers['Content-Type']='application/json';headers['X-Ltp-Csrf']=state.csrf}
  if(token)headers.Authorization=`Bearer ${token}`;
  const res=await fetch(`${API_BASE}${path}`,{method,headers,credentials:'include',body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json().catch(()=>({error:'服务器返回无效响应'}));
  if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
  return data;
}

function evidenceLabel(value){
  return ({E0:'未核实线索',E1:'初步整理',E2:'已有支持来源',E3:'已核对范围与来源',E4:'较强证据',E5:'正式决定支持'})[value]||value;
}
function statusLabel(value){
  return ({PENDING:'等待复核',REVIEWED:'已复核',VERIFIED:'已验证',REJECTED:'未通过',DISPUTED:'有争议',WITHDRAWN:'已撤回',ADVISED:'已给出建议',RECEIVED:'已收到'})[value]||value;
}
function researchStatusLabel(value){
  return ({QUEUED:'已进入自动采集队列',COLLECTING:'正在自动采集公开来源',AUTO_READY:'自动资料已更新',AUTO_READY_WITH_SOURCE_GAPS:'自动资料已更新 · 部分来源暂不可用',REVIEW_REQUIRED:'历史资料 · 待自动迁移',REVIEW_REQUIRED_WITH_SOURCE_GAPS:'历史资料 · 待自动迁移且有来源缺口',COLLECTION_FAILED:'本轮自动采集失败 · 将自动重试'})[value]||value;
}
function researchErrorLabel(value){
  return ({SOURCE_ACCESS_DENIED:'来源拒绝当前自动访问',SOURCE_RATE_LIMITED:'来源暂时限流',SOURCE_UNAVAILABLE:'来源暂时不可用',SOURCE_NETWORK_OR_RUNTIME_ERROR:'来源网络暂时异常',SOURCE_TIMEOUT:'来源响应超时',SOURCE_CONTENT_TYPE:'来源响应格式变化',SOURCE_JSON_INVALID:'来源数据格式异常',SOURCE_TOO_LARGE:'来源响应超出安全上限'})[value]||'来源暂时不可用';
}
function dossierStatusLabel(value){return ({REFERENCE_READY:'已有法律实体参考',CONTEXT_READY:'已有开放知识上下文',SIGNALS_READY:'已有来源信号/事件候选',LIMITED_DATA:'资料仍有限'})[value]||value;}
function intelligenceChangeLabel(value){return ({INITIAL:'首次生成',UPDATED:'本轮有变化',UNCHANGED:'与上次一致'})[value]||'首次生成';}
function readableDate(value){
  if(!value)return '未知';const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);
  return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);
}
function badge(label,kind=''){return text('span',label,`badge ${kind}`)}
function cardBase(title,subtitle=''){const c=document.createElement('article');c.className='card';c.append(text('h3',title));if(subtitle)c.append(text('small',subtitle));return c}

function switchTab(name,{scroll=true}={}){
  $$('[data-panel]').forEach(x=>x.classList.toggle('hidden',x.dataset.panel!==name));
  $$('[data-tab]').forEach(x=>x.classList.toggle('nav-active',x.dataset.tab===name));
  if(name==='home')loadHomeLive();
  if(name==='discover')loadDiscover();
  if(name==='mine')loadMine();
  if(name==='advisory')loadAdvisory();
  if(name==='rights')renderRights();
  if(name==='resources')renderResources();
  if(name==='method')loadResearchCoverage();
  if(scroll)window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  history.replaceState(null,'',`#${name}`);
}

function renderEditorial(){
  renderIssueGrid();
  renderCases();
  renderRights();
  renderResourceFilters();
  renderResources();
}
function renderIssueGrid(){
  const root=$('#issue-grid');if(!root)return;
  root.replaceChildren();
  for(const item of ISSUE_GUIDES){
    const b=document.createElement('button');
    b.className='issue-card';b.type='button';b.dataset.issue=item.id;
    b.append(text('span',item.short,'issue-tag'),text('strong',item.title),text('p',item.feeling));
    root.append(b);
  }
}
function renderCases(){
  const root=$('#home-cases');if(!root)return;
  root.replaceChildren();
  for(const item of PUBLIC_CASES){
    const c=document.createElement('article');c.className='story-card';
    const meta=document.createElement('div');meta.className='story-meta';meta.append(text('span',item.topic),text('time',item.date));
    c.append(meta,text('h3',item.title),text('p',item.summary),text('p',`你可以带走的提醒：${item.takeaway}`,'story-takeaway'),link(`查看原始公开来源 · ${item.source}`,item.url,'story-link'));
    root.append(c);
  }
  $('#case-source-note').textContent=SOURCE_NOTE;
}
function renderRights(){
  const primer=$('#rights-primer');
  if(primer){primer.replaceChildren();RIGHTS_PRIMER.forEach((x,i)=>{const a=document.createElement('article');a.append(text('span',String(i+1).padStart(2,'0')),text('h3',x.title),text('p',x.body));primer.append(a)})}
  const root=$('#rights-guide-list');if(!root)return;
  root.replaceChildren();
  for(const item of ISSUE_GUIDES){
    const row=document.createElement('article');row.className='rights-guide';row.id=`guide-${item.id}`;
    if(state.focusIssue===item.id)row.dataset.focused='true';
    const aside=document.createElement('aside');aside.append(text('span',item.short,'issue-tag'),text('p',item.feeling,'guide-feeling'));
    const body=document.createElement('div');body.append(text('h3',item.title),text('p',item.intro));
    const ol=document.createElement('ol');item.steps.forEach(s=>ol.append(text('li',s)));body.append(ol);
    const act=document.createElement('div');act.className='guide-actions';
    const help=document.createElement('button');help.type='button';help.className='primary';help.dataset.tab='advisory';help.textContent='匿名整理我的情况';
    const res=document.createElement('button');res.type='button';res.className='secondary';res.dataset.resourceTags=item.resourceTags.join(',');res.textContent='找相关正式资源';
    act.append(help,res);body.append(act);row.append(aside,body);root.append(row);
  }
  if(state.focusIssue){setTimeout(()=>document.getElementById(`guide-${state.focusIssue}`)?.scrollIntoView({behavior:'smooth',block:'start'}),50)}
}
function renderResourceFilters(){
  const root=$('#resource-filter');if(!root)return;root.replaceChildren();
  const all=document.createElement('button');all.type='button';all.dataset.resourceGroup='all';all.className=state.resourceGroup==='all'?'active':'';all.textContent='全部';root.append(all);
  for(const g of RESOURCE_GROUPS){const b=document.createElement('button');b.type='button';b.dataset.resourceGroup=g.id;b.className=state.resourceGroup===g.id?'active':'';b.textContent=g.label;root.append(b)}
}
function renderResources(tagFilter=[]){
  const root=$('#resource-directory');if(!root)return;
  $('#resource-disclaimer').textContent=RESOURCE_DISCLAIMER;
  root.replaceChildren();
  const groups=RESOURCE_GROUPS.filter(g=>state.resourceGroup==='all'||state.resourceGroup===g.id);
  for(const group of groups){
    const items=group.items.filter(x=>!tagFilter.length||tagFilter.some(t=>x.tags.includes(t)));
    if(!items.length)continue;
    const sec=document.createElement('section');sec.className='resource-group';sec.append(text('h2',group.label));
    const list=document.createElement('div');list.className='resource-list';
    for(const item of items){
      const c=document.createElement('article');c.className='resource-card';
      c.append(text('span',item.kind,'kind'),text('h3',item.name),text('p',item.description),text('p',`适合：${item.for}`,'for'),link('打开官方 / 原始网站',item.url));
      list.append(c);
    }
    sec.append(list);root.append(sec);
  }
}
function renderHomeResourceStrip(){
  const root=$('#home-resource-strip');if(!root)return;root.replaceChildren();
  const picks=[RESOURCE_GROUPS[0].items[0],RESOURCE_GROUPS[0].items[2],RESOURCE_GROUPS[0].items[3],RESOURCE_GROUPS[1].items[0],RESOURCE_GROUPS[1].items[1],RESOURCE_GROUPS[1].items[2]];
  picks.forEach((x,i)=>{const a=link(x.name,x.url,'resource-chip');a.prepend(text('span',String(i+1)));root.append(a)});
  $('#resource-disclaimer-home').textContent=RESOURCE_DISCLAIMER;
}

async function boot(){
  renderEditorial();renderHomeResourceStrip();
  try{
    const cfg=await api('/api/config');state.csrf=cfg.csrfToken;
    const rt=$('#runtime-status');if(rt)rt.textContent=`服务已连接 · ${cfg.version} · 匿名辅导开启 / 敏感私密信息与附件关闭`;
    await loadHomeLive();
    const requested=(location.hash||'#home').slice(1);
    if(requested.startsWith('company/')){switchTab('discover',{scroll:false});const companyId=decodeURIComponent(requested.slice('company/'.length));if(companyId)await openCompanyDetail(companyId,{updateHash:true});}
    else if($(`[data-panel="${CSS.escape(requested)}"]`))switchTab(requested,{scroll:false});
  }catch(e){const rt=$('#runtime-status');if(rt)rt.textContent='服务暂未连接';toast(e.message,true)}
}

async function loadHomeLive(){
  try{
    await loadCompanies();
    const preview=$('#home-community-preview');if(preview){preview.replaceChildren();const visible=state.companies.filter(x=>!x.synthetic).slice(0,3);const rows=visible.length?visible:state.companies.slice(0,2);if(!rows.length)preview.append(text('p','还没有公司空间。第一条公开线索可以从一个公司讨论空间开始。','meta'));rows.forEach(co=>preview.append(companyCard(co,{actions:false})))}
    const reports=await api('/api/advisory/reports?limit=1');const home=$('#home-daily-report');if(home){home.replaceChildren();if(!reports.items.length)home.append(text('strong','暂无日报'),text('span','有新记录后会在这里显示聚合状态。'));else{const r=reports.items[0];home.append(text('strong',`收到 ${r.receivedCount} · 已建议 ${r.advisedCount} · 待处理 ${r.pendingCount}`),text('span',r.statement))}}
    await loadCommunityUpdates();
  }catch(e){/* home remains useful as static public guide even when API is unavailable */}
}

function hasActiveCompanyResearch(){return state.companies.some(x=>!x.synthetic&&['QUEUED','COLLECTING'].includes(x.research?.status))}
function armResearchPolling({reset=false}={}){
  if(reset)researchPollRemaining=36;
  if(!hasActiveCompanyResearch()||researchPollRemaining<=0||researchPollTimer)return;
  researchPollTimer=setTimeout(async()=>{
    researchPollTimer=null;researchPollRemaining--;
    try{await loadCompanies({fromPoll:true})}catch{/* normal page actions remain usable when one poll fails */}
    armResearchPolling();
  },10000);
}
async function loadCompanies({fromPoll=false}={}){
  const d=await api('/api/companies');state.companies=d.items;renderCompanySelect();renderAdvisoryCompanySelect();renderFeedbackCompanySelect();renderCompanies();
  if(!fromPoll&&hasActiveCompanyResearch()&&researchPollRemaining===0)researchPollRemaining=36;
  armResearchPolling();
}
function renderCompanySelect(){
  const select=$('#company-select');if(!select)return;const current=select.value;select.replaceChildren();
  if(!state.companies.length){const o=document.createElement('option');o.value='';o.textContent='请先创建公司空间';select.append(o)}
  for(const co of state.companies){const o=document.createElement('option');o.value=co.id;o.textContent=`${co.name} · ${co.region}`;select.append(o)}
  if(current&&[...select.options].some(x=>x.value===current))select.value=current;
}
function renderAdvisoryCompanySelect(){
  const select=$('#advisory-company-select');if(!select)return;const current=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='不关联 / 暂不明确';select.append(empty);
  for(const co of state.companies){const o=document.createElement('option');o.value=co.id;o.textContent=`${co.name} · ${co.region}`;select.append(o)}
  if([...select.options].some(x=>x.value===current))select.value=current;
}
function renderFeedbackCompanySelect(){
  const select=$('#feedback-company-select');if(!select)return;const current=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='不关联公司';select.append(empty);
  for(const co of state.companies.filter(x=>!x.synthetic)){const o=document.createElement('option');o.value=co.id;o.textContent=`${co.name} · ${co.region}`;select.append(o)}
  if([...select.options].some(x=>x.value===current))select.value=current;
}
function renderAnnouncements(items){
  const root=$('#home-announcements');if(!root)return;root.replaceChildren();
  if(!items?.length){root.append(text('p','还没有公开更新记录。','meta'));return}
  for(const item of items.slice(0,4)){
    const card=cardBase(item.title,item.day);card.classList.add('announcement-card');card.append(text('p',item.summary));
    if(item.items?.length){const ul=document.createElement('ul');item.items.forEach(x=>ul.append(text('li',x)));card.append(ul)}
    if(item.sources?.length){const links=document.createElement('div');links.className='inline-links';item.sources.forEach(x=>links.append(link(x.label,x.url)));card.append(links)}
    root.append(card);
  }
}
function feedbackDecisionLabel(value){return ({answered:'已答复',accepted:'已采纳',planned:'已进入计划',declined:'暂不采纳',needs_more_info:'需要更多信息'})[value]||value;}
function renderFeedbackMine(items){
  const root=$('#community-feedback-mine');if(!root)return;root.replaceChildren();
  if(!items?.length){root.append(text('p','还没有提交意见。','meta'));return}
  for(const item of items.slice(0,6)){
    const row=document.createElement('article');row.className='feedback-item';row.append(text('strong',item.message),text('small',item.company?`${item.company.name} · ${readableDate(item.createdAt)}`:readableDate(item.createdAt)));
    if(item.response){row.append(badge(feedbackDecisionLabel(item.response.decision),'evidence'),text('p',item.response.answer));if(item.response.actions?.length)row.append(text('small',`处理：${item.response.actions.join('；')}`))}
    else row.append(badge('等待每日 Agent 处理','pending'));
    root.append(row);
  }
}
async function loadCommunityUpdates(){
  const [announcements,feedback]=await Promise.all([api('/api/announcements?limit=4'),api('/api/community-feedback')]);
  renderAnnouncements(announcements.items||[]);renderFeedbackMine(feedback.items||[]);
}
function researchPreviewMeta(preview){
  const parts=[];
  if(preview.match==='EXACT_NAME')parts.push('名称完全匹配候选');else parts.push('待核对候选');
  if(preview.region)parts.push(preview.region);
  if(preview.ticker)parts.push(`Ticker ${preview.ticker}`);
  if(preview.jurisdiction)parts.push(`辖区 ${preview.jurisdiction}`);
  if(preview.entityStatus)parts.push(`实体状态 ${preview.entityStatus}`);
  if(preview.matches)parts.push(`命中 ${preview.matches} 条公开记录`);
  if(preview.reference)parts.push(`参考标识 ${preview.reference}`);
  return parts.join(' · ');
}
function intelligenceBlock(intelligence){
  if(!intelligence)return null;
  const wrap=document.createElement('section');wrap.className='machine-intelligence';
  const title=document.createElement('div');title.className='machine-intelligence-title';
  title.append(text('strong','机器自动整理'));
  title.append(badge(`${intelligence.coverage?.machineVerifiedFacts||0} 个参考事实`,'evidence'),badge(`${intelligence.coverage?.openContextReferences||0} 个开放上下文`),badge(`${intelligence.coverage?.sourceSignals||0} 个来源信号`),badge(`${intelligence.coverage?.publicEventCandidates||0} 条事件候选`));
  wrap.append(title);
  if(intelligence.dossier){
    const overview=document.createElement('div');overview.className='dossier-overview';
    overview.append(badge(dossierStatusLabel(intelligence.dossier.status),intelligence.dossier.status==='REFERENCE_READY'?'evidence':'pending'),text('p',intelligence.dossier.summary));
    overview.append(text('small',`${intelligenceChangeLabel(intelligence.change)} · 资料更新 ${readableDate(intelligence.dossier.updatedAt)} · 适用来源成功 ${intelligence.dossier.sourceCoverage?.successful||0} · 暂不可用 ${intelligence.dossier.sourceCoverage?.errors||0} · 地区不适用 ${intelligence.dossier.sourceCoverage?.notApplicable||0}`));
    wrap.append(overview);
  }
  if(intelligence.identity){
    const id=document.createElement('p');id.className='machine-identity';
    const labels={AUTO_BOUND_REFERENCE:'已自动匹配法律实体参考',AMBIGUOUS:'存在多个身份候选，未自动选择',COUNTRY_CONFLICT:'地区冲突，未自动绑定',COUNTRY_HINT_REQUIRED:'缺少可机器确认的国家提示，保持未绑定',SOURCE_SCHEMA_CONFLICT:'来源标识未通过机器校验，保持未绑定',SOURCE_GAP:'身份根来源暂不可用',NO_VERIFIED_REFERENCE:'本轮没有足够强的身份参考'};
    id.append(badge(labels[intelligence.identity.status]||intelligence.identity.status,intelligence.identity.status==='AUTO_BOUND_REFERENCE'?'evidence':'pending'),text('span',` ${intelligence.identity.reason||''}`));wrap.append(id);
  }
  if(intelligence.facts?.length){
    const sec=document.createElement('div');sec.className='machine-facts';sec.append(text('h4','机器可验证的窄范围参考事实'));
    const ul=document.createElement('ul');
    for(const fact of intelligence.facts){const li=document.createElement('li');li.append(text('strong',fact.text),text('small',`${fact.source?.sourceOfRecord||fact.provider} · ${fact.scope}`),text('span',fact.caveat));if(fact.source?.official)li.append(link('官方来源',fact.source.official,'research-source-link'));ul.append(li)}
    sec.append(ul);wrap.append(sec);
  }
  if(intelligence.signals?.length){
    const sec=document.createElement('div');sec.className='machine-signals';sec.append(text('h4','来源信号（不是公司结论）'));
    const ul=document.createElement('ul');
    for(const signal of intelligence.signals){const li=document.createElement('li');li.append(text('strong',signal.text),text('small',`${signal.source?.sourceOfRecord||signal.provider} · ${signal.scope}`),text('span',signal.caveat));if(signal.source?.official)li.append(link('官方来源',signal.source.official,'research-source-link'));ul.append(li)}
    sec.append(ul);wrap.append(sec);
  }
  if(intelligence.contextReferences?.length){
    const sec=document.createElement('div');sec.className='machine-context verified-context';sec.append(text('h4','开放知识上下文（不是工商登记）'));
    for(const item of intelligence.contextReferences){
      const card=document.createElement('article');card.className='context-reference';
      const basisLabel=({OFFICIAL_WEBSITE_DOMAIN_MATCH:'官网域名匹配',EXACT_NAME_AND_COUNTRY_MATCH:'名称与地区匹配',UNIQUE_CORPORATE_SHORTHAND_AND_COUNTRY:'唯一公司简称 + 地区 + 组织结构信号'})[item.basis]||item.basis;
      card.append(text('strong',item.label||'开放知识条目'),text('small',`${item.source?.sourceOfRecord||item.provider}${item.reference?` · ${item.reference}`:''} · ${basisLabel}${item.searchQuery?` · 搜索词「${item.searchQuery}」`:''}`));
      if(item.description)card.append(text('p',item.description));
      const facts=[];if(item.inception)facts.push(`成立/起始 ${item.inception}`);if(item.legalForm)facts.push(`类型 ${item.legalForm}`);if(item.countryLabels?.length)facts.push(`国家/地区 ${item.countryLabels.join('、')}`);if(item.headquarters?.length)facts.push(`总部 ${item.headquarters.join('、')}`);if(item.industries?.length)facts.push(`行业 ${item.industries.join('、')}`);if(item.products?.length)facts.push(`产品/产出 ${item.products.join('、')}`);if(item.exchanges?.length)facts.push(`交易所 ${item.exchanges.join('、')}`);if(item.parents?.length)facts.push(`上级组织候选 ${item.parents.join('、')}`);
      if(facts.length){const ul=document.createElement('ul');ul.className='context-fact-list';facts.forEach(x=>ul.append(text('li',x)));card.append(ul)}
      const links=document.createElement('div');links.className='inline-links';if(item.officialWebsite)links.append(link('公开官网',item.officialWebsite));if(item.wikipediaUrl)links.append(link('百科页面',item.wikipediaUrl));if(item.source?.official)links.append(link('Wikidata 来源',item.source.official));if(links.childNodes.length)card.append(links);
      card.append(text('small',item.caveat,'method-note'));sec.append(card);
    }
    wrap.append(sec);
  }
  if(intelligence.timeline?.length){
    const sec=document.createElement('div');sec.className='machine-timeline';sec.append(text('h4','公开记录时间线（事件候选）'));
    const list=document.createElement('ol');list.className='event-timeline';
    for(const item of intelligence.timeline){
      const li=document.createElement('li');const meta=[item.date,item.endDate&&item.endDate!==item.date?`至 ${item.endDate}`:'',item.location,item.status].filter(Boolean).join(' · ');
      li.append(text('strong',item.title),text('small',meta||item.provider));if(item.detail)li.append(text('p',item.detail));li.append(text('small',item.caveat,'method-note'));
      const target=item.recordUrl||item.source?.official;if(target)li.append(link('查看来源入口',target,'research-source-link'));list.append(li);
    }
    sec.append(list);wrap.append(sec);
  }
  if(intelligence.contextCandidates?.length){
    const sec=document.createElement('div');sec.className='machine-context';sec.append(text('h4','上下文候选（不自动当事实）'));
    const ul=document.createElement('ul');
    for(const item of intelligence.contextCandidates){const li=document.createElement('li');li.append(text('strong',item.label||'未命名候选'),text('small',`${item.source?.sourceOfRecord||item.provider}${item.reference?` · ${item.reference}`:''}${item.countryLabels?.length?` · ${item.countryLabels.join('、')}`:''}`));if(item.description)li.append(text('span',item.description));const hints=[item.inception&&`成立/起始 ${item.inception}`,item.headquarters?.length&&`总部 ${item.headquarters.join('、')}`,item.industries?.length&&`行业 ${item.industries.join('、')}`,item.products?.length&&`产品/产出 ${item.products.join('、')}`].filter(Boolean);if(hints.length)li.append(text('small',hints.join(' · ')));li.append(text('span',item.caveat));const links=document.createElement('div');links.className='inline-links';if(item.officialWebsite)links.append(link('候选官网',item.officialWebsite,'research-source-link'));if(item.wikipediaUrl)links.append(link('百科页面',item.wikipediaUrl,'research-source-link'));if(item.source?.official)links.append(link('来源入口',item.source.official,'research-source-link'));if(links.childNodes.length)li.append(links);ul.append(li)}
    sec.append(ul);wrap.append(sec);
  }
  if(intelligence.conflicts?.length){
    const sec=document.createElement('div');sec.className='machine-conflicts';sec.append(text('h4','自动降级 / 冲突'));
    const ul=document.createElement('ul');for(const conflict of intelligence.conflicts)ul.append(text('li',conflict.message||conflict.code));sec.append(ul);wrap.append(sec);
  }
  if(intelligence.dossier?.gaps?.length){
    const sec=document.createElement('div');sec.className='dossier-gaps';sec.append(text('h4','当前资料缺口 / 未知'));
    const ul=document.createElement('ul');for(const gap of intelligence.dossier.gaps){const li=document.createElement('li');li.append(text('strong',gap.label),text('span',gap.detail));ul.append(li)}sec.append(ul);wrap.append(sec);
  }
  if(intelligence.clusters?.length){
    const details=document.createElement('details');details.className='machine-clusters';
    const summary=document.createElement('summary');summary.textContent=`查看 ${intelligence.clusters.length} 组自动候选聚类`;details.append(summary);
    const ul=document.createElement('ul');
    for(const cluster of intelligence.clusters){ul.append(text('li',`${cluster.label} · ${cluster.providers.join(' / ')} · 候选 ${cluster.candidateCount} · 公开记录命中 ${cluster.totalMatchedRecords}`));}
    details.append(ul);wrap.append(details);
  }
  wrap.append(text('p',intelligence.boundary,'method-note'));
  return wrap;
}
function researchBlock(co){
  const r=co.research;
  if(!r)return text('p','自动公开资料采集尚未进入首轮结果。公司空间可以先使用；生产系统会自动把新公司加入研究队列。','research-summary');
  const wrap=document.createElement('div');wrap.className='research-block';
  const head=document.createElement('div');head.className='research-summary';
  head.append(badge(researchStatusLabel(r.status),['QUEUED','COLLECTING'].includes(r.status)?'pending':'evidence'));
  if(['QUEUED','COLLECTING'].includes(r.status))head.append(text('span',' 系统会自动处理，无需用户或管理员再次入队。'));
  else if(r.status==='COLLECTION_FAILED')head.append(text('span',' 公司空间不受影响；失败任务会按重试窗口再次进入自动队列。'));
  else if(['AUTO_READY','AUTO_READY_WITH_SOURCE_GAPS'].includes(r.status))head.append(text('span',` 本轮适用来源成功 ${r.sourceSuccessCount} · 机器参考事实 ${r.intelligence?.coverage?.machineVerifiedFacts||0} · 开放上下文 ${r.intelligence?.coverage?.openContextReferences||0} · 来源信号 ${r.intelligence?.coverage?.sourceSignals||0} · 事件候选 ${r.intelligence?.coverage?.publicEventCandidates||0}${r.sourceErrorCount?` · 暂不可用 ${r.sourceErrorCount}`:''}${r.sourceNotApplicableCount?` · 地区不适用 ${r.sourceNotApplicableCount}`:''}。`));
  else head.append(text('span',` 本轮 ${r.sourceSuccessCount} 个来源可用 · ${r.candidateCount} 条历史候选；系统将在下次刷新自动迁移到自治规则。`));
  wrap.append(head);
  const intelligence=intelligenceBlock(r.intelligence);if(intelligence)wrap.append(intelligence);
  if(r.providers?.length){
    const details=document.createElement('details');details.className='research-details';
    const summary=document.createElement('summary');summary.textContent='查看自动收集的公开来源候选';details.append(summary);
    const sourceList=document.createElement('div');sourceList.className='research-source-list';
    for(const provider of r.providers){
      const row=document.createElement('section');row.className='research-source';
      const title=document.createElement('div');title.className='research-source-title';
      title.append(text('strong',provider.source?.sourceOfRecord||provider.provider));
      title.append(badge(provider.status==='ERROR'?researchErrorLabel(provider.errorCode):provider.status==='NOT_APPLICABLE'?'当前地区不适用':`候选 ${provider.candidateCount}`,provider.status==='ERROR'?'negative':provider.status==='NOT_APPLICABLE'?'':'evidence'));
      row.append(title);
      if(provider.source?.official)row.append(link('打开官方来源',provider.source.official,'research-source-link'));
      if(provider.previews?.length){
        const list=document.createElement('ul');list.className='research-preview-list';
        for(const preview of provider.previews){
          const li=document.createElement('li');li.append(text('strong',preview.label||'未命名候选'),text('small',researchPreviewMeta(preview)));
          if(preview.description)li.append(text('span',preview.description));
          list.append(li);
        }
        row.append(list);
      }else if(provider.status==='OK')row.append(text('p','本轮未找到可展示的名称候选。','meta'));
      else if(provider.status==='NOT_APPLICABLE')row.append(text('p','该数据源只覆盖特定司法区，本轮未执行；这不表示“没有记录”。','meta'));
      sourceList.append(row);
    }
    details.append(sourceList,text('p',r.boundary,'method-note'));wrap.append(details);
  }
  return wrap;
}
function researchTeaser(co){
  const r=co.research;const box=document.createElement('div');box.className='company-dossier-teaser';
  if(!r){box.append(text('strong','自动资料尚未生成'),text('p','公司空间已经可用；生产系统会自动加入资料采集队列。'));return box}
  if(['QUEUED','COLLECTING'].includes(r.status)){box.append(badge(researchStatusLabel(r.status),'pending'),text('p','系统正在自动收集公开来源；社区反馈和公开线索可以先正常使用。'));return box}
  if(r.status==='COLLECTION_FAILED'){box.append(badge(researchStatusLabel(r.status),'negative'),text('p','采集失败已进入自动恢复链，不需要人工重新触发。'));return box}
  const d=r.intelligence?.dossier;box.append(badge(dossierStatusLabel(d?.status||'LIMITED_DATA'),d?.status==='REFERENCE_READY'?'evidence':'pending'));
  box.append(text('p',d?.summary||`已完成自动资料整理；机器参考事实 ${r.intelligence?.coverage?.machineVerifiedFacts||0}、来源信号 ${r.intelligence?.coverage?.sourceSignals||0}、来源候选 ${r.candidateCount||0}。`));
  box.append(text('small',`更新 ${readableDate(d?.updatedAt||r.collectedAt)} · 适用来源成功 ${r.sourceSuccessCount||0}${r.sourceErrorCount?` · 暂不可用 ${r.sourceErrorCount}`:''}${r.sourceNotApplicableCount?` · 地区不适用 ${r.sourceNotApplicableCount}`:''}`));
  return box;
}
function openContributionForCompany(companyId){
  if(!companyId)return;
  if($('#company-detail-dialog')?.open)closeCompanyDetail({updateHash:false});
  switchTab('contribute');
  const select=$('#company-select');
  if(select&&[...select.options].some(x=>x.value===companyId))select.value=companyId;
  const form=$('#contribution-form');
  if(form){form.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});setTimeout(()=>select?.focus(),0)}
}
function companyShareUrl(companyId){return `${location.origin}${location.pathname}#company/${encodeURIComponent(companyId)}`;}
async function copyCompanyShareUrl(companyId){
  const url=companyShareUrl(companyId);
  try{await navigator.clipboard.writeText(url);toast('公司资料链接已复制')}
  catch{prompt('复制这个公司资料链接：',url)}
}
function companyCard(co,{actions=true}={}){
  const c=document.createElement('article');c.className='card company-card';
  const title=document.createElement('div');title.className='company-title-row';title.append(text('strong',co.name),text('small',co.region+(co.synthetic?' · 演示数据':'')));c.append(title);
  const b=document.createElement('div');b.className='badges';b.append(badge(`正向 ${co.positive}`),badge(`负向 ${co.negative}`,'negative'),badge(`参与 ${co.participants}`));c.append(b);
  if(!co.synthetic)c.append(researchTeaser(co));
  if(co.products.length)c.append(text('p',`公开产品线索：${co.products.map(x=>`${x.title}（${evidenceLabel(x.evidence)}）`).join('、')}`,'company-products'));
  else c.append(text('p','目前没有公开产品线索。没有记录不代表不存在。','company-products'));
  if(!co.synthetic){const detail=document.createElement('button');detail.className='primary';detail.type='button';detail.dataset.companyDetail=co.id;detail.textContent='查看完整资料';const contribute=document.createElement('button');contribute.className='secondary';contribute.type='button';contribute.dataset.companyContribute=co.id;contribute.textContent='补充这家公司资料';const a=document.createElement('div');a.className='card-actions';a.append(detail,contribute);if(actions)for(const [dir,label] of [['positive','留下正向反馈'],['negative','留下负向反馈'],[null,'撤回我的反馈']]){const btn=document.createElement('button');btn.className='secondary';btn.textContent=label;btn.dataset.ballot=dir||'';btn.dataset.company=co.id;a.append(btn)}c.append(a)}
  return c;
}
function dossierSection(title,description=''){
  const sec=document.createElement('section');sec.className='company-detail-section';sec.append(text('h3',title));if(description)sec.append(text('p',description,'meta'));return sec;
}
function contributionDetailCard(item){
  const c=document.createElement('article');c.className='detail-contribution';
  const head=document.createElement('div');head.className='detail-contribution-head';head.append(text('strong',item.title),badge(evidenceLabel(item.evidence),Number(String(item.evidence||'E0').slice(1))>=3?'evidence':'pending'),badge(statusLabel(item.status),item.status==='DISPUTED'?'negative':''));c.append(head);
  if(item.description)c.append(text('p',item.description));
  const meta=[item.scope&&`范围：${item.scope}`,item.periodStart&&`起始：${item.periodStart}`,item.periodEnd&&`结束：${item.periodEnd}`,item.creditName&&`贡献：${item.creditName}`].filter(Boolean);if(meta.length)c.append(text('small',meta.join(' · ')));
  if(item.sources?.length){const ul=document.createElement('ul');ul.className='contribution-sources';for(const s of item.sources){const li=document.createElement('li');li.append(link(s.title||s.url,s.url),text('small',s.supports||s.type||''));ul.append(li)}c.append(ul)}
  return c;
}
function appendContributionGroup(root,title,rows,empty='暂无公开贡献。'){
  const sec=dossierSection(title);if(!rows?.length){sec.append(text('p',empty,'meta'));root.append(sec);return}
  const list=document.createElement('div');list.className='detail-contribution-list';rows.forEach(x=>list.append(contributionDetailCard(x)));sec.append(list);root.append(sec);
}
function officialRelationLabel(value){return ({COMPANY_REGISTERS_PRODUCT:'官方登记产品',COMPANY_OWNS_BRAND:'官方记录的公司—品牌关系',BRAND_MARKETS_PRODUCT:'官方记录的品牌—产品关系',COMPANY_PARENT_OF_COMPANY:'官方记录的母公司关系',COMPANY_SUBSIDIARY_OF_COMPANY:'官方记录的子公司关系',PUBLIC_PROCUREMENT_RELATION:'公共采购关系',OTHER_OFFICIAL_RELATION:'其他官方关系'})[value]||value;}
function appendOfficialRelations(root,rows){
  if(!rows?.length)return;
  const sec=dossierSection('官方来源确认的公司 / 品牌 / 产品关系','这里只展示具体官方记录能够直接支持的关系；它不等于产品质量认证、公司整体评价或完整关系网络。');
  const list=document.createElement('div');list.className='official-relation-list';
  for(const item of rows){
    const card=document.createElement('article');card.className='official-relation-card';
    card.append(badge('官方来源关系','evidence'),text('strong',`${item.subject?.name||'公司'} → ${item.object?.name||'记录对象'}`),text('small',`${officialRelationLabel(item.relationType)} · ${item.source?.sourceOfRecord||item.provider}${item.source?.date?` · ${item.source.date}`:''}`));
    const attrs=item.object?.attributes||{};const meta=[attrs.tradeName&&`商品名 ${attrs.tradeName}`,attrs.model&&`型号 ${attrs.model}`,attrs.registrationOrFilingNumber&&`注册/备案号 ${attrs.registrationOrFilingNumber}`,attrs.udiDi&&`UDI-DI ${attrs.udiDi}`].filter(Boolean);if(meta.length)card.append(text('p',meta.join(' · ')));
    if(item.scope)card.append(text('small',item.scope));card.append(text('p',item.caveat,'method-note'));if(item.source?.url)card.append(link('查看官方来源',item.source.url,'research-source-link'));list.append(card);
  }
  sec.append(list);root.append(sec);
}
function renderCompanyDetail(detail){
  const root=$('#company-detail-content');root.replaceChildren();
  $('#company-detail-title').textContent=detail.company.name;
  $('#company-detail-subtitle').textContent=`${detail.company.region} · 资料更新 ${readableDate(detail.updatedAt)}`;
  const top=document.createElement('section');top.className='company-detail-top';
  const intro=document.createElement('div');intro.className='company-detail-intro';
  const dossier=detail.research?.intelligence?.dossier;intro.append(text('h3',dossier?'当前资料概览':'公司空间已建立'));
  intro.append(text('p',dossier?.summary||'自动资料仍在生成或当前来源不足；这不会阻止社区反馈和公开线索继续累积。'));
  if(detail.company.website)intro.append(link('公司空间登记的公开官网',detail.company.website,'detail-official-link'));
  const community=document.createElement('aside');community.className='company-community-panel';community.append(text('strong','社区声音'),text('span',`正向 ${detail.community.positive}`),text('span',`负向 ${detail.community.negative}`),text('span',`参与 ${detail.community.participants}`),text('small',detail.community.boundary));
  const actions=document.createElement('div');actions.className='card-actions';const contribute=document.createElement('button');contribute.className='primary';contribute.type='button';contribute.dataset.companyContribute=detail.company.id;contribute.textContent='补充这家公司资料';const share=document.createElement('button');share.className='secondary';share.type='button';share.dataset.companyShare=detail.company.id;share.textContent='复制资料链接';actions.append(contribute,share);for(const [dir,label] of [['positive','留下正向反馈'],['negative','留下负向反馈'],[null,'撤回我的反馈']]){const btn=document.createElement('button');btn.className='secondary';btn.textContent=label;btn.dataset.ballot=dir||'';btn.dataset.company=detail.company.id;btn.dataset.detailBallot='1';actions.append(btn)}community.append(actions);top.append(intro,community);root.append(top);

  const auto=dossierSection('自动资料与公开来源','这一部分由确定性规则自动整理。法律实体参考、开放知识上下文、来源信号和事件候选具有不同证据层级。');
  auto.append(researchBlock({research:detail.research}));root.append(auto);

  appendOfficialRelations(root,detail.officialRelations||[]);

  const contrib=detail.contributions||{};
  appendContributionGroup(root,'公开公司资料贡献',contrib.companyFacts,'还没有用户补充的公开公司资料。');
  appendContributionGroup(root,'品牌线索',contrib.brands,'还没有社区补充的品牌线索。');
  appendContributionGroup(root,'产品与服务线索',contrib.products,'还没有公开产品/服务线索。');
  appendContributionGroup(root,'社区关系线索',contrib.relationships,'还没有社区补充的公司 / 品牌 / 产品关系线索。');
  appendContributionGroup(root,'劳动实践主张',contrib.labourClaims,'还没有公开劳动实践贡献。没有记录不代表没有相关经历。');
  appendContributionGroup(root,'产品体验主张',contrib.productClaims,'还没有公开产品体验主张。');
  root.append(text('p',detail.boundary,'detail-boundary'));
}
async function openCompanyDetail(companyId,{updateHash=true}={}){
  const dialog=$('#company-detail-dialog');if(!dialog)return;
  state.activeCompanyId=companyId;$('#company-detail-title').textContent='正在加载…';$('#company-detail-subtitle').textContent='';$('#company-detail-content').replaceChildren(text('p','正在读取公司资料…','meta'));
  if(!dialog.open)dialog.showModal();
  if(updateHash)history.replaceState(null,'',`#company/${encodeURIComponent(companyId)}`);
  try{const detail=await api(`/api/companies/${encodeURIComponent(companyId)}`);if(state.activeCompanyId===companyId)renderCompanyDetail(detail)}catch(err){if(state.activeCompanyId===companyId){$('#company-detail-content').replaceChildren(text('p',`公司资料读取失败：${err.message}`,'meta'));toast(err.message,true)}}
}
function closeCompanyDetail({updateHash=true}={}){
  const dialog=$('#company-detail-dialog');if(dialog?.open)dialog.close();state.activeCompanyId='';if(updateHash&&location.hash.startsWith('#company/'))history.replaceState(null,'','#discover');
}
function renderCompanies(){
  const root=$('#companies');if(!root)return;root.replaceChildren();const q=($('#company-search')?.value||'').trim().toLowerCase();
  const rows=state.companies.filter(co=>!q||[co.name,co.region,...co.products.map(x=>x.title),...(co.research?.providers||[]).flatMap(x=>(x.previews||[]).map(p=>p.label))].join(' ').toLowerCase().includes(q));
  if(!rows.length){root.append(text('p',q?'没有匹配的公司空间。可以尝试换一个名称或地区。':'当前还没有公司空间。创建空间不等于对公司作出好坏判断。','meta'));return}
  rows.forEach(co=>root.append(companyCard(co)));
}
async function loadDiscover(){
  try{await loadCompanies();const d=await api(`/api/showcase?lane=${encodeURIComponent(state.lane)}`);$('#lane-method').textContent=d.method.replace('社区正负','社区正向/负向反馈').replace('E3+具体正向劳动主张','已核对范围与来源的具体正向劳动主张');const root=$('#showcase');root.replaceChildren();if(!d.items.length){root.append(text('p','当前这个分区还没有符合条件的公司。没有记录不代表某家公司好或坏。','meta'));return}for(const x of d.items){const live=state.companies.find(co=>co.id===x.company.id);const c=companyCard({...x.company,positive:x.positive,negative:x.negative,participants:x.participants,products:x.products,research:live?.research||null},{actions:false});for(const claim of x.verifiedPositiveClaims)c.append(text('p',`有较强证据的正向实践：${claim.title} · ${evidenceLabel(claim.evidence)}`));root.append(c)}}catch(e){toast(e.message,true)}
}

const coverageStatusLabel={
  AUTOMATED_SUPPORTED:'自动覆盖 · 主来源',AUTOMATED_PARTIAL:'自动覆盖 · 部分',AUTOMATED_PARTIAL_REGION_LIMITED:'自动覆盖 · 地区/主体受限',
  AUTOMATED_PARTIAL_CONTEXT_ONLY:'自动覆盖 · 仅上下文',CANDIDATE_ONLY:'只提供候选',OPTIONAL_TOKEN_CANDIDATE_ONLY:'可选来源 · 需授权后只做候选',
  OPTIONAL_TOKEN_LICENSE_REVIEW_REQUIRED:'可选来源 · 需令牌与许可复核',COMMUNITY_EVIDENCE_ONLY:'社区与证据复核',NO_APPROVED_AUTOMATED_SOURCE:'暂无批准的自动来源'};
async function loadResearchCoverage(){
  const root=$('#research-coverage');if(!root)return;
  try{
    const [d,status,ops]=await Promise.all([api('/api/research/coverage'),api('/api/research/status'),api('/api/research/health')]);root.replaceChildren();
    const health=document.createElement('div');health.className='notice neutral';
    const healthLabel=({HEALTHY:'自动研究运行正常',DEGRADED_SOURCE_COVERAGE:'自动研究运行正常，但部分来源当前不可用',RECOVERY_NEEDED:'系统检测到待自愈任务',LOCAL_REFERENCE_MODE:'本地参考模式未启用生产自动研究'})[ops.status]||'自动研究状态可用';
    const recovery=Number(ops.missingResearch||0)+Number(ops.staleQueued||0)+Number(ops.staleCollecting||0)+Number(ops.retryEligibleFailures||0)+Number(ops.missingCurrentPolicy||0);
    health.append(text('strong',healthLabel),text('p',`真实公司 ${ops.realCompanies||0} · 可用资料页 ${status.dossierReady||0} · 资料有限 ${status.limitedDossiers||0} · 机器参考事实 ${status.machineVerifiedFacts||0} · 开放上下文 ${status.openContextReferences||0} · 来源信号 ${status.sourceSignals||0} · 事件候选 ${status.publicEventCandidates||0} · 待自愈 ${recovery}`));
    health.append(text('small','无人值守规则：Queue 自动消费；5 分钟与每日任务重投递漏单、陈旧、失败和旧策略记录；歧义不会阻塞页面，而是自动保持候选或未知。'));root.append(health);
    root.append(text('p',d.claimBoundary,'method-note'));
    const list=document.createElement('div');list.className='cards compact-cards';
    for(const x of d.sections){
      const c=cardBase(x.label,coverageStatusLabel[x.status]||x.status);c.append(text('p',x.scope));
      if(x.source)c.append(text('small',`已接/可用来源：${x.source}`));list.append(c)
    }
    root.append(list);
    if(Array.isArray(d.optionalSources)&&d.optionalSources.length){
      const note=document.createElement('div');note.className='notice neutral';note.append(text('strong','为什么有些来源没有直接打开？'));
      note.append(text('p','部分商业或行业数据库需要 API token、订阅或特定再分发许可。项目会保留适配器，但在授权和许可没有确认前失败关闭，不会绕过限制。'));root.append(note)
    }
  }catch(e){root.textContent='研究覆盖状态读取失败';toast(e.message,true)}
}

function contributionPayload(form){
  const f=new FormData(form);const summary=String(f.get('summary')||'').trim();let rawKind=String(f.get('kind')||'product');let kind=rawKind;let direction=String(f.get('direction')||'neutral');
  if(rawKind==='labour_positive'){kind='labour_claim';direction='positive'}else if(rawKind==='labour_negative'){kind='labour_claim';direction='negative'}
  if(kind==='product_claim'&&direction==='neutral')throw new Error('产品体验请选择正向或负向；如果只是补充产品资料，请选择“一个产品 / 服务”。');
  const sourceUrl=String(f.get('sourceUrl')||'').trim();const sourceTitle=String(f.get('sourceTitle')||'').trim()||'公开来源';const sourceSupports=String(f.get('sourceSupports')||'').trim()||summary;
  const sources=sourceUrl?[{url:sourceUrl,title:sourceTitle,type:String(f.get('sourceType')||'other'),publishedAt:'',supports:sourceSupports}]:[];
  const first=summary.split(/[。！？\n]/).find(Boolean)||summary;const title=first.slice(0,120);
  return {companyId:String(f.get('companyId')||''),kind,title,description:summary,scope:String(f.get('scope')||''),periodStart:String(f.get('periodStart')||''),periodEnd:String(f.get('periodEnd')||''),direction,dimension:String(f.get('dimension')||'other'),productId:String(f.get('productId')||''),brandId:String(f.get('brandId')||''),relationType:String(f.get('relationType')||''),relation:String(f.get('relation')||''),category:kind==='brand'?'品牌':'',sources,public:true,consent:true,shareConsent:false,rights:sourceUrl?'reference_only':'own_summary',rightsNote:'',creditName:String(f.get('creditName')||'')};
}
function resetContributionForm(){state.editId='';const form=$('#contribution-form');form?.reset();const t=$('#contribution-title');if(t)t.textContent='说一句你知道的';$('#cancel-edit')?.classList.add('hidden');const more=$('#contribution-more');if(more)more.open=false;renderCompanySelect()}
async function loadMine(){
  try{const d=await api('/api/contributions?mine=1');state.mine=d.items;const root=$('#mine-list');root.replaceChildren();if(!d.items.length){root.append(text('p','这个浏览器还没有提交公开线索。','meta'));return}for(const item of d.items){const c=cardBase(item.title,`${evidenceLabel(item.evidence)} · ${statusLabel(item.status)} · v${item.version}`);const b=document.createElement('div');b.className='badges';b.append(badge(evidenceLabel(item.evidence),'evidence'),badge(statusLabel(item.status),item.status==='PENDING'?'pending':''));c.append(b,text('p',item.description));const a=document.createElement('div');a.className='card-actions';for(const [action,label,cls] of [['edit','修改','secondary'],['flag','提交纠错','secondary'],['withdraw','撤回','danger']]){const btn=document.createElement('button');btn.className=cls;btn.dataset.mineAction=action;btn.dataset.id=item.id;btn.textContent=label;a.append(btn)}c.append(a);root.append(c)}}catch(e){toast(e.message,true)}
}
function editContribution(id){
  const item=state.mine.find(x=>x.id===id);if(!item)return;state.editId=id;switchTab('contribute');const form=$('#contribution-form');
  form.elements.companyId.value=item.companyId||'';
  let uiKind=item.kind;if(item.kind==='labour_claim')uiKind=item.direction==='positive'?'labour_positive':'labour_negative';form.elements.kind.value=uiKind;
  form.elements.summary.value=item.description||item.title||'';
  for(const key of ['scope','periodStart','periodEnd','direction','dimension','productId','brandId','relationType','relation','creditName'])if(form.elements[key])form.elements[key].value=item[key]||'';
  const s=item.sources?.[0];if(s){form.elements.sourceUrl.value=s.url;form.elements.sourceTitle.value=s.title;form.elements.sourceType.value=s.type;form.elements.sourceSupports.value=s.supports}
  const more=$('#contribution-more');if(more)more.open=Boolean(s||item.scope||item.periodStart||item.periodEnd||item.relation||item.relationType||item.dimension!=='other');
  $('#contribution-title').textContent='修改这句话';$('#cancel-edit').classList.remove('hidden')
}

function advisoryPayload(form){const f=new FormData(form);return {category:String(f.get('category')||'other'),companyId:String(f.get('companyId')||''),region:String(f.get('region')||''),employmentStatus:String(f.get('employmentStatus')||'other'),summary:String(f.get('summary')||''),desiredOutcome:String(f.get('desiredOutcome')||''),tried:String(f.get('tried')||''),urgency:String(f.get('urgency')||'routine'),privacyConfirmed:f.get('privacyConfirmed')==='on',consent:f.get('consent')==='on'}}
function categoryLabel(value){return ({pay:'工资 / 薪酬',hours_rest:'工时 / 休息',contract:'合同 / 用工关系',termination:'离职 / 解除',safety:'工作安全',respect:'尊重 / 不当对待',representation:'代表权 / 集体沟通',other:'其他'})[value]||value}
function adviceBlock(item,owned=false){
  const c=cardBase(categoryLabel(item.category),`${statusLabel(item.status)} · ${new Date(item.createdAt).toLocaleString()}`);c.append(text('p',item.summary));c.append(text('p',`你希望解决：${item.desiredOutcome}`));if(item.company)c.append(text('small',`关联公司空间：${item.company.name} · ${item.company.region}`));
  if(item.advice){c.append(badge('已生成私有建议','evidence'));c.append(text('p',item.advice.situation));const ol=document.createElement('ol');ol.className='advice-list';for(const step of item.advice.steps)ol.append(text('li',step));c.append(ol);const caut=document.createElement('ul');caut.className='advice-list';for(const x of item.advice.cautions)caut.append(text('li',x));c.append(text('strong','请特别留意'),caut,text('p',item.advice.escalation),text('small',item.advice.automationNotice))}
  else c.append(text('p','已经进入待办。日常处理完成后，这里会出现一份私有整理建议。','meta'));
  if(owned){const actions=document.createElement('div');actions.className='card-actions';const b=document.createElement('button');b.className='danger';b.textContent='撤回匿名辅导';b.dataset.advisoryWithdraw=item.id;actions.append(b);c.append(actions)}return c;
}
async function loadAdvisory(){
  try{await loadCompanies();const mine=await api('/api/advisory/mine');state.advisory=mine.items;const root=$('#advisory-mine');root.replaceChildren();if(!mine.items.length)root.append(text('p','这个浏览器还没有匿名辅导记录。','meta'));for(const item of mine.items)root.append(adviceBlock(item,true));const reports=await api('/api/advisory/reports?limit=14');const rr=$('#advisory-reports');rr.replaceChildren();if(!reports.items.length)rr.append(text('p','尚无公开日报。个案正文不会出现在这里。','meta'));for(const r of reports.items){const c=cardBase(r.day,`收到 ${r.receivedCount} · 已建议 ${r.advisedCount} · 待处理 ${r.pendingCount}`);c.append(text('p',r.statement));const cats=Object.entries(r.categories||{});if(cats.length)c.append(text('small',cats.map(([k,v])=>`${k} ${v}`).join(' · ')));c.append(text('small',r.privacy));rr.append(c)}}catch(e){toast(e.message,true)}
}
function showReceipt(code){const box=$('#advisory-receipt');box.replaceChildren();box.classList.remove('hidden');box.append(text('strong','请把这个匿名回执码保存好（只显示这一次）'));const c=document.createElement('code');c.textContent=code;box.append(c,text('small','后台只保存哈希。清理 Cookie 或更换设备后，可以用这个回执码回来查看建议。'))}

async function loadReview(){
  if(!state.reviewToken){toast('请输入审核令牌',true);return}
  try{const d=await api('/api/review-queue',{token:state.reviewToken});const root=$('#review-list');root.replaceChildren();for(const item of d.items){const c=cardBase(item.title,`${item.kind} · ${evidenceLabel(item.evidence)} · ${statusLabel(item.status)} · v${item.version}`);c.append(text('p',item.description));if(item.flags?.length){const b=document.createElement('div');b.className='badges';b.append(badge(`待处理纠错 ${item.flags.length}`,'negative'));c.append(b)}const controls=document.createElement('div');controls.className='review-controls';const evidenceOptions=['E0','E1','E2','E3','E4','E5'].map(level=>`<option${level===item.evidence?' selected':''}>${level}</option>`).join('');controls.innerHTML=`<label>证据等级<select data-review-field="evidence">${evidenceOptions}</select></label><label>决定<select data-review-field="decision"><option value="approve">通过</option><option value="reject">拒绝</option><option value="dispute">争议</option><option value="reopen">重开</option></select></label><label class="wide">审核理由<textarea data-review-field="rationale">依据当前版本与所列来源完成范围核对；此审核只支持具体主张，不扩展为公司整体判断。</textarea></label><label><input type="checkbox" data-review-field="scopeChecked" checked> 已核对范围</label><label><input type="checkbox" data-review-field="authenticityChecked" checked> 已核对来源真实性</label>`;const act=document.createElement('div');act.className='card-actions';const review=document.createElement('button');review.className='primary';review.textContent='提交审核';review.dataset.reviewAction='review';review.dataset.id=item.id;review.dataset.version=item.version;const exp=document.createElement('button');exp.className='secondary';exp.textContent='独立批准再分发';exp.dataset.reviewAction='export';exp.dataset.id=item.id;exp.dataset.version=item.version;act.append(review,exp);c.append(controls,act);root.append(c)}if(!d.items.length)root.append(text('p','当前没有审核记录。','meta'))}catch(e){toast(e.message,true)}
}

document.addEventListener('click',async e=>{
  const detail=e.target.closest('[data-company-detail]');if(detail){await openCompanyDetail(detail.dataset.companyDetail);return}
  const contribute=e.target.closest('[data-company-contribute]');if(contribute){openContributionForCompany(contribute.dataset.companyContribute);return}
  const share=e.target.closest('[data-company-share]');if(share){await copyCompanyShareUrl(share.dataset.companyShare);return}
  const close=e.target.closest('[data-company-close]');if(close){closeCompanyDetail();return}
  const tab=e.target.closest('[data-tab]');if(tab){e.preventDefault();switchTab(tab.dataset.tab);return}
  const issue=e.target.closest('[data-issue]');if(issue){state.focusIssue=issue.dataset.issue;switchTab('rights');return}
  const rf=e.target.closest('[data-resource-group]');if(rf){state.resourceGroup=rf.dataset.resourceGroup;renderResourceFilters();renderResources();return}
  const tagButton=e.target.closest('[data-resource-tags]');if(tagButton){state.resourceGroup='all';renderResourceFilters();switchTab('resources');renderResources(tagButton.dataset.resourceTags.split(',').filter(Boolean));return}
  const lane=e.target.closest('[data-lane]');if(lane){state.lane=lane.dataset.lane;$$('[data-lane]').forEach(x=>x.classList.toggle('lane-active',x===lane));loadDiscover();return}
  const ballot=e.target.closest('[data-ballot]');if(ballot){try{await api(`/api/companies/${ballot.dataset.company}/ballot`,{method:'POST',body:{direction:ballot.dataset.ballot||null}});toast('你的社区反馈已更新；它不会改变证据等级。');await loadCompanies();if(ballot.dataset.detailBallot==='1'&&state.activeCompanyId===ballot.dataset.company)await openCompanyDetail(ballot.dataset.company,{updateHash:false});else if(location.hash==='#discover')loadDiscover()}catch(err){toast(err.message,true)}return}
  const mine=e.target.closest('[data-mine-action]');if(mine){try{if(mine.dataset.mineAction==='edit')return editContribution(mine.dataset.id);if(mine.dataset.mineAction==='withdraw'){if(!confirm('确认撤回这条公开线索？'))return;await api(`/api/contributions/${mine.dataset.id}/withdraw`,{method:'POST',body:{}});toast('已撤回');loadMine();return}if(mine.dataset.mineAction==='flag'){const reason=prompt('请具体说明哪里需要纠正（不要写私人联系方式）：');if(!reason)return;await api(`/api/contributions/${mine.dataset.id}/flag`,{method:'POST',body:{reason}});toast('纠错已进入复核队列');loadMine();return}}catch(err){toast(err.message,true)}return}
  const rev=e.target.closest('[data-review-action]');if(rev){const card=rev.closest('.card');try{if(rev.dataset.reviewAction==='review'){const val=n=>card.querySelector(`[data-review-field="${n}"]`);const queue=await api('/api/review-queue',{token:state.reviewToken});const item=queue.items.find(x=>x.id===rev.dataset.id);const body={version:Number(rev.dataset.version),decision:val('decision').value,evidence:val('evidence').value,rationale:val('rationale').value,scopeChecked:val('scopeChecked').checked,authenticityChecked:val('authenticityChecked').checked,sourceIds:(item?.sources||[]).map(x=>x.id),effective:false,decisionReference:''};await api(`/api/contributions/${rev.dataset.id}/review`,{method:'POST',body,token:state.reviewToken});toast('审核已保存；证据等级仍只适用于具体主张。')}else{await api(`/api/contributions/${rev.dataset.id}/approve-export`,{method:'POST',body:{version:Number(rev.dataset.version),privacyChecked:true,rightsChecked:true,reason:'独立检查结构化摘要的隐私与再分发权利边界。'},token:state.exportToken});toast('已通过独立再分发复核')}}catch(err){toast(err.message,true)}loadReview();return}
  const aw=e.target.closest('[data-advisory-withdraw]');if(aw){try{if(!confirm('确认撤回这条匿名辅导？'))return;await api(`/api/advisory/${aw.dataset.advisoryWithdraw}/withdraw`,{method:'POST',body:{}});toast('匿名辅导已撤回');loadAdvisory()}catch(err){toast(err.message,true)}return}
  if(e.target.id==='refresh-discover')loadDiscover();if(e.target.id==='refresh-mine')loadMine();if(e.target.id==='refresh-advisory')loadAdvisory();if(e.target.id==='cancel-edit')resetContributionForm();
});

$('#company-detail-dialog')?.addEventListener('cancel',e=>{e.preventDefault();closeCompanyDetail()});
$('#company-detail-dialog')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeCompanyDetail()});

$('#company-search')?.addEventListener('input',renderCompanies);
$('#company-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{const d=await api('/api/companies',{method:'POST',body:{name:String(f.get('name')||''),region:String(f.get('region')||''),website:String(f.get('website')||''),consent:true}});const autoQueued=d.researchQueued===true||['QUEUED','COLLECTING'].includes(d.research?.status);toast(d.duplicate?'这个公司空间已经有了，你可以直接补充资料。':autoQueued?'已创建。公开资料会自动开始整理，你不用再做设置。':'已创建公司空间。');form.reset();if(autoQueued)researchPollRemaining=36;await loadCompanies();if(d.company?.id&&$('#company-select'))$('#company-select').value=d.company.id;if(autoQueued)armResearchPolling({reset:true})}catch(err){toast(err.message,true)}});
$('#contribution-form')?.addEventListener('submit',async e=>{e.preventDefault();try{const body=contributionPayload(e.currentTarget);if(state.editId)await api(`/api/contributions/${state.editId}`,{method:'PATCH',body});else await api('/api/contributions',{method:'POST',body});toast(state.editId?'已修改。系统会把它重新当作未核实线索。':'已保存。你不需要再补一大堆字段；有更多资料时随时回来补。');resetContributionForm();switchTab('mine')}catch(err){toast(err.message,true)}});
$('#community-feedback-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);try{await api('/api/community-feedback',{method:'POST',body:{type:String(f.get('type')||'suggestion'),companyId:String(f.get('companyId')||''),message:String(f.get('message')||''),consent:true}});toast('收到了。每天 18:00 Agent 会统一处理，19:00 会再检查一次有没有遗漏。');form.reset();renderFeedbackCompanySelect();await loadCommunityUpdates()}catch(err){toast(err.message,true)}});
$('#advisory-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;try{const d=await api('/api/advisory',{method:'POST',body:advisoryPayload(form)});showReceipt(d.receiptCode);toast('已经记录。请保存回执码；你的个案正文不会进入公开日报。');form.reset();renderAdvisoryCompanySelect();await loadAdvisory()}catch(err){toast(err.message,true)}});
$('#advisory-access-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const root=$('#advisory-access-result');root.replaceChildren();try{const d=await api('/api/advisory/access',{method:'POST',body:{receiptCode:String(f.get('receiptCode')||'').trim()}});root.append(adviceBlock(d.item));toast('已找到这条匿名辅导')}catch(err){toast(err.message,true)}});
$('#review-auth')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.reviewToken=String(f.get('reviewToken')||'');state.exportToken=String(f.get('exportToken')||'');loadReview()});

boot();
