import crypto from 'node:crypto';

export const AUTONOMOUS_INTELLIGENCE_POLICY_VERSION='auto-intelligence-0.8.3';
const POLICY_VERSION=AUTONOMOUS_INTELLIGENCE_POLICY_VERSION;
const LABOR_SIGNAL_POLICY={
  NLRB_CASES:{category:'labor_events',label:'NLRB案件/程序记录',caveat:'案件、charge或petition的存在不等于NLRB已认定雇主违法；同名主体、门店或子公司仍可能需要区分。'},
  OSHA_ENFORCEMENT:{category:'labor_events',label:'OSHA检查记录',caveat:'检查记录只说明公开数据中存在同名establishment记录；检查、citation或罚款不能外推为公司整体劳动条件。'},
  DOL_WHD:{category:'labor_events',label:'WHD已结案合规行动记录',caveat:'仅说明公开数据中存在同名雇主的具体结案行动记录；范围限于对应案件、地点和期间。'},
  FMCS_F7:{category:'labor_relations',label:'FMCS F-7集体谈判通知',caveat:'F-7是集体谈判通知/关系记录，不是违法认定。'},
  NLRB_VOLUNTARY_RECOGNITION:{category:'labor_relations',label:'NLRB voluntary-recognition记录',caveat:'该记录表示代表权/认可事件，不表示劳动条件优劣或违法。'},
  FMCS_WORK_STOPPAGES:{category:'labor_relations',label:'FMCS work-stoppage记录',caveat:'停工记录证明公开事件记录存在；事件原因、责任、合法性和结果不能由名称匹配自动推出。'},
  OLMS_LM20:{category:'labor_relations',label:'DOL OLMS披露记录',caveat:'OLMS记录是法定披露/安排记录，不能自动表述为不公平劳动行为认定。'}
};

function norm(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();}
function bounded(value,max=300){return String(value??'').slice(0,max);}
function stableHash(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function validLei(value){
  const lei=String(value||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{18}[0-9]{2}$/.test(lei))return false;
  let remainder=0n;
  for(const ch of lei){
    const digits=/[A-Z]/.test(ch)?String(ch.charCodeAt(0)-55):ch;
    for(const d of digits)remainder=(remainder*10n+BigInt(d))%97n;
  }
  return remainder===1n;
}
function validCik(value){return /^\d{10}$/.test(String(value||''));}
export function countryCode(value){
  const key=norm(value).replace(/[._-]/g,' ');
  const map=new Map([
    ['us','US'],['usa','US'],['united states','US'],['united states of america','US'],['美国','US'],
    ['cn','CN'],['china','CN'],['中国','CN'],['中华人民共和国','CN'],["people's republic of china",'CN'],['中国大陆','CN'],['mainland china','CN'],
    ['gb','GB'],['uk','GB'],['united kingdom','GB'],['英国','GB'],['ca','CA'],['canada','CA'],['加拿大','CA'],
    ['au','AU'],['australia','AU'],['澳大利亚','AU'],['de','DE'],['germany','DE'],['德国','DE'],
    ['fr','FR'],['france','FR'],['法国','FR'],['jp','JP'],['japan','JP'],['日本','JP'],
    ['kr','KR'],['south korea','KR'],['korea','KR'],['韩国','KR'],['sg','SG'],['singapore','SG'],['新加坡','SG'],
    ['hk','HK'],['hong kong','HK'],['香港','HK'],['tw','TW'],['taiwan','TW'],['台湾','TW'],
    ['in','IN'],['india','IN'],['印度','IN'],['br','BR'],['brazil','BR'],['巴西','BR'],
    ['mx','MX'],['mexico','MX'],['墨西哥','MX'],['ch','CH'],['switzerland','CH'],['瑞士','CH'],
    ['nl','NL'],['netherlands','NL'],['荷兰','NL']
  ]);
  if(/^[a-z]{2}$/.test(key))return key.toUpperCase();
  if(map.has(key))return map.get(key);
  const first=key.split(/[·,，/|]/)[0].trim();
  if(/^[a-z]{2}$/.test(first))return first.toUpperCase();
  if(map.has(first))return map.get(first);
  for(const [label,code] of map){
    if(key.startsWith(label+' ')||key.startsWith(label+' ·')||key.startsWith(label+',')||key.startsWith(label+'，'))return code;
  }
  return null;
}
function providerMap(record){return new Map((record.providers||[]).map(x=>[x.provider,x]));}
function exactCandidates(provider,companyName){return (provider?.candidates||[]).filter(x=>x?.match==='EXACT_NAME'||norm(x?.label)===norm(companyName));}
function sourceMeta(provider){return provider?.source?{sourceOfRecord:bounded(provider.source.sourceOfRecord,120),official:bounded(provider.source.official,300)}:null;}
function factId(type,provider,key){return 'mf_'+stableHash([type,provider,key]).slice(0,18);}
function signalId(provider,key){return 'ms_'+stableHash([provider,key]).slice(0,18);}
function clusterId(label){return 'mc_'+stableHash(norm(label)).slice(0,18);}
function eventId(provider,key){return 'me_'+stableHash([provider,key]).slice(0,18);}
function safeDomain(value){try{return new URL(String(value||'')).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}}
function uniqueStrings(values,max=8){return [...new Set((values||[]).map(x=>bounded(x,180)).filter(Boolean))].slice(0,max);}
function dateValue(value){const s=String(value||'').trim();const m=s.match(/^\d{4}(?:-\d{2})?(?:-\d{2})?/);return m?m[0]:'';}
function eventRecord(provider,p,record,index,config){
  const key=config.key(record,index);return {
    id:eventId(provider,key),tier:'SOURCE_EVENT_CANDIDATE',category:config.category,provider,source:sourceMeta(p),
    date:dateValue(config.date(record)),endDate:dateValue(config.endDate?.(record)),title:bounded(config.title(record),240),
    location:bounded(config.location?.(record),180),status:bounded(config.status?.(record),120),detail:bounded(config.detail?.(record),600),
    reference:bounded(config.reference?.(record),120),recordUrl:bounded(config.recordUrl?.(record),300),
    caveat:bounded(config.caveat,600),entityScope:'EXACT_NAME_SOURCE_CANDIDATE'
  };
}
function eventTimeline(providers,companyName){
  const configs={
    NLRB_CASES:{category:'labor_case',date:r=>r.date_filed,endDate:r=>r.date_closed,key:(r,i)=>r.case_number||i,title:r=>`NLRB 案件 / 程序记录${r.case_number?` · ${r.case_number}`:''}`,location:r=>[r.city,r.state].filter(Boolean).join(', '),status:r=>r.status||r.reason_closed,detail:r=>r.case_type?`案件类型：${r.case_type}`:'',reference:r=>r.case_number,recordUrl:r=>/^https:\/\//.test(String(r.url||''))?r.url:'',caveat:LABOR_SIGNAL_POLICY.NLRB_CASES.caveat},
    OSHA_ENFORCEMENT:{category:'safety_inspection',date:r=>r.open_date,endDate:r=>r.close_case_date,key:(r,i)=>r.activity_nr||i,title:r=>`OSHA 检查记录${r.activity_nr?` · ${r.activity_nr}`:''}`,location:r=>[r.site_city,r.site_state].filter(Boolean).join(', '),detail:r=>[r.insp_type&&`类型 ${r.insp_type}`,r.insp_scope&&`范围 ${r.insp_scope}`,r.naics_code&&`NAICS ${r.naics_code}`].filter(Boolean).join(' · '),reference:r=>r.activity_nr,caveat:LABOR_SIGNAL_POLICY.OSHA_ENFORCEMENT.caveat},
    DOL_WHD:{category:'wage_hour_action',date:r=>r.findings_start_date,endDate:r=>r.findings_end_date,key:(r,i)=>r.case_id||i,title:r=>`WHD 已结案合规行动${r.case_id?` · ${r.case_id}`:''}`,location:r=>[r.cty_nm,r.st_cd].filter(Boolean).join(', '),detail:r=>[r.naics_code_description,r.case_violtn_cnt!=null&&`记录违规项 ${r.case_violtn_cnt}`,r.ee_violtd_cnt!=null&&`涉及员工 ${r.ee_violtd_cnt}`,r.bw_atp_amt!=null&&`欠薪记录金额 ${r.bw_atp_amt}`,r.cmp_assd!=null&&`民事罚款记录金额 ${r.cmp_assd}`].filter(Boolean).join(' · '),reference:r=>r.case_id,caveat:LABOR_SIGNAL_POLICY.DOL_WHD.caveat},
    FMCS_F7:{category:'collective_bargaining',date:r=>r.notice_date,endDate:r=>r.expiration_date,key:(r,i)=>[r.notice_date,r.employer,r.union_name,i],title:r=>'FMCS F-7 集体谈判通知',location:r=>[r.affected_location_city||r.employer_city,r.affected_location_state||r.employer_state].filter(Boolean).join(', '),detail:r=>[r.union_name&&`工会 ${r.union_name}`,r.industry,r.bargaining_unit_size!=null&&`谈判单位规模 ${r.bargaining_unit_size}`].filter(Boolean).join(' · '),caveat:LABOR_SIGNAL_POLICY.FMCS_F7.caveat},
    NLRB_VOLUNTARY_RECOGNITION:{category:'representation',date:r=>r['Date VR Request Received']||r['Date of Voluntary Recogition'],key:(r,i)=>r['VR Case Number']||i,title:r=>`NLRB voluntary-recognition 记录${r['VR Case Number']?` · ${r['VR Case Number']}`:''}`,location:r=>[r['Unit City'],r['Unit State']].filter(Boolean).join(', '),detail:r=>[r['Union']&&`工会 ${r['Union']}`,r['Number of Employees']!=null&&`单位员工数 ${r['Number of Employees']}`,r['Unit Description']].filter(Boolean).join(' · '),reference:r=>r['VR Case Number'],caveat:LABOR_SIGNAL_POLICY.NLRB_VOLUNTARY_RECOGNITION.caveat},
    FMCS_WORK_STOPPAGES:{category:'work_stoppage',date:r=>r['Start Date'],endDate:r=>r['End Date'],key:(r,i)=>r['Case Number']||[r['Start Date'],i],title:r=>`FMCS 停工记录${r['Case Number']?` · ${r['Case Number']}`:''}`,location:r=>r['City, State'],detail:r=>[r['Union']&&`工会 ${r['Union']}`,r['# Idled']!=null&&`记录停工人数 ${r['# Idled']}`,r['Duration']&&`持续 ${r['Duration']}`,r['Industry']].filter(Boolean).join(' · '),reference:r=>r['Case Number'],caveat:LABOR_SIGNAL_POLICY.FMCS_WORK_STOPPAGES.caveat},
    OLMS_LM20:{category:'labor_disclosure',date:r=>r.termDate,key:(r,i)=>r.rptId||i,title:r=>`DOL OLMS 披露记录${r.rptId?` · ${r.rptId}`:''}`,location:r=>[r.city,r.state].filter(Boolean).join(', '),detail:r=>r.amount!=null?`公开披露金额字段：${r.amount}`:'',reference:r=>r.rptId,caveat:LABOR_SIGNAL_POLICY.OLMS_LM20.caveat}
  };
  const events=[];
  for(const [providerName,config] of Object.entries(configs)){
    const p=providers.get(providerName);if(p?.status!=='OK')continue;
    const exact=exactCandidates(p,companyName);
    for(const c of exact)for(const [index,record] of (c.records||[]).slice(0,6).entries())events.push(eventRecord(providerName,p,record,index,config));
  }
  const seen=new Set();return events.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;}).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||a.id.localeCompare(b.id)).slice(0,30);
}

function candidateClusters(record){
  const groups=new Map();
  for(const p of record?.providers||[]){
    if(p.status!=='OK')continue;
    for(const c of p.candidates||[]){
      const key=norm(c?.label);if(!key)continue;
      const old=groups.get(key)||{id:clusterId(key),label:bounded(c.label,180),providers:[],candidateCount:0,totalMatchedRecords:0,exactNameProviders:[]};
      if(!old.providers.includes(p.provider))old.providers.push(p.provider);
      old.candidateCount++;
      old.totalMatchedRecords+=Math.max(1,Number(c.matches||1));
      if((c?.match==='EXACT_NAME'||key===norm(record?.companyName))&&!old.exactNameProviders.includes(p.provider))old.exactNameProviders.push(p.provider);
      groups.set(key,old);
    }
  }
  return [...groups.values()].sort((a,b)=>b.providers.length-a.providers.length||b.totalMatchedRecords-a.totalMatchedRecords||a.label.localeCompare(b.label)).slice(0,12);
}

export function buildAutonomousIntelligence(company,record,{now=new Date()}={}){
  const providers=providerMap(record);
  const generatedAt=now.toISOString();
  const companyCountry=countryCode(company?.region);
  const conflicts=[];
  const facts=[];
  const signals=[];
  const contextReferences=[];
  const contextCandidates=[];
  const gleif=providers.get('GLEIF');
  const gleifExact=exactCandidates(gleif,company?.name);
  let identity={status:'NO_VERIFIED_REFERENCE',confidence:'NONE',provider:'GLEIF',reason:'本轮没有唯一且无已知地区冲突的GLEIF精确名称候选。',reference:null};

  if(gleif?.status==='ERROR'){
    identity={...identity,status:'SOURCE_GAP',reason:'GLEIF本轮不可用，保持未知，不沿用旧身份结论。'};
  }else if(!companyCountry){
    identity={...identity,status:'COUNTRY_HINT_REQUIRED',confidence:'NONE',reason:'公司空间没有可机器解析的国家/地区提示；即使存在同名法律实体，也不自动选择。'};
    if(gleifExact.length)conflicts.push({code:'COUNTRY_HINT_REQUIRED',provider:'GLEIF',count:gleifExact.length,message:'缺少可解析国家提示，GLEIF同名候选保持未绑定。'});
  }else if(gleifExact.length>1){
    identity={...identity,status:'AMBIGUOUS',confidence:'LOW',reason:'GLEIF返回多个精确法律名称候选，自动系统不选择其一。'};
    conflicts.push({code:'MULTIPLE_EXACT_GLEIF_MATCHES',provider:'GLEIF',count:gleifExact.length,message:'存在多个精确法律名称候选，未自动绑定。'});
  }else if(gleifExact.length===1){
    const candidate=gleifExact[0];const candidateCountry=countryCode(candidate.region);
    if(!validLei(candidate.externalId)){
      identity={...identity,status:'SOURCE_SCHEMA_CONFLICT',confidence:'LOW',reason:'GLEIF候选的LEI格式或校验码无效，自动系统不绑定。'};
      conflicts.push({code:'GLEIF_LEI_INVALID',provider:'GLEIF',message:'GLEIF候选未通过LEI格式/校验码检查，未自动绑定。'});
    }else if(!candidateCountry){
      identity={...identity,status:'COUNTRY_CONFLICT',confidence:'LOW',reason:'GLEIF精确名称候选缺少可验证的国家字段，自动系统不绑定。'};
      conflicts.push({code:'GLEIF_COUNTRY_MISSING',provider:'GLEIF',expected:companyCountry,message:'GLEIF候选缺少可验证国家字段，未自动绑定。'});
    }else if(companyCountry!==candidateCountry){
      identity={...identity,status:'COUNTRY_CONFLICT',confidence:'LOW',reason:'公司空间地区与GLEIF候选登记国家冲突，未自动绑定。'};
      conflicts.push({code:'GLEIF_COUNTRY_CONFLICT',provider:'GLEIF',expected:companyCountry,observed:candidateCountry,message:'地区冲突，未自动绑定。'});
    }else{
      const ref={legalName:bounded(candidate.label,180),lei:bounded(candidate.externalId,40),country:bounded(candidate.region,8),jurisdiction:bounded(candidate.jurisdiction,40),entityStatus:bounded(candidate.entityStatus,30),registrationStatus:bounded(candidate.registrationStatus,30)};
      identity={status:'AUTO_BOUND_REFERENCE',confidence:'HIGH',provider:'GLEIF',reason:'GLEIF本轮只有一个精确法律名称候选，且登记国家与公司空间的国家提示一致。该结论仅作为法律实体参考绑定。',reference:ref};
      const fields=[['legal_name','法律名称',ref.legalName],['lei','LEI',ref.lei],['country','GLEIF登记国家/地区',ref.country],['jurisdiction','法律辖区',ref.jurisdiction],['entity_status','GLEIF实体状态',ref.entityStatus],['registration_status','LEI维护状态',ref.registrationStatus]];
      for(const [type,label,value] of fields){if(!value)continue;facts.push({id:factId(type,'GLEIF',value),tier:'MACHINE_VERIFIED_REFERENCE',category:'identity',type,text:`${label}：${value}`,provider:'GLEIF',source:sourceMeta(gleif),confidence:'HIGH',scope:'GLEIF法律实体参考记录',caveat:type==='registration_status'?'LEI维护状态不是企业合法性、劳动条件或质量评级。':'该字段只描述本轮GLEIF参考记录，不代表平台掌握全部关联主体。'});}
    }
  }

  const sec=providers.get('SEC_EDGAR');
  const secExact=exactCandidates(sec,company?.name);
  if(identity.status==='AUTO_BOUND_REFERENCE'&&countryCode(identity.reference?.country)==='US'&&sec?.status==='OK'&&secExact.length===1&&validCik(secExact[0].externalId)){
    const c=secExact[0];const cik=bounded(c.externalId,20);const ticker=bounded(c.ticker,24);
    facts.push({id:factId('sec_reference','SEC_EDGAR',cik),tier:'MACHINE_VERIFIED_REFERENCE',category:'identity',type:'sec_reference',text:`SEC公开申报主体参考：CIK ${cik}${ticker?`；Ticker ${ticker}`:''}`,provider:'SEC_EDGAR',source:sourceMeta(sec),confidence:'HIGH',scope:'SEC company ticker directory exact-name reference',caveat:'该引用只表示SEC目录中的同名申报主体参考，不代表对公司经营、合规或劳动条件的评级。'});
  }else if(sec?.status==='OK'&&secExact.length===1){
    const c=secExact[0];signals.push({id:signalId('SEC_EDGAR',c.externalId),tier:'SOURCE_SIGNAL',category:'identity_context',provider:'SEC_EDGAR',source:sourceMeta(sec),text:`SEC公司目录返回 1 个与公司空间名称完全一致的候选${c.ticker?`（Ticker ${bounded(c.ticker,24)}）`:''}。`,recordCount:1,confidence:'MEDIUM',scope:'SEC目录名称匹配',caveat:'未满足自动实体绑定条件，因此仅作为来源信号。'});
  }else if(secExact.length>1){conflicts.push({code:'MULTIPLE_EXACT_SEC_MATCHES',provider:'SEC_EDGAR',count:secExact.length,message:'SEC存在多个精确名称候选，未自动绑定。'});}

  for(const [providerName,policy] of Object.entries(LABOR_SIGNAL_POLICY)){
    const p=providers.get(providerName);if(p?.status!=='OK')continue;
    const exact=exactCandidates(p,company?.name);if(!exact.length)continue;
    const count=exact.reduce((n,x)=>n+Math.max(1,Number(x.matches||0)),0);
    const labels=[...new Set(exact.map(x=>bounded(x.label,180)).filter(Boolean))].sort();
    signals.push({id:signalId(providerName,[labels,count]),tier:'SOURCE_SIGNAL',category:policy.category,provider:providerName,source:sourceMeta(p),text:`${policy.label}：公开来源本轮返回 ${count} 条名称与公司空间名称精确一致的记录。`,recordCount:count,confidence:'MEDIUM',scope:'精确名称来源信号；不是跨主体法律绑定',caveat:policy.caveat});
  }

  const usa=providers.get('USA_SPENDING');const usaExact=exactCandidates(usa,company?.name);
  if(usa?.status==='OK'&&usaExact.length===1){signals.push({id:signalId('USA_SPENDING',usaExact[0].externalId),tier:'SOURCE_SIGNAL',category:'business_context',provider:'USA_SPENDING',source:sourceMeta(usa),text:'USAspending recipient搜索返回与公司空间名称完全一致的收款方候选。',recordCount:1,confidence:'MEDIUM',scope:'recipient名称候选',caveat:'当前自动来源只完成recipient候选搜索；未查询并绑定具体award前，不表述政府客户/合同事实。'});}

  const wikidata=providers.get('WIKIDATA');
  if(wikidata?.status==='OK'){
    const candidates=wikidata.candidates||[];const companyDomain=safeDomain(company?.website);
    const compatible=candidates.filter(c=>{
      const exact=c.match==='EXACT_NAME'||norm(c.label)===norm(company?.name);const candidateCountry=countryCode(c.region||c.countryLabels?.[0]);
      const countryMatch=Boolean(exact&&companyCountry&&candidateCountry&&companyCountry===candidateCountry);
      const websiteMatch=Boolean(companyDomain&&safeDomain(c.officialWebsite)&&companyDomain===safeDomain(c.officialWebsite));
      const structuredOrganization=Boolean(c.officialWebsite&&(c.legalForm||(c.industries||[]).length||(c.exchanges||[]).length||(c.headquarters||[]).length||(c.products||[]).length));
      const uniqueCorporateShorthand=Boolean(!exact&&c.matchBasis==='Wikidata shortened-name search'&&candidates.length===1&&companyCountry&&candidateCountry&&companyCountry===candidateCountry&&structuredOrganization);
      return countryMatch||websiteMatch||uniqueCorporateShorthand;
    });
    if(compatible.length===1){
      const c=compatible[0];const candidateCountry=countryCode(c.region||c.countryLabels?.[0]);const exact=c.match==='EXACT_NAME'||norm(c.label)===norm(company?.name);const websiteMatch=Boolean(companyDomain&&safeDomain(c.officialWebsite)&&companyDomain===safeDomain(c.officialWebsite));
      const basis=websiteMatch?'OFFICIAL_WEBSITE_DOMAIN_MATCH':exact&&companyCountry&&candidateCountry===companyCountry?'EXACT_NAME_AND_COUNTRY_MATCH':'UNIQUE_CORPORATE_SHORTHAND_AND_COUNTRY';
      contextReferences.push({
        id:signalId('WIKIDATA_CONTEXT',c.externalId||c.label),tier:'OPEN_KNOWLEDGE_CONTEXT',provider:'WIKIDATA',source:sourceMeta(wikidata),
        label:bounded(c.label,180),reference:bounded(c.externalId,40),description:bounded(c.description,300),countryLabels:uniqueStrings(c.countryLabels,4),
        officialWebsite:bounded(c.officialWebsite,300),inception:bounded(c.inception,20),industries:uniqueStrings(c.industries,6),headquarters:uniqueStrings(c.headquarters,6),
        parents:uniqueStrings(c.parents,6),products:uniqueStrings(c.products,8),exchanges:uniqueStrings(c.exchanges,5),legalForm:bounded(c.legalForm,120),wikipediaUrl:bounded(c.wikipediaUrl,300),
        searchQuery:bounded(c.searchQuery,160),confidence:basis==='UNIQUE_CORPORATE_SHORTHAND_AND_COUNTRY'?'LOW_MEDIUM':'MEDIUM',basis,
        caveat:basis==='UNIQUE_CORPORATE_SHORTHAND_AND_COUNTRY'?'这是唯一公司简称搜索结果，并具有国家一致与组织结构信号；它只作为可能对应的开放知识上下文，不等于平台已确认法律主体。':'这是 Wikidata 开放知识图谱的结构化上下文，不是官方工商登记或劳动事实来源；字段可能不完整，冲突时以更高权威来源为准。'
      });
    }else if(compatible.length>1)conflicts.push({code:'MULTIPLE_WIKIDATA_CONTEXT_MATCHES',provider:'WIKIDATA',count:compatible.length,message:'Wikidata 有多个同时满足上下文匹配条件的候选，系统未自动选择。'});
    for(const c of candidates.slice(0,5)){
      if(contextReferences.some(x=>x.reference===c.externalId))continue;
      contextCandidates.push({
        id:signalId('WIKIDATA',c.externalId||c.label),tier:'CONTEXT_CANDIDATE',provider:'WIKIDATA',source:sourceMeta(wikidata),label:bounded(c.label,180),reference:bounded(c.externalId,40),description:bounded(c.description,300),
        countryLabels:uniqueStrings(c.countryLabels,4),officialWebsite:bounded(c.officialWebsite,300),inception:bounded(c.inception,20),industries:uniqueStrings(c.industries,6),headquarters:uniqueStrings(c.headquarters,6),parents:uniqueStrings(c.parents,6),products:uniqueStrings(c.products,8),exchanges:uniqueStrings(c.exchanges,5),legalForm:bounded(c.legalForm,120),wikipediaUrl:bounded(c.wikipediaUrl,300),
        searchQuery:bounded(c.searchQuery,160),match:c.match==='EXACT_NAME'?'EXACT_NAME':'CANDIDATE',matchBasis:bounded(c.matchBasis,220),caveat:'Wikidata 是开放上下文知识图谱；该候选不覆盖官方登记/申报来源，也不自动成为公司法律、经营或劳动事实。'
      });
    }
  }

  const timeline=eventTimeline(providers,company?.name);
  facts.sort((a,b)=>a.id.localeCompare(b.id));signals.sort((a,b)=>a.id.localeCompare(b.id));contextReferences.sort((a,b)=>a.id.localeCompare(b.id));contextCandidates.sort((a,b)=>a.id.localeCompare(b.id));conflicts.sort((a,b)=>a.code.localeCompare(b.code));
  const clusters=candidateClusters({...record,companyName:company?.name});
  const contextCandidateCount=(record.providers||[]).reduce((n,p)=>n+(p.candidates||[]).filter(c=>!exactCandidates({candidates:[c]},company?.name).length).length,0)+contextCandidates.length;
  const sourceNotApplicableCount=Number(record.sourceNotApplicableCount||(record.providers||[]).filter(x=>x.status==='NOT_APPLICABLE').length||0);
  const gaps=[];
  if(identity.status!=='AUTO_BOUND_REFERENCE')gaps.push({code:'LEGAL_IDENTITY_UNRESOLVED',label:'法律主体尚未自动确认',detail:identity.reason});
  if(!contextReferences.length)gaps.push({code:'NO_BOUND_OPEN_CONTEXT',label:'开放知识上下文尚未绑定',detail:contextCandidates.length?'已找到可能相关的上下文候选，但系统不会自动选择。':'当前开放知识来源没有足够明确的公司上下文。'});
  if(Number(record.sourceErrorCount||0)>0)gaps.push({code:'SOURCE_GAPS',label:'部分适用来源当前不可用',detail:`本轮有 ${Number(record.sourceErrorCount||0)} 个适用来源发生超时、拒绝访问或服务异常；其他已成功来源结果仍然保留。`});
  if(sourceNotApplicableCount>0)gaps.push({code:'REGION_LIMITED_SOURCES',label:'部分来源不适用于当前地区',detail:`有 ${sourceNotApplicableCount} 个地区限定来源未执行，未执行不会被当成“没有记录”。`});
  if(!timeline.length&&companyCountry==='US')gaps.push({code:'NO_PUBLIC_EVENT_CANDIDATES',label:'本轮没有可展示的美国劳动公共记录事件候选',detail:'这只表示当前接入来源本轮没有名称精确匹配事件，不代表不存在其他记录。'});
  const dossierStatus=identity.status==='AUTO_BOUND_REFERENCE'?'REFERENCE_READY':contextReferences.length?'CONTEXT_READY':(signals.length||timeline.length)?'SIGNALS_READY':'LIMITED_DATA';
  const summary=identity.status==='AUTO_BOUND_REFERENCE'
    ?`已自动匹配法律实体参考；当前有 ${facts.length} 个窄范围机器参考字段、${signals.length} 个来源信号${timeline.length?`、${timeline.length} 条公共记录事件候选`:''}。`
    :contextReferences.length
      ?`尚未形成官方法律实体绑定，但已找到 1 个满足限定匹配规则的开放知识上下文；${signals.length||timeline.length?`同时有 ${signals.length} 个来源信号、${timeline.length} 条事件候选。`:''}`
      :`当前不能可靠确认法律主体${contextCandidates.length?`；已找到 ${contextCandidates.length} 个开放上下文候选`:''}${clusters.length?`和 ${clusters.length} 组来源候选聚类`:''}，系统不会自动猜测。`;
  const dossier={status:dossierStatus,summary,updatedAt:generatedAt,legalIdentityStatus:identity.status,openContextCount:contextReferences.length,eventCount:timeline.length,gaps,sourceCoverage:{successful:Number(record.sourceSuccessCount||0),errors:Number(record.sourceErrorCount||0),notApplicable:sourceNotApplicableCount,total:(record.providers||[]).length}};
  const payload={policyVersion:POLICY_VERSION,identity,facts,signals,contextReferences,contextCandidates,timeline,dossier,conflicts,clusters,coverage:{machineVerifiedFacts:facts.length,sourceSignals:signals.length,openContextReferences:contextReferences.length,publicEventCandidates:timeline.length,contextCandidates:contextCandidateCount,sourceSuccessCount:Number(record.sourceSuccessCount||0),sourceErrorCount:Number(record.sourceErrorCount||0),sourceNotApplicableCount},boundary:'机器只自动发布可重复验证的窄范围参考事实与来源信号；开放知识上下文与公共记录事件候选保留自身来源层级；主体歧义、来源冲突、法律结论和未绑定上下文保持候选或未知。'};
  const fingerprint=stableHash(payload);
  return {...payload,generatedAt,fingerprint,status:facts.length?'MACHINE_INTELLIGENCE_READY':contextReferences.length?'OPEN_CONTEXT_READY':signals.length||timeline.length?'SOURCE_SIGNALS_ONLY':'CANDIDATES_ONLY'};
}

export function publicAutonomousIntelligence(value){
  if(!value)return null;
  return {
    policyVersion:bounded(value.policyVersion,64),status:bounded(value.status,64),generatedAt:value.generatedAt||null,fingerprint:bounded(value.fingerprint,80),change:bounded(value.change||'INITIAL',24),
    identity:value.identity?{status:bounded(value.identity.status,64),confidence:bounded(value.identity.confidence,24),provider:bounded(value.identity.provider,64),reason:bounded(value.identity.reason,400),reference:value.identity.reference?{legalName:bounded(value.identity.reference.legalName,180),lei:bounded(value.identity.reference.lei,40),country:bounded(value.identity.reference.country,8),jurisdiction:bounded(value.identity.reference.jurisdiction,40),entityStatus:bounded(value.identity.reference.entityStatus,30),registrationStatus:bounded(value.identity.reference.registrationStatus,30)}:null}:null,
    facts:(value.facts||[]).slice(0,40).map(x=>({id:bounded(x.id,40),tier:'MACHINE_VERIFIED_REFERENCE',category:bounded(x.category,64),type:bounded(x.type,64),text:bounded(x.text,500),provider:bounded(x.provider,64),source:x.source?{sourceOfRecord:bounded(x.source.sourceOfRecord,120),official:bounded(x.source.official,300)}:null,confidence:bounded(x.confidence,24),scope:bounded(x.scope,300),caveat:bounded(x.caveat,500)})),
    signals:(value.signals||[]).slice(0,40).map(x=>({id:bounded(x.id,40),tier:'SOURCE_SIGNAL',category:bounded(x.category,64),provider:bounded(x.provider,64),source:x.source?{sourceOfRecord:bounded(x.source.sourceOfRecord,120),official:bounded(x.source.official,300)}:null,text:bounded(x.text,500),recordCount:Number(x.recordCount||0),confidence:bounded(x.confidence,24),scope:bounded(x.scope,300),caveat:bounded(x.caveat,500)})),
    contextReferences:(value.contextReferences||[]).slice(0,8).map(x=>({id:bounded(x.id,40),tier:'OPEN_KNOWLEDGE_CONTEXT',provider:'WIKIDATA',source:x.source?{sourceOfRecord:bounded(x.source.sourceOfRecord,120),official:bounded(x.source.official,300)}:null,label:bounded(x.label,180),reference:bounded(x.reference,40),description:bounded(x.description,300),countryLabels:(x.countryLabels||[]).slice(0,4).map(v=>bounded(v,120)),officialWebsite:bounded(x.officialWebsite,300),inception:bounded(x.inception,20),industries:(x.industries||[]).slice(0,6).map(v=>bounded(v,180)),headquarters:(x.headquarters||[]).slice(0,6).map(v=>bounded(v,180)),parents:(x.parents||[]).slice(0,6).map(v=>bounded(v,180)),products:(x.products||[]).slice(0,8).map(v=>bounded(v,180)),exchanges:(x.exchanges||[]).slice(0,5).map(v=>bounded(v,180)),legalForm:bounded(x.legalForm,120),wikipediaUrl:bounded(x.wikipediaUrl,300),searchQuery:bounded(x.searchQuery,160),confidence:bounded(x.confidence,24),basis:bounded(x.basis,64),caveat:bounded(x.caveat,500)})),
    contextCandidates:(value.contextCandidates||[]).slice(0,12).map(x=>({id:bounded(x.id,40),tier:'CONTEXT_CANDIDATE',provider:bounded(x.provider,64),source:x.source?{sourceOfRecord:bounded(x.source.sourceOfRecord,120),official:bounded(x.source.official,300)}:null,label:bounded(x.label,180),reference:bounded(x.reference,40),description:bounded(x.description,300),countryLabels:(x.countryLabels||[]).slice(0,4).map(v=>bounded(v,120)),officialWebsite:bounded(x.officialWebsite,300),inception:bounded(x.inception,20),industries:(x.industries||[]).slice(0,6).map(v=>bounded(v,180)),headquarters:(x.headquarters||[]).slice(0,6).map(v=>bounded(v,180)),parents:(x.parents||[]).slice(0,6).map(v=>bounded(v,180)),products:(x.products||[]).slice(0,8).map(v=>bounded(v,180)),exchanges:(x.exchanges||[]).slice(0,5).map(v=>bounded(v,180)),legalForm:bounded(x.legalForm,120),wikipediaUrl:bounded(x.wikipediaUrl,300),searchQuery:bounded(x.searchQuery,160),match:x.match==='EXACT_NAME'?'EXACT_NAME':'CANDIDATE',matchBasis:bounded(x.matchBasis,220),caveat:bounded(x.caveat,500)})),
    timeline:(value.timeline||[]).slice(0,30).map(x=>({id:bounded(x.id,40),tier:'SOURCE_EVENT_CANDIDATE',category:bounded(x.category,64),provider:bounded(x.provider,64),source:x.source?{sourceOfRecord:bounded(x.source.sourceOfRecord,120),official:bounded(x.source.official,300)}:null,date:bounded(x.date,20),endDate:bounded(x.endDate,20),title:bounded(x.title,240),location:bounded(x.location,180),status:bounded(x.status,120),detail:bounded(x.detail,600),reference:bounded(x.reference,120),recordUrl:bounded(x.recordUrl,300),entityScope:'EXACT_NAME_SOURCE_CANDIDATE',caveat:bounded(x.caveat,600)})),
    dossier:value.dossier?{status:bounded(value.dossier.status,48),summary:bounded(value.dossier.summary,700),updatedAt:value.dossier.updatedAt||null,legalIdentityStatus:bounded(value.dossier.legalIdentityStatus,64),openContextCount:Number(value.dossier.openContextCount||0),eventCount:Number(value.dossier.eventCount||0),gaps:(value.dossier.gaps||[]).slice(0,12).map(x=>({code:bounded(x.code,80),label:bounded(x.label,180),detail:bounded(x.detail,600)})),sourceCoverage:{successful:Number(value.dossier.sourceCoverage?.successful||0),errors:Number(value.dossier.sourceCoverage?.errors||0),notApplicable:Number(value.dossier.sourceCoverage?.notApplicable||0),total:Number(value.dossier.sourceCoverage?.total||0)}}:null,
    conflicts:(value.conflicts||[]).slice(0,20).map(x=>({code:bounded(x.code,80),provider:bounded(x.provider,64),count:Number(x.count||0),expected:bounded(x.expected,16),observed:bounded(x.observed,16),message:bounded(x.message,300)})),
    clusters:(value.clusters||[]).slice(0,12).map(x=>({id:bounded(x.id,40),label:bounded(x.label,180),providers:(x.providers||[]).slice(0,12).map(v=>bounded(v,64)),candidateCount:Number(x.candidateCount||0),totalMatchedRecords:Number(x.totalMatchedRecords||0),exactNameProviders:(x.exactNameProviders||[]).slice(0,12).map(v=>bounded(v,64))})),
    coverage:{machineVerifiedFacts:Number(value.coverage?.machineVerifiedFacts||0),sourceSignals:Number(value.coverage?.sourceSignals||0),openContextReferences:Number(value.coverage?.openContextReferences||0),publicEventCandidates:Number(value.coverage?.publicEventCandidates||0),contextCandidates:Number(value.coverage?.contextCandidates||0),sourceSuccessCount:Number(value.coverage?.sourceSuccessCount||0),sourceErrorCount:Number(value.coverage?.sourceErrorCount||0),sourceNotApplicableCount:Number(value.coverage?.sourceNotApplicableCount||0)},
    boundary:bounded(value.boundary,500)
  };
}

function ageMs(value,now){const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?Math.max(0,now.getTime()-parsed):Infinity;}
export function researchAutonomyHealth(state,{now=new Date()}={}){
  const companies=(state?.companies||[]).filter(x=>!x.synthetic);
  const records=Array.isArray(state?.companyResearch)?state.companyResearch:[];
  const byCompany=new Map(records.map(x=>[x.companyId,x]));
  const missingResearch=companies.filter(x=>!byCompany.has(x.id)).length;
  const staleQueued=records.filter(x=>x.status==='QUEUED'&&ageMs(x.queuedAt,now)>10*60*1000).length;
  const staleCollecting=records.filter(x=>x.status==='COLLECTING'&&ageMs(x.startedAt,now)>15*60*1000).length;
  const failedRecords=records.filter(x=>x.status==='COLLECTION_FAILED').length;
  const retryEligibleFailures=records.filter(x=>x.status==='COLLECTION_FAILED'&&ageMs(x.failedAt,now)>30*60*1000).length;
  const deadLetteredRecords=records.filter(x=>Boolean(x.deadLetteredAt)).length;
  const latestDeadLetteredAt=records.map(x=>x.deadLetteredAt).filter(Boolean).sort().at(-1)||null;
  const completed=records.filter(x=>['AUTO_READY','AUTO_READY_WITH_SOURCE_GAPS','REVIEW_REQUIRED','REVIEW_REQUIRED_WITH_SOURCE_GAPS'].includes(x.status));
  const missingCurrentPolicy=completed.filter(x=>x.intelligence?.policyVersion!==POLICY_VERSION).length;
  const sourceGapRecords=completed.filter(x=>Number(x.sourceErrorCount||0)>0).length;
  const lastCollectedAt=completed.map(x=>x.collectedAt).filter(Boolean).sort().at(-1)||null;
  const recoveryIssues=missingResearch+staleQueued+staleCollecting+failedRecords+missingCurrentPolicy;
  return {
    status:recoveryIssues?'RECOVERY_NEEDED':sourceGapRecords?'DEGRADED_SOURCE_COVERAGE':'HEALTHY',
    policyVersion:POLICY_VERSION,unattendedOperation:true,realCompanies:companies.length,researchRecords:records.length,
    missingResearch,staleQueued,staleCollecting,failedRecords,retryEligibleFailures,deadLetteredRecords,latestDeadLetteredAt,missingCurrentPolicy,sourceGapRecords,lastCollectedAt,
    selfHealing:{queue:true,deadLetterConsumer:true,scheduledReenqueue:true,staleLeaseRecovery:true,failedRetry:true,manualOperatorRequired:false}
  };
}
