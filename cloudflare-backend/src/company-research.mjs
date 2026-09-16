import {buildAutonomousIntelligence,AUTONOMOUS_INTELLIGENCE_POLICY_VERSION,countryCode} from '../../sites-app/src/autonomous-intelligence.mjs';

const UA='LaborTransparencyPublicInterest/0.8.1 (+https://github.com/HiddenFeng/labor-transparency-ai)';
const MAX_BODY=2_000_000;
const SOURCE_TIMEOUT_MS=8_000;
const SOURCE_INFO={
  GLEIF:{sourceOfRecord:'GLEIF',official:'https://www.gleif.org/',license:'CC0-1.0'},
  WIKIDATA:{sourceOfRecord:'Wikidata',official:'https://www.wikidata.org/',license:'CC0-1.0'},
  SEC_EDGAR:{sourceOfRecord:'U.S. Securities and Exchange Commission',official:'https://www.sec.gov/edgar/',license:'US_GOV_PUBLIC_RECORD'},
  NLRB_CASES:{sourceOfRecord:'National Labor Relations Board',official:'https://www.nlrb.gov/advanced-search',mirror:'https://labordata.bunkum.us/nlrb'},
  OSHA_ENFORCEMENT:{sourceOfRecord:'U.S. Department of Labor / OSHA',official:'https://www.osha.gov/data',mirror:'https://labordata.bunkum.us/osha_enforcement'},
  DOL_WHD:{sourceOfRecord:'U.S. Department of Labor / Wage and Hour Division',official:'https://www.dol.gov/agencies/whd/data',mirror:'https://labordata.bunkum.us/whisard'},
  FMCS_F7:{sourceOfRecord:'Federal Mediation and Conciliation Service',official:'https://www.fmcs.gov/resources/documents-and-data/',mirror:'https://labordata.bunkum.us/f7'},
  NLRB_VOLUNTARY_RECOGNITION:{sourceOfRecord:'National Labor Relations Board',official:'https://www.nlrb.gov/',mirror:'https://labordata.bunkum.us/voluntary_recognitions'},
  FMCS_WORK_STOPPAGES:{sourceOfRecord:'Federal Mediation and Conciliation Service',official:'https://www.fmcs.gov/resources/documents-and-data/',mirror:'https://labordata.bunkum.us/work_stoppages'},
  OLMS_LM20:{sourceOfRecord:'U.S. Department of Labor / OLMS',official:'https://www.dol.gov/agencies/olms/public-disclosure-room',mirror:'https://labordata.bunkum.us/lm20'},
  USA_SPENDING:{sourceOfRecord:'USAspending.gov / U.S. Department of the Treasury',official:'https://www.usaspending.gov/',license:'US_GOV_PUBLIC_RECORD'}
};

function norm(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();}
function sqlLit(v){return `'${String(v||'').replaceAll("'","''")}'`;}
function cleanCompanyQuery(name){
  const s=String(name||'').replace(/\b(corporation|corp\.?|incorporated|inc\.?|llc|ltd\.?|limited|company|co\.?)\b/gi,' ').replace(/\s+/g,' ').trim();
  return s.length>=2?s:String(name||'');
}
function companySearchVariants(name){
  const original=String(name||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const variants=[original];
  const corporateShorthand=original
    .replace(/集团股份有限公司$/u,'集团股份')
    .replace(/股份有限公司$/u,'股份')
    .replace(/有限责任公司$/u,'有限责任')
    .trim();
  const suffixStripped=original
    .replace(/(?:集团)?股份有限公司$/u,'')
    .replace(/有限责任公司$/u,'')
    .replace(/有限公司$/u,'')
    .replace(/股份公司$/u,'')
    .replace(/集团有限公司$/u,'')
    .replace(/株式会社$/u,'')
    .replace(/주식회사$/u,'')
    .trim();
  const englishStripped=cleanCompanyQuery(suffixStripped);
  for(const v of [corporateShorthand,suffixStripped,englishStripped])if(v.length>=2&&!variants.some(x=>norm(x)===norm(v)))variants.push(v);
  return variants.slice(0,4);
}
function wikidataLanguages(company){
  const code=countryCode(company?.region);
  const primary=({CN:'zh',HK:'zh',TW:'zh',JP:'ja',KR:'ko',DE:'de',FR:'fr',NL:'nl',BR:'pt',MX:'es'})[code]||'en';
  return primary==='en'?['en']: [primary,'en'];
}
function entityValues(entity,property){
  return (entity?.claims?.[property]||[]).map(x=>x?.mainsnak?.datavalue?.value).filter(x=>x!==undefined&&x!==null);
}
function entityItemIds(entity,property){return entityValues(entity,property).map(x=>x&&typeof x==='object'?x.id:null).filter(Boolean);}
function entityString(entity,property){return entityValues(entity,property).find(x=>typeof x==='string')||'';}
function entityTime(entity,property){
  const v=entityValues(entity,property).find(x=>x&&typeof x==='object'&&x.time);if(!v)return '';
  const m=String(v.time).match(/^\+?(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);if(!m)return '';
  return [m[1],m[2]&&m[2]!=='00'?m[2]:null,m[3]&&m[3]!=='00'?m[3]:null].filter(Boolean).join('-');
}
function languageValue(map,languages){for(const lang of [...languages,'zh','en'])if(map?.[lang]?.value)return boundedText(map[lang].value,220);return boundedText(Object.values(map||{})[0]?.value,220);}
function labelForId(labels,id,languages){const e=labels?.[id];return languageValue(e?.labels,languages)||id;}
function httpsUrl(value){try{const u=new URL(String(value||''));return u.protocol==='https:'?u.href:'';}catch{return '';}}
function wikipediaUrl(entity,languages){
  for(const lang of [...languages,'zh','en']){const site=`${lang}wiki`;const title=entity?.sitelinks?.[site]?.title;if(title)return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ','_'))}`;}
  return '';
}
function boundedText(v,max=500){return String(v??'').slice(0,max);}
function candidate(provider,externalId,label,extra={}){return {provider,externalId:boundedText(externalId,300),label:boundedText(label,300),...extra};}

async function responseJson(response){
  if([301,302,303,307,308].includes(response.status))throw new Error('SOURCE_REDIRECT_DENIED');
  if(response.status===401||response.status===403)throw new Error('SOURCE_ACCESS_DENIED');
  if(response.status===429)throw new Error('SOURCE_RATE_LIMITED');
  if(response.status>=500)throw new Error('SOURCE_UNAVAILABLE');
  if(response.status!==200)throw new Error(`SOURCE_STATUS_${response.status}`);
  const ct=response.headers.get('content-type')||'';if(!ct.toLowerCase().includes('json'))throw new Error('SOURCE_CONTENT_TYPE');
  const raw=new Uint8Array(await response.arrayBuffer());if(raw.byteLength>MAX_BODY)throw new Error('SOURCE_TOO_LARGE');
  try{return JSON.parse(new TextDecoder().decode(raw));}catch{throw new Error('SOURCE_JSON_INVALID');}
}
async function sourceFetch(fetchImpl,url,init){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),SOURCE_TIMEOUT_MS);
  try{return await fetchImpl(url,{...init,signal:controller.signal});}
  catch(err){if(controller.signal.aborted)throw new Error('SOURCE_TIMEOUT');throw err;}
  finally{clearTimeout(timer);}
}
async function getJson(fetchImpl,url){return responseJson(await sourceFetch(fetchImpl,url,{headers:{Accept:'application/json','User-Agent':UA},redirect:'manual'}));}
async function postJson(fetchImpl,url,payload){return responseJson(await sourceFetch(fetchImpl,url,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':UA},body:JSON.stringify(payload),redirect:'manual'}));}
function encodeQuery(db,sql){return `https://labordata.bunkum.us/${db}/-/query.json?${new URLSearchParams({sql,_shape:'array'})}`;}
async function laborRows(fetchImpl,db,sql){const x=await getJson(fetchImpl,encodeQuery(db,sql));return Array.isArray(x)?x:[];}
function safeRecord(row){
  const out={};for(const [k,v] of Object.entries(row||{})){if(v===null||v===undefined||typeof v==='boolean'||typeof v==='number')out[k]=v;else if(typeof v==='string')out[k]=boundedText(v,700);}return out;
}
function groupCandidates(rows,{provider,nameField,regionField,sampleField,basis}){
  const seen=new Map();for(const row of rows){const label=boundedText(row?.[nameField]);if(!label)continue;const key=norm(label);const old=seen.get(key)||candidate(provider,label,label,{region:boundedText(row?.[regionField]||'US',80),sampleRecord:boundedText(row?.[sampleField],120),matchBasis:basis,matches:0,records:[]});old.matches++;if(old.records.length<12)old.records.push(safeRecord(row));seen.set(key,old);}
  return [...seen.values()].sort((a,b)=>b.matches-a.matches).slice(0,8);
}

async function gleif(fetchImpl,company){
  const params=new URLSearchParams({'filter[entity.legalName]':company.name,'page[size]':'5'});if(/^[A-Z]{2}$/.test(company.region||''))params.set('filter[entity.legalAddress.country]',company.region);
  const obj=await getJson(fetchImpl,`https://api.gleif.org/api/v1/lei-records?${params}`);const rows=Array.isArray(obj?.data)?obj.data:[];
  return rows.slice(0,5).map(r=>candidate('GLEIF',r?.attributes?.lei||r?.id,r?.attributes?.entity?.legalName?.name||r?.id,{region:boundedText(r?.attributes?.entity?.legalAddress?.country,8),jurisdiction:boundedText(r?.attributes?.entity?.jurisdiction,40),entityStatus:boundedText(r?.attributes?.entity?.status,30),registrationStatus:boundedText(r?.attributes?.registration?.status,30),match: norm(r?.attributes?.entity?.legalName?.name)===norm(company.name)?'EXACT_NAME':'CANDIDATE'}));
}
async function wikidata(fetchImpl,company){
  const languages=wikidataLanguages(company);const variants=companySearchVariants(company.name);const found=new Map();
  const searches=[];
  searches.push([variants[0],languages[0]]);
  if(variants[1])searches.push([variants[1],languages[0]]);
  if(languages[1])searches.push([variants[0],languages[1]]);
  for(const [query,language] of searches.slice(0,3)){
    const p=new URLSearchParams({action:'wbsearchentities',search:query,language,uselang:language,type:'item',limit:'8',format:'json',origin:'*'});
    const o=await getJson(fetchImpl,`https://www.wikidata.org/w/api.php?${p}`);
    for(const r of o?.search||[]){if(!r?.id||found.has(r.id))continue;found.set(r.id,{...r,query,language});if(found.size>=8)break;}
    if(found.size>=8)break;
  }
  const rows=[...found.values()].slice(0,5);if(!rows.length)return [];
  const entityParams=new URLSearchParams({action:'wbgetentities',ids:rows.map(x=>x.id).join('|'),props:'labels|descriptions|claims|sitelinks',languages:[...new Set([...languages,'zh','en'])].join('|'),languagefallback:'1',format:'json',origin:'*'});
  const entityData=await getJson(fetchImpl,`https://www.wikidata.org/w/api.php?${entityParams}`);const entities=entityData?.entities||{};
  const relatedIds=[];for(const e of Object.values(entities))for(const prop of ['P17','P452','P159','P749','P1056','P414','P1454'])relatedIds.push(...entityItemIds(e,prop));
  const ids=[...new Set(relatedIds)].slice(0,40);let labels={};
  if(ids.length){const lp=new URLSearchParams({action:'wbgetentities',ids:ids.join('|'),props:'labels',languages:[...new Set([...languages,'zh','en'])].join('|'),languagefallback:'1',format:'json',origin:'*'});labels=(await getJson(fetchImpl,`https://www.wikidata.org/w/api.php?${lp}`))?.entities||{};}
  return rows.map(r=>{
    const e=entities[r.id]||{};const label=languageValue(e.labels,languages)||boundedText(r.label||r.id,180);const countryIds=entityItemIds(e,'P17');const countryLabels=countryIds.map(id=>labelForId(labels,id,languages));
    const fields={
      description:languageValue(e.descriptions,languages)||boundedText(r.description,300),
      region:boundedText(countryLabels[0]||'GLOBAL',80),countryLabels:countryLabels.slice(0,4),
      officialWebsite:httpsUrl(entityString(e,'P856')),inception:entityTime(e,'P571'),
      industries:entityItemIds(e,'P452').map(id=>labelForId(labels,id,languages)).slice(0,6),
      headquarters:entityItemIds(e,'P159').map(id=>labelForId(labels,id,languages)).slice(0,6),
      parents:entityItemIds(e,'P749').map(id=>labelForId(labels,id,languages)).slice(0,6),
      products:entityItemIds(e,'P1056').map(id=>labelForId(labels,id,languages)).slice(0,8),
      exchanges:entityItemIds(e,'P414').map(id=>labelForId(labels,id,languages)).slice(0,5),
      legalForm:labelForId(labels,entityItemIds(e,'P1454')[0],languages),wikipediaUrl:wikipediaUrl(e,languages),
      searchQuery:boundedText(r.query,160),matchBasis:norm(r.query)===norm(company.name)?'Wikidata full-name search':'Wikidata shortened-name search'
    };
    return candidate('WIKIDATA',r.id,label,{...fields,match:norm(label)===norm(company.name)?'EXACT_NAME':'CANDIDATE'});
  });
}
async function sec(fetchImpl,company){
  const o=await getJson(fetchImpl,'https://www.sec.gov/files/company_tickers.json');const target=norm(company.name);const out=[];for(const r of Object.values(o||{})){const label=boundedText(r?.title,300);if(!label)continue;const n=norm(label);if(target===n||target.includes(n)||n.includes(target)){out.push(candidate('SEC_EDGAR',String(r?.cik_str||'').padStart(10,'0'),label,{ticker:boundedText(r?.ticker,40),region:'US',match:target===n?'EXACT_NAME':'CANDIDATE'}));if(out.length>=5)break;}}return out;
}
async function laborProvider(fetchImpl,db,sql,config){return groupCandidates(await laborRows(fetchImpl,db,sql),config);}
function laborProviderTasks(fetchImpl,company){
  const like=sqlLit(company.name);const short=sqlLit(cleanCompanyQuery(company.name));
  return [
    ['NLRB_CASES',()=>laborProvider(fetchImpl,'nlrb',`select case_number,name,case_type,url,city,state,date_filed,status,date_closed,reason_closed from filing where strpos(lower(name),lower(${like}))>0 order by date_filed desc limit 30`,{provider:'NLRB_CASES',nameField:'name',regionField:'state',sampleField:'case_number',basis:'NLRB case-name candidate; filing is not a violation finding'})],
    ['OSHA_ENFORCEMENT',()=>laborProvider(fetchImpl,'osha_enforcement',`select activity_nr,estab_name,site_city,site_state,naics_code,insp_type,insp_scope,open_date,close_case_date from inspection where strpos(lower(estab_name),lower(${like}))>0 order by open_date desc limit 30`,{provider:'OSHA_ENFORCEMENT',nameField:'estab_name',regionField:'site_state',sampleField:'activity_nr',basis:'OSHA establishment-name candidate; event scope only'})],
    ['DOL_WHD',()=>laborProvider(fetchImpl,'whisard',`select case_id,trade_nm,legal_name,cty_nm,st_cd,naics_code_description,case_violtn_cnt,cmp_assd,ee_violtd_cnt,bw_atp_amt,ee_atp_cnt,findings_start_date,findings_end_date from cases where strpos(lower(legal_name),lower(${like}))>0 or strpos(lower(trade_nm),lower(${like}))>0 order by findings_end_date desc limit 30`,{provider:'DOL_WHD',nameField:'legal_name',regionField:'st_cd',sampleField:'case_id',basis:'WHD concluded-action employer candidate; case scope only'})],
    ['FMCS_F7',()=>laborProvider(fetchImpl,'f7',`select notice_date,employer,employer_city,employer_state,union_name,affected_location_city,affected_location_state,expiration_date,naics,industry,bargaining_unit_size,establishment_size,category from f7 where strpos(lower(employer),lower(${like}))>0 order by notice_date desc limit 30`,{provider:'FMCS_F7',nameField:'employer',regionField:'employer_state',sampleField:'notice_date',basis:'FMCS F-7 collective-bargaining notice candidate'})],
    ['NLRB_VOLUNTARY_RECOGNITION',()=>laborProvider(fetchImpl,'voluntary_recognitions',`select "VR Case Number","Employer","Union","Unit City","Unit State","Date VR Request Received","Date of Voluntary Recogition","Number of Employees","Unit Description" from voluntary_recognitions where strpos(lower("Employer"),lower(${like}))>0 order by "Date VR Request Received" desc limit 30`,{provider:'NLRB_VOLUNTARY_RECOGNITION',nameField:'Employer',regionField:'Unit State',sampleField:'VR Case Number',basis:'NLRB voluntary-recognition candidate'})],
    ['FMCS_WORK_STOPPAGES',()=>laborProvider(fetchImpl,'work_stoppages',`select "Employer","Union","Union Local","Case Number","BU","NAICS","Industry","City, State","# Idled","Start Date","End Date","Duration" from work_stoppages where strpos(lower("Employer"),lower(${like}))>0 order by "Start Date" desc limit 30`,{provider:'FMCS_WORK_STOPPAGES',nameField:'Employer',regionField:'City, State',sampleField:'Case Number',basis:'FMCS work-stoppage event candidate'})],
    ['OLMS_LM20',()=>laborProvider(fetchImpl,'lm20',`select rptId,empLabOrg,empTrdName,city,state,termDate,amount from employer where strpos(lower(empLabOrg),lower(${like}))>0 or strpos(lower(empTrdName),lower(${like}))>0 or strpos(lower(empLabOrg),lower(${short}))>0 or strpos(lower(empTrdName),lower(${short}))>0 order by termDate desc limit 30`,{provider:'OLMS_LM20',nameField:'empTrdName',regionField:'state',sampleField:'rptId',basis:'OLMS employer/consultant disclosure candidate'})]
  ];
}
async function usaSpending(fetchImpl,company){
  const o=await postJson(fetchImpl,'https://api.usaspending.gov/api/v2/autocomplete/recipient/',{search_text:cleanCompanyQuery(company.name)});return (o?.results||[]).slice(0,10).map(r=>candidate('USA_SPENDING',r.recipient_name,r.recipient_name,{region:'US',uei:boundedText(r.uei,80),match:norm(r.recipient_name)===norm(company.name)?'EXACT_NAME':'CANDIDATE',matchBasis:'USAspending recipient candidate; explicit recipient binding required'}));
}

function sourceErrorCode(err){const msg=String(err?.message||'');return /^SOURCE_[A-Z0-9_]+$/.test(msg)?msg:'SOURCE_NETWORK_OR_RUNTIME_ERROR';}
async function providerResult(name,fn){try{const candidates=await fn();return {provider:name,status:'OK',candidateCount:candidates.length,candidates,source:SOURCE_INFO[name]||null};}catch(err){return {provider:name,status:'ERROR',candidateCount:0,candidates:[],error:sourceErrorCode(err),source:SOURCE_INFO[name]||null};}}

async function runBoundedProviderTasks(tasks,limit=4){
  const out=new Array(tasks.length);let cursor=0;
  async function worker(){
    while(true){
      const index=cursor++;if(index>=tasks.length)return;
      const [name,fn]=tasks[index];out[index]=await providerResult(name,fn);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,tasks.length)},()=>worker()));
  return out;
}

function researchRecordBase(company,status,at){return {
  id:`research_${company.id}`,companyId:company.id,companyName:boundedText(company.name,160),region:boundedText(company.region,100),
  status,queuedAt:at,startedAt:null,collectedAt:null,failedAt:null,reviewRequired:false,providers:[],candidateCount:0,
  exactNameCandidateCount:0,sourceSuccessCount:0,sourceErrorCount:0,sourceNotApplicableCount:0,intelligence:null,failureCount:0,deadLetteredAt:null
};}

function notApplicableProvider(name,reason='REGION_NOT_APPLICABLE'){
  return {provider:name,status:'NOT_APPLICABLE',candidateCount:0,candidates:[],reason,source:SOURCE_INFO[name]||null};
}

export async function collectCompanyResearch(company,{fetchImpl=fetch,now=new Date()}={}){
  if(!company||company.synthetic)throw new Error('PUBLIC_REAL_COMPANY_REQUIRED');
  const globalTasks=[
    ['GLEIF',()=>gleif(fetchImpl,company)],
    ['WIKIDATA',()=>wikidata(fetchImpl,company)]
  ];
  const usTasks=[['SEC_EDGAR',()=>sec(fetchImpl,company)],...laborProviderTasks(fetchImpl,company),['USA_SPENDING',()=>usaSpending(fetchImpl,company)]];
  const globalProviders=await runBoundedProviderTasks(globalTasks,1);
  const regionalProviders=countryCode(company.region)==='US'?await runBoundedProviderTasks(usTasks,1):usTasks.map(([name])=>notApplicableProvider(name,'US_ONLY_SOURCE'));
  const providers=[...globalProviders,...regionalProviders];
  const base={...researchRecordBase(company,'REVIEW_REQUIRED',now.toISOString()),queuedAt:null,startedAt:null,collectedAt:now.toISOString(),providers};
  const all=providers.flatMap(x=>x.candidates||[]);
  base.candidateCount=all.length;base.exactNameCandidateCount=all.filter(x=>x.match==='EXACT_NAME').length;
  base.sourceSuccessCount=providers.filter(x=>x.status==='OK').length;base.sourceErrorCount=providers.filter(x=>x.status==='ERROR').length;
  base.sourceNotApplicableCount=providers.filter(x=>x.status==='NOT_APPLICABLE').length;
  base.intelligence=buildAutonomousIntelligence(company,base,{now});
  base.status=base.sourceErrorCount?'AUTO_READY_WITH_SOURCE_GAPS':'AUTO_READY';
  return base;
}

export function mergeCompanyResearch(state,records){
  if(!Array.isArray(state.companyResearch))state.companyResearch=[];
  const by=new Map(state.companyResearch.map(x=>[x.companyId,x]));
  for(const r of records){
    const old=by.get(r.companyId);
    if(r.intelligence){
      const previous=old?.intelligence?.fingerprint||null;
      r.intelligence.previousFingerprint=previous;
      r.intelligence.change=!previous?'INITIAL':previous===r.intelligence.fingerprint?'UNCHANGED':'UPDATED';
    }
    by.set(r.companyId,r);
  }
  state.companyResearch=[...by.values()].sort((a,b)=>String(a.companyId).localeCompare(String(b.companyId)));return records.length;
}

export function queueCompanyResearch(state,company,{now=new Date()}={}){
  if(!company||company.synthetic)return {queued:false,record:null};
  if(!Array.isArray(state.companyResearch))state.companyResearch=[];
  const existing=state.companyResearch.find(x=>x.companyId===company.id);
  if(existing)return {queued:false,record:existing};
  const record=researchRecordBase(company,'QUEUED',now.toISOString());mergeCompanyResearch(state,[record]);
  return {queued:true,record};
}

export function markCompanyResearchStarted(state,company,{now=new Date(),staleCollectingMs=15*60*1000,allowRefresh=false}={}){
  if(!company||company.synthetic)return null;
  if(!Array.isArray(state.companyResearch))state.companyResearch=[];
  const existing=state.companyResearch.find(x=>x.companyId===company.id);
  if(existing?.status==='COLLECTING'&&existing.startedAt&&now.getTime()-new Date(existing.startedAt).getTime()<staleCollectingMs)return null;
  if(existing&&!['QUEUED','COLLECTION_FAILED','COLLECTING'].includes(existing.status)&&!(allowRefresh&&['AUTO_READY','AUTO_READY_WITH_SOURCE_GAPS','REVIEW_REQUIRED','REVIEW_REQUIRED_WITH_SOURCE_GAPS'].includes(existing.status)))return null;
  const base=existing||researchRecordBase(company,'QUEUED',now.toISOString());
  const record={...base,status:'COLLECTING',queuedAt:base.queuedAt||now.toISOString(),startedAt:now.toISOString(),failedAt:null};
  mergeCompanyResearch(state,[record]);return record;
}

export function markCompanyResearchFailed(state,companyId,{now=new Date(),error='COLLECTION_RUNTIME_FAILED'}={}){
  const existing=(state.companyResearch||[]).find(x=>x.companyId===companyId);if(!existing)return null;
  const record={...existing,status:'COLLECTION_FAILED',failedAt:now.toISOString(),lastError:boundedText(error,80),reviewRequired:false,failureCount:Number(existing.failureCount||0)+1};
  mergeCompanyResearch(state,[record]);return record;
}

export function markCompanyResearchDeadLettered(state,companyId,{now=new Date()}={}){
  const existing=(state.companyResearch||[]).find(x=>x.companyId===companyId);if(!existing)return null;
  const record={...existing,status:'COLLECTION_FAILED',deadLetteredAt:now.toISOString(),lastError:'QUEUE_RETRIES_EXHAUSTED',reviewRequired:false};
  mergeCompanyResearch(state,[record]);return record;
}

function failedRetryDelayMs(record,baseMs){
  const failures=Math.max(1,Number(record?.failureCount||1));
  return Math.min(8*60*60*1000,baseMs*(2**Math.min(failures-1,4)));
}

export function selectResearchCompanies(state,max=2,{now=new Date(),refreshAfterMs=24*60*60*1000,failureRetryMs=30*60*1000,staleCollectingMs=15*60*1000}={}){
  const existing=new Map((state.companyResearch||[]).map(x=>[x.companyId,x]));
  const eligible=(state.companies||[]).filter(x=>!x.synthetic).filter(company=>{
    const r=existing.get(company.id);if(!r)return true;
    if(r.status==='QUEUED')return true;
    if(r.status==='COLLECTING')return !r.startedAt||now.getTime()-new Date(r.startedAt).getTime()>=staleCollectingMs;
    if(r.status==='COLLECTION_FAILED')return !r.failedAt||now.getTime()-new Date(r.failedAt).getTime()>=failedRetryDelayMs(r,failureRetryMs);
    if(['AUTO_READY','AUTO_READY_WITH_SOURCE_GAPS','REVIEW_REQUIRED','REVIEW_REQUIRED_WITH_SOURCE_GAPS'].includes(r.status))return r.intelligence?.policyVersion!==AUTONOMOUS_INTELLIGENCE_POLICY_VERSION||!r.collectedAt||now.getTime()-new Date(r.collectedAt).getTime()>=refreshAfterMs;
    return true;
  });
  function priority(company){const r=existing.get(company.id);if(!r||r.status==='QUEUED')return 0;if(r.status==='COLLECTION_FAILED'||r.status==='COLLECTING')return 1;return 2;}
  eligible.sort((a,b)=>priority(a)-priority(b)||String(existing.get(a.id)?.queuedAt||existing.get(a.id)?.collectedAt||'').localeCompare(String(existing.get(b.id)?.queuedAt||existing.get(b.id)?.collectedAt||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  return eligible.slice(0,Math.max(0,Math.min(10,Number(max)||2)));
}
