import crypto from 'node:crypto';

export const AUTONOMOUS_INTELLIGENCE_POLICY_VERSION='auto-intelligence-0.8.2';
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
    ['cn','CN'],['china','CN'],['中国','CN'],['中国大陆','CN'],['mainland china','CN'],
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
  if(wikidata?.status==='OK')for(const c of (wikidata.candidates||[]).slice(0,3))contextCandidates.push({id:signalId('WIKIDATA',c.externalId||c.label),tier:'CONTEXT_CANDIDATE',provider:'WIKIDATA',source:sourceMeta(wikidata),label:bounded(c.label,180),reference:bounded(c.externalId,40),description:bounded(c.description,240),match:c.match==='EXACT_NAME'?'EXACT_NAME':'CANDIDATE',caveat:'Wikidata 是开放上下文知识图谱；该候选不覆盖官方登记/申报来源，也不自动成为公司法律、经营或劳动事实。'});

  facts.sort((a,b)=>a.id.localeCompare(b.id));signals.sort((a,b)=>a.id.localeCompare(b.id));contextCandidates.sort((a,b)=>a.id.localeCompare(b.id));conflicts.sort((a,b)=>a.code.localeCompare(b.code));
  const clusters=candidateClusters({...record,companyName:company?.name});
  const contextCandidateCount=(record.providers||[]).reduce((n,p)=>n+(p.candidates||[]).filter(c=>!exactCandidates({candidates:[c]},company?.name).length).length,0)+contextCandidates.length;
  const payload={policyVersion:POLICY_VERSION,identity,facts,signals,contextCandidates,conflicts,clusters,coverage:{machineVerifiedFacts:facts.length,sourceSignals:signals.length,contextCandidates:contextCandidateCount,sourceSuccessCount:Number(record.sourceSuccessCount||0),sourceErrorCount:Number(record.sourceErrorCount||0)},boundary:'机器只自动发布可重复验证的窄范围参考事实与来源信号；主体歧义、来源冲突、法律结论和未绑定上下文保持候选或未知。'};
  const fingerprint=stableHash(payload);
  return {...payload,generatedAt,fingerprint,status:facts.length?'MACHINE_INTELLIGENCE_READY':signals.length?'SOURCE_SIGNALS_ONLY':'CANDIDATES_ONLY'};
}

export function publicAutonomousIntelligence(value){
  if(!value)return null;
  return {
    policyVersion:bounded(value.policyVersion,64),status:bounded(value.status,64),generatedAt:value.generatedAt||null,fingerprint:bounded(value.fingerprint,80),change:bounded(value.change||'INITIAL',24),
    identity:value.identity?{status:bounded(value.identity.status,64),confidence:bounded(value.identity.confidence,24),provider:bounded(value.identity.provider,64),reason:bounded(value.identity.reason,400),reference:value.identity.reference?{legalName:bounded(value.identity.reference.legalName,180),lei:bounded(value.identity.reference.lei,40),country:bounded(value.identity.reference.country,8),jurisdiction:bounded(value.identity.reference.jurisdiction,40),entityStatus:bounded(value.identity.reference.entityStatus,30),registrationStatus:bounded(value.identity.reference.registrationStatus,30)}:null}:null,
    facts:(value.facts||[]).slice(0,40).map(x=>({id:bounded(x.id,40),tier:'MACHINE_VERIFIED_REFERENCE',category:bounded(x.category,64),type:bounded(x.type,64),text:bounded(x.text,500),provider:bounded(x.provider,64),source:x.source?{sourceOfRecord:bounded(x.source.sourceOfRecord,120),official:bounded(x.source.official,300)}:null,confidence:bounded(x.confidence,24),scope:bounded(x.scope,300),caveat:bounded(x.caveat,500)})),
    signals:(value.signals||[]).slice(0,40).map(x=>({id:bounded(x.id,40),tier:'SOURCE_SIGNAL',category:bounded(x.category,64),provider:bounded(x.provider,64),source:x.source?{sourceOfRecord:bounded(x.source.sourceOfRecord,120),official:bounded(x.source.official,300)}:null,text:bounded(x.text,500),recordCount:Number(x.recordCount||0),confidence:bounded(x.confidence,24),scope:bounded(x.scope,300),caveat:bounded(x.caveat,500)})),
    contextCandidates:(value.contextCandidates||[]).slice(0,12).map(x=>({id:bounded(x.id,40),tier:'CONTEXT_CANDIDATE',provider:bounded(x.provider,64),source:x.source?{sourceOfRecord:bounded(x.source.sourceOfRecord,120),official:bounded(x.source.official,300)}:null,label:bounded(x.label,180),reference:bounded(x.reference,40),description:bounded(x.description,240),match:x.match==='EXACT_NAME'?'EXACT_NAME':'CANDIDATE',caveat:bounded(x.caveat,500)})),
    conflicts:(value.conflicts||[]).slice(0,20).map(x=>({code:bounded(x.code,80),provider:bounded(x.provider,64),count:Number(x.count||0),expected:bounded(x.expected,16),observed:bounded(x.observed,16),message:bounded(x.message,300)})),
    clusters:(value.clusters||[]).slice(0,12).map(x=>({id:bounded(x.id,40),label:bounded(x.label,180),providers:(x.providers||[]).slice(0,12).map(v=>bounded(v,64)),candidateCount:Number(x.candidateCount||0),totalMatchedRecords:Number(x.totalMatchedRecords||0),exactNameProviders:(x.exactNameProviders||[]).slice(0,12).map(v=>bounded(v,64))})),
    coverage:{machineVerifiedFacts:Number(value.coverage?.machineVerifiedFacts||0),sourceSignals:Number(value.coverage?.sourceSignals||0),contextCandidates:Number(value.coverage?.contextCandidates||0),sourceSuccessCount:Number(value.coverage?.sourceSuccessCount||0),sourceErrorCount:Number(value.coverage?.sourceErrorCount||0)},
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
