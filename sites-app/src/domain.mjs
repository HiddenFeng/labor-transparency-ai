import crypto from 'node:crypto';

export const VERSION = '0.9.0-rc.1';
export const EVIDENCE_LEVELS = new Set(['E0','E1','E2','E3','E4','E5']);
export const KINDS = new Set(['product','brand','company_fact','relationship','labour_claim','product_claim']);
export const DIMENSIONS = new Set(['pay','rest','hours','safety','contract','respect','representation','other']);
export const RIGHTS = new Set(['own_summary','permission','public_domain','reference_only']);
export const SOURCE_TYPES = new Set(['first_person','company_disclosure','public_record','official_decision','other']);
export const RELATION_TYPES = new Set(['company_brand','company_product','brand_product','parent_subsidiary','supplier_customer','other']);
export const COMMUNITY_FEEDBACK_TYPES = new Set(['suggestion','appeal','correction','source_request','other']);
export const OFFICIAL_REFERENCE_TYPES = new Set(['LEGAL_ENTITY_REGISTRY','DISCLOSURE_REGISTRY','OTHER_OFFICIAL_REFERENCE']);
export const OFFICIAL_EVENT_TYPES = new Set(['PRODUCT_RECALL','ADMINISTRATIVE_PENALTY','REGULATORY_MEASURE','OTHER_OFFICIAL_EVENT']);
export const ADVISORY_CATEGORIES = new Set(['pay','hours_rest','contract','termination','safety','respect','representation','other']);
export const ADVISORY_URGENCY = new Set(['routine','soon','urgent']);
export const EMPLOYMENT_STATUS = new Set(['current','former','applicant','contractor','other']);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LONG_NUMBER_RE = /(^|\D)\d{11,19}(\D|$)/;
const PRIVATE_HINT_RE = /(身份证|护照|银行卡|手机号码|手机号|私人电话|微信号|whatsapp|telegram\s*id)/i;
const ADVISORY_SENSITIVE_RE = /(真实姓名|姓名[:：]|身份证|护照|银行卡|银行账户|信用卡|支付账号|支付宝|微信号|QQ号|手机号|电话号码|私人电话|家庭住址|住宅地址|详细地址|门牌号|病历|诊断证明|疾病名称|医疗记录|药物记录|社保号|税号|附件|照片|扫描件)/i;

export function nowIso(){ return new Date().toISOString(); }
export function id(prefix){ return `${prefix}_${crypto.randomBytes(9).toString('hex')}`; }
export function evidenceNumber(value){ return EVIDENCE_LEVELS.has(value) ? Number(value.slice(1)) : -1; }
export function ballotSignalType(item){ return item?.signalType === 'worker' ? 'worker' : 'community'; }

export function safeText(value, {min=0,max=2000,field='字段'}={}){
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new Error(`${field}必须是文本`);
  value = value.trim();
  if (value.length < min || value.length > max) throw new Error(`${field}长度需为${min}—${max}字`);
  if (EMAIL_RE.test(value) || LONG_NUMBER_RE.test(value) || PRIVATE_HINT_RE.test(value)) {
    throw new Error(`${field}可能包含私人联系方式或敏感个人编号，请移除后再提交`);
  }
  return value;
}

export function safeAdvisoryText(value,{min=0,max=2000,field='字段'}={}){
  value = safeText(value,{min,max,field});
  if (ADVISORY_SENSITIVE_RE.test(value)) throw new Error(`${field}可能包含当前服务不接收的身份、联系方式、住址、健康、支付或附件信息，请先删除`);
  return value;
}

export function createReceiptCode(){ return `ADV-${crypto.randomBytes(24).toString('base64url')}`; }
export function hashReceiptCode(value){
  if (typeof value !== 'string' || !/^ADV-[A-Za-z0-9_-]{32}$/.test(value.trim())) throw new Error('匿名回执码无效');
  return crypto.createHash('sha256').update(value.trim()).digest('hex');
}

export function safeDate(value, field='日期'){
  if (!value) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field}必须是YYYY-MM-DD`);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== value) throw new Error(`${field}无效`);
  return value;
}

export function safeUrl(value){
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 500) throw new Error('来源URL无效');
  let u;
  try { u = new URL(value); } catch { throw new Error('来源URL无效'); }
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('来源仅接受HTTPS公开地址');
  return u.href;
}

export function emptyState(){
  return {
    schemaVersion: '0.8',
    version: VERSION,
    revision: 0,
    createdAt: nowIso(),
    companies: [],
    contributions: [],
    reviews: [],
    exportReviews: [],
    ballots: [],
    flags: [],
    advisoryCases: [],
    advisoryAdvice: [],
    advisoryDailyReports: [],
    companyResearch: [],
    officialReferences: [],
    officialRelations: [],
    officialEvents: [],
    communityFeedback: [],
    communityFeedbackResponses: [],
    publicAnnouncements: [],
    agentDailyRuns: [],
    federatedEvidence: [],
    federationImports: []
  };
}

export function upgradeState(state){
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('状态文件无效');
  for (const key of ['companies','contributions','reviews','exportReviews','ballots','flags']) if (!Array.isArray(state[key])) state[key]=[];
  for (const key of ['advisoryCases','advisoryAdvice','advisoryDailyReports','officialReferences','officialRelations','officialEvents','communityFeedback','communityFeedbackResponses','publicAnnouncements','agentDailyRuns','federatedEvidence','federationImports']) if (!Array.isArray(state[key])) state[key]=[];
  if (!Array.isArray(state.companyResearch)) state.companyResearch=[];
  state.schemaVersion = '0.8';
  state.version = VERSION;
  if (!Number.isInteger(state.revision) || state.revision < 0) state.revision = 0;
  return state;
}

export function seedState(){
  const s = emptyState();
  const company = {
    id: 'co_synthetic_demo', name: '虚构透明制造', region: '示例地区', website: '',
    synthetic: true, createdAt: nowIso(), createdBy: 'system'
  };
  s.companies.push(company);
  s.contributions.push({
    id: 'con_synthetic_product', owner: 'system', companyId: company.id, kind: 'product',
    title: '虚构工作台', description: '仅用于演示产品与公司关联，不代表真实企业或真实产品。',
    scope: '', periodStart: '', periodEnd: '', direction: 'neutral', dimension: 'other',
    productId: '', relation: '', category: '示例产品', sources: [], public: true,
    shareConsent: false, rights: 'reference_only', rightsNote: '', creditName: '系统示例',
    version: 1, evidence: 'E0', status: 'PENDING', exportApproved: false,
    createdAt: nowIso(), updatedAt: nowIso()
  });
  return s;
}

export function validateCompanyInput(input){
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('公司提交需要结构化对象');
  const allowed = new Set(['name','region','website','consent']);
  for (const k of Object.keys(input)) if (!allowed.has(k)) throw new Error('公司提交包含未定义字段');
  if (input.consent !== true) throw new Error('请确认公司名称与地区将作为公开讨论容器显示');
  return {
    name: safeText(input.name,{min:2,max:120,field:'公司名称'}),
    region: safeText(input.region,{min:1,max:120,field:'地区'}),
    website: input.website ? safeUrl(input.website) : ''
  };
}

export function addCompany(state, input, owner){
  const v = validateCompanyInput(input);
  const same = state.companies.find(x => x.name.toLocaleLowerCase() === v.name.toLocaleLowerCase() && x.region === v.region);
  if (same) return {company: same, duplicate: true};
  const company = {id:id('co'), ...v, synthetic:false, createdAt:nowIso(), createdBy:owner};
  state.companies.push(company);
  return {company, duplicate:false};
}

function sourceInput(raw, index){
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('来源需要结构化对象');
  const allowed = new Set(['url','title','type','publishedAt','supports']);
  for (const k of Object.keys(raw)) if (!allowed.has(k)) throw new Error('来源包含未定义字段');
  const type = raw.type || 'other';
  if (!SOURCE_TYPES.has(type)) throw new Error('来源类型无效');
  return {
    id: `S${index+1}`,
    url: safeUrl(raw.url),
    title: safeText(raw.title,{min:2,max:200,field:'来源标题'}),
    type,
    publishedAt: safeDate(raw.publishedAt || '', '来源日期'),
    supports: safeText(raw.supports,{min:2,max:1000,field:'来源支持范围'})
  };
}

export function validateContributionInput(state, input){
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('贡献需要结构化对象');
  const allowed = new Set(['companyId','kind','title','description','scope','periodStart','periodEnd','direction','dimension','productId','brandId','relationType','relation','category','sources','public','consent','shareConsent','rights','rightsNote','creditName']);
  for (const k of Object.keys(input)) if (!allowed.has(k)) throw new Error('不接受未定义字段或用户指定证据等级/审核状态');
  const company = state.companies.find(x => x.id === input.companyId);
  if (!company) throw new Error('公司空间不存在');
  if (input.consent !== true) throw new Error('请确认公开范围');
  const kind = input.kind;
  if (!KINDS.has(kind)) throw new Error('贡献类型无效');
  const rights = input.rights || 'reference_only';
  if (!RIGHTS.has(rights)) throw new Error('版权声明无效');
  if (input.shareConsent === true && rights === 'reference_only') throw new Error('仅供参考材料不能授权公益再分发');
  const direction = input.direction || 'neutral';
  const dimension = input.dimension || 'other';
  if (!['neutral','positive','negative'].includes(direction)) throw new Error('主张方向无效');
  if (!DIMENSIONS.has(dimension)) throw new Error('主张领域无效');
  if (['labour_claim','product_claim'].includes(kind) && direction === 'neutral') throw new Error('具体主张需明确正向或负向');
  const periodStart = safeDate(input.periodStart || '', '起始日期');
  const periodEnd = safeDate(input.periodEnd || '', '结束日期');
  if (periodStart && periodEnd && periodStart > periodEnd) throw new Error('起止日期顺序错误');
  const productId = input.productId || '';
  if (productId) {
    const product = state.contributions.find(x => x.id === productId && x.kind === 'product' && x.companyId === company.id && x.status !== 'WITHDRAWN');
    if (!product) throw new Error('产品必须来自同一公司空间');
  } else if (kind === 'product_claim') {
    throw new Error('产品体验主张必须指定产品');
  }
  const brandId = input.brandId || '';
  if (brandId) {
    const brand = state.contributions.find(x => x.id === brandId && x.kind === 'brand' && x.companyId === company.id && x.status !== 'WITHDRAWN');
    if (!brand) throw new Error('品牌必须来自同一公司空间');
  }
  const relationType = input.relationType || (kind === 'relationship' ? 'other' : '');
  if (relationType && !RELATION_TYPES.has(relationType)) throw new Error('关系类型无效');
  if (input.shareConsent === true && rights === 'permission' && !input.rightsNote) throw new Error('请说明允许再分发的授权依据');
  const sources = input.sources || [];
  if (!Array.isArray(sources) || sources.length > 10) throw new Error('最多10个来源');
  return {
    companyId: company.id,
    kind,
    title: safeText(input.title,{min:2,max:120,field:'标题'}),
    description: safeText(input.description,{min:2,max:2000,field:'说明'}),
    scope: safeText(input.scope || '',{min:0,max:300,field:'适用范围'}),
    periodStart, periodEnd, direction, dimension, productId, brandId, relationType,
    relation: safeText(input.relation || '',{min:0,max:80,field:'关系'}),
    category: safeText(input.category || '',{min:0,max:80,field:'类别'}),
    sources: sources.map(sourceInput),
    public: input.public !== false,
    shareConsent: input.shareConsent === true,
    rights,
    rightsNote: safeText(input.rightsNote || '',{min:0,max:500,field:'授权说明'}),
    creditName: safeText(input.creditName || '',{min:0,max:40,field:'公开署名'})
  };
}

export function addContribution(state, input, owner){
  const v = validateContributionInput(state,input);
  const createdAt = nowIso();
  const item = {
    id:id('con'), owner, ...v, version:1, evidence:'E0', status:'PENDING', exportApproved:false,
    createdAt, updatedAt:createdAt
  };
  state.contributions.push(item);
  return item;
}

export function updateContribution(state, contributionId, input, owner){
  const item = state.contributions.find(x => x.id === contributionId);
  if (!item || item.status === 'WITHDRAWN') throw new Error('未找到可修改贡献');
  if (item.owner !== owner) throw new Error('只能修改自己的贡献');
  const v = validateContributionInput(state, {...input, companyId:item.companyId, kind:item.kind});
  Object.assign(item, v, {version:item.version+1, evidence:'E0', status:'PENDING', exportApproved:false, updatedAt:nowIso()});
  for (const f of state.flags) if (f.contributionId === item.id && f.status === 'OPEN') f.status = 'SUPERSEDED';
  return item;
}

export function withdrawContribution(state, contributionId, owner){
  const item = state.contributions.find(x => x.id === contributionId);
  if (!item) throw new Error('贡献不存在');
  if (item.owner !== owner) throw new Error('只能撤回自己的贡献');
  item.status = 'WITHDRAWN'; item.exportApproved = false; item.updatedAt = nowIso();
  return item;
}

export function setBallot(state, companyId, owner, direction, signalType='community'){
  if (!state.companies.some(x => x.id === companyId)) throw new Error('公司不存在');
  if (![null,'positive','negative'].includes(direction)) throw new Error('社区评价只能是正向、负向或撤回');
  if (!['community','worker'].includes(signalType)) throw new Error('社区信号类型无效');
  state.ballots = state.ballots.filter(x => !(x.companyId === companyId && x.owner === owner && ballotSignalType(x) === signalType));
  if (direction) {
    const item={companyId,owner,direction,updatedAt:nowIso()};
    if(signalType==='worker') item.signalType='worker';
    state.ballots.push(item);
  }
  return {companyId,direction,signalType};
}

export function flagContribution(state, contributionId, owner, reason){
  const item = state.contributions.find(x => x.id === contributionId && x.status !== 'WITHDRAWN');
  if (!item) throw new Error('贡献不存在或已撤回');
  reason = safeText(reason,{min:5,max:1000,field:'纠错理由'});
  const existing = state.flags.find(x => x.contributionId === contributionId && x.owner === owner && x.status === 'OPEN');
  if (existing) return existing;
  const flag = {id:id('flag'), contributionId, owner, reason, status:'OPEN', createdAt:nowIso()};
  state.flags.push(flag);
  item.exportApproved = false;
  return flag;
}

export function reviewContribution(state, contributionId, review){
  const item = state.contributions.find(x => x.id === contributionId && x.status !== 'WITHDRAWN');
  if (!item) throw new Error('贡献不存在或已撤回');
  if (!review || typeof review !== 'object') throw new Error('审核需要结构化对象');
  const decision = review.decision;
  if (!['approve','reject','dispute','reopen'].includes(decision)) throw new Error('审核决定无效');
  let evidence = review.evidence || 'E0';
  if (!EVIDENCE_LEVELS.has(evidence)) throw new Error('证据等级无效');
  const rationale = safeText(review.rationale || '',{min:8,max:1000,field:'审核理由'});
  if (review.version !== item.version) throw new Error('版本已变化，请重新核对');
  let status;
  if (decision === 'approve') {
    if (review.scopeChecked !== true) throw new Error('需确认结论覆盖范围');
    const level = evidenceNumber(evidence);
    if (level >= 2 && item.sources.length === 0) throw new Error('E2以上必须有支持来源');
    if (level >= 3) {
      if (!item.scope || !item.periodStart || !item.periodEnd) throw new Error('E3以上必须明确范围和日期');
      if (review.authenticityChecked !== true) throw new Error('E3以上需记录来源真实性核对');
      const refs = Array.isArray(review.sourceIds) ? review.sourceIds : [];
      if (!refs.length || !refs.every(x => item.sources.some(s => s.id === x))) throw new Error('请选择实际支持该主张的来源');
    }
    if (evidence === 'E5') {
      const refs = Array.isArray(review.sourceIds) ? review.sourceIds : [];
      if (!item.sources.some(s => s.type === 'official_decision' && refs.includes(s.id))) throw new Error('E5需要支持同一主张的正式认定');
      if (!review.decisionReference || review.effective !== true) throw new Error('E5需明确正式决定编号与当前效力');
    }
    status = evidenceNumber(evidence) >= 3 ? 'VERIFIED' : 'REVIEWED';
  } else if (decision === 'reject') {
    evidence = 'E0'; status = 'REJECTED';
  } else if (decision === 'reopen') {
    evidence = 'E0'; status = 'PENDING';
  } else {
    evidence = item.evidence; status = 'DISPUTED';
  }
  const record = {
    id:id('review'), contributionId:item.id, version:item.version, decision, evidence, rationale,
    sourceIds:Array.isArray(review.sourceIds)?review.sourceIds:[], createdAt:nowIso()
  };
  state.reviews.push(record);
  item.status = status; item.evidence = evidence; item.exportApproved = false; item.updatedAt = nowIso();
  for (const f of state.flags) if (f.contributionId === item.id && f.status === 'OPEN') f.status = 'REVIEWED';
  return {item, record};
}

export function approveExport(state, contributionId, approval){
  const item = state.contributions.find(x => x.id === contributionId && x.status !== 'WITHDRAWN');
  if (!item) throw new Error('贡献不存在');
  if (!approval || approval.version !== item.version) throw new Error('版本已变化');
  if (!['REVIEWED','VERIFIED'].includes(item.status)) throw new Error('仅已复核公开版本可再分发');
  if (!item.public || !item.shareConsent || item.rights === 'reference_only') throw new Error('缺少独立公益再分发授权');
  if (state.flags.some(f => f.contributionId === item.id && f.status === 'OPEN')) throw new Error('存在待处理纠错，暂停再分发');
  const reason = safeText(approval.reason || '',{min:8,max:1000,field:'再分发复核理由'});
  if (approval.privacyChecked !== true || approval.rightsChecked !== true) throw new Error('再分发必须完成隐私与权利复核');
  item.exportApproved = true; item.updatedAt = nowIso();
  const record = {id:id('export'), contributionId:item.id, version:item.version, reason, createdAt:nowIso()};
  state.exportReviews.push(record);
  return {item, record};
}

export function publicContribution(item, owner=''){
  const isMine = Boolean(owner && item.owner === owner);
  const out = {
    id:item.id, companyId:item.companyId, kind:item.kind, title:item.title, description:item.description,
    scope:item.scope, periodStart:item.periodStart, periodEnd:item.periodEnd, direction:item.direction,
    dimension:item.dimension, productId:item.productId, brandId:item.brandId||'', relationType:item.relationType||'', relation:item.relation, category:item.category,
    sources:item.sources.map(({id,url,title,type,publishedAt,supports})=>({id,url,title,type,publishedAt,supports})),
    public:item.public, creditName:item.creditName || '匿名贡献者',
    version:item.version, evidence:item.evidence, status:item.status, exportApproved:item.exportApproved,
    createdAt:item.createdAt, updatedAt:item.updatedAt, isMine
  };
  if (isMine) Object.assign(out,{shareConsent:item.shareConsent,rights:item.rights,rightsNote:item.rightsNote});
  return out;
}

export function listContributions(state,{owner='',mine=false,companyId=''}={}){
  return state.contributions
    .filter(x => x.status !== 'WITHDRAWN')
    .filter(x => mine ? x.owner === owner : x.public)
    .filter(x => !companyId || x.companyId === companyId)
    .map(x => publicContribution(x,mine ? owner : ''));
}

export function showcase(state,lane='community_positive'){
  if (!['community_positive','community_negative','evidence_positive'].includes(lane)) throw new Error('展示分区无效');
  const today = new Date().toISOString().slice(0,10);
  const items=[];
  for (const company of state.companies) {
    const ballots = state.ballots.filter(x=>x.companyId===company.id&&ballotSignalType(x)==='community');
    const positive = ballots.filter(x=>x.direction==='positive').length;
    const negative = ballots.filter(x=>x.direction==='negative').length;
    const facts = state.contributions.filter(x=>x.companyId===company.id && x.public && x.status!=='WITHDRAWN' && x.status!=='REJECTED');
    const products = facts.filter(x=>x.kind==='product').map(x=>publicContribution(x));
    let verifiedPositive = facts.filter(x => x.kind==='labour_claim' && x.direction==='positive' && x.status==='VERIFIED' && evidenceNumber(x.evidence)>=3 && x.periodStart && x.periodEnd && x.periodStart<=today && today<=x.periodEnd);
    verifiedPositive = verifiedPositive.filter(x => !state.flags.some(f=>f.contributionId===x.id && f.status==='OPEN')).map(x=>publicContribution(x));
    const included = lane==='community_positive' ? positive>negative : lane==='community_negative' ? negative>positive : verifiedPositive.length>0;
    if (!included) continue;
    items.push({company:{id:company.id,name:company.name,region:company.region,website:company.website,synthetic:company.synthetic},positive,negative,participants:ballots.length,products,verifiedPositiveClaims:verifiedPositive});
  }
  items.sort((a,b)=> lane==='evidence_positive' ? b.verifiedPositiveClaims.length-a.verifiedPositiveClaims.length || a.company.name.localeCompare(b.company.name) : b.participants-a.participants || a.company.name.localeCompare(b.company.name));
  return {lane,items,method:'社区正负只由去重公司评价票决定；证据分区只认当前有效E3+具体正向劳动主张。'};
}

export function publicLabourSignalSummary(state,companyId){
  const communityBallots=(state.ballots||[]).filter(x=>x.companyId===companyId&&ballotSignalType(x)==='community');
  const workerBallots=(state.ballots||[]).filter(x=>x.companyId===companyId&&ballotSignalType(x)==='worker');
  const claims=(state.contributions||[])
    .filter(x=>x.companyId===companyId&&x.kind==='labour_claim'&&x.public&&x.status!=='WITHDRAWN'&&x.status!=='REJECTED');
  const strong=claims.filter(x=>x.status==='VERIFIED'&&evidenceNumber(x.evidence)>=3&&!state.flags.some(f=>f.contributionId===x.id&&f.status==='OPEN'));
  const strongest=strong.reduce((max,x)=>Math.max(max,evidenceNumber(x.evidence)),-1);
  const publicStrong=strong.map(x=>publicContribution(x));
  return {
    workerPerspective:{
      positive:workerBallots.filter(x=>x.direction==='positive').length,
      negative:workerBallots.filter(x=>x.direction==='negative').length,
      participants:workerBallots.length,
      boundary:'劳动者视角为参与者自报的在职/离职/求职/外包等劳动相关感受，不验证其劳动身份，也不自动证明具体事实。'
    },
    community:{
      positive:communityBallots.filter(x=>x.direction==='positive').length,
      negative:communityBallots.filter(x=>x.direction==='negative').length,
      participants:communityBallots.length,
      boundary:'社区总体评价表示参与者对公司的整体印象，不等于劳动事实、违法认定或产品质量评价。'
    },
    labourEvidence:{
      claimCount:claims.length,
      positiveClaims:claims.filter(x=>x.direction==='positive').length,
      negativeClaims:claims.filter(x=>x.direction==='negative').length,
      strongestEvidence:strongest>=0?`E${strongest}`:'',
      verifiedPositiveClaims:publicStrong.filter(x=>x.direction==='positive'),
      verifiedNegativeClaims:publicStrong.filter(x=>x.direction==='negative'),
      boundary:'证据等级只描述具体劳动主张在其来源、时间和范围内的支持强度；不会合成为企业道德总分。'
    }
  };
}

export function productMarket(state,lane='all'){
  const allowed=new Set(['all','worker_negative','worker_positive','evidence','community_attention']);
  if(!allowed.has(lane))throw new Error('产品展示分区无效');
  const items=[];
  for(const product of state.contributions||[]){
    if(product.kind!=='product'||!product.public||['WITHDRAWN','REJECTED'].includes(product.status))continue;
    const company=(state.companies||[]).find(x=>x.id===product.companyId);
    if(!company)continue;
    const signals=publicLabourSignalSummary(state,company.id);
    const strongCount=signals.labourEvidence.verifiedPositiveClaims.length+signals.labourEvidence.verifiedNegativeClaims.length;
    const include=lane==='all'
      ||(lane==='worker_negative'&&signals.workerPerspective.negative>0)
      ||(lane==='worker_positive'&&signals.workerPerspective.positive>0)
      ||(lane==='evidence'&&strongCount>0)
      ||(lane==='community_attention'&&signals.community.participants>0);
    if(!include)continue;
    items.push({
      product:{id:product.id,title:product.title,description:product.description,category:product.category||'',evidence:product.evidence,status:product.status},
      company:{id:company.id,name:company.name,region:company.region,website:company.website||'',synthetic:Boolean(company.synthetic)},
      ...signals,
      boundary:'产品卡片展示的是所属公司当前可见的劳动/社区上下文，供消费者自行判断；这些信号不构成产品质量、安全、违法或企业整体好坏结论。'
    });
  }
  const strongScore=x=>Math.max(evidenceNumber(x.labourEvidence.strongestEvidence),-1);
  items.sort((a,b)=>{
    if(lane==='worker_negative')return b.workerPerspective.negative-a.workerPerspective.negative||b.workerPerspective.participants-a.workerPerspective.participants||a.company.name.localeCompare(b.company.name)||a.product.title.localeCompare(b.product.title);
    if(lane==='worker_positive')return b.workerPerspective.positive-a.workerPerspective.positive||b.workerPerspective.participants-a.workerPerspective.participants||a.company.name.localeCompare(b.company.name)||a.product.title.localeCompare(b.product.title);
    if(lane==='evidence'){
      const aCount=a.labourEvidence.verifiedPositiveClaims.length+a.labourEvidence.verifiedNegativeClaims.length;
      const bCount=b.labourEvidence.verifiedPositiveClaims.length+b.labourEvidence.verifiedNegativeClaims.length;
      return strongScore(b)-strongScore(a)||bCount-aCount||a.company.name.localeCompare(b.company.name)||a.product.title.localeCompare(b.product.title);
    }
    if(lane==='community_attention')return b.community.participants-a.community.participants||a.company.name.localeCompare(b.company.name)||a.product.title.localeCompare(b.product.title);
    return a.company.name.localeCompare(b.company.name)||a.product.title.localeCompare(b.product.title);
  });
  const methods={
    all:'展示所有公开产品线索；公司劳动与社区信号只作为独立上下文。',
    worker_negative:'“劳工愤怒榜”只按自报劳动者视角的负向信号排序；它表达情绪/感受，不是事实认定或抵制指令。',
    worker_positive:'“劳工支持榜”只按自报劳动者视角的正向信号排序；它表达情绪/感受，不是企业认证。',
    evidence:'只展示存在当前有效 E3+ 具体劳动主张的产品所属公司，并按最强证据层级与已验证主张数量排序；正负方向仍分别展示。',
    community_attention:'按普通社区对公司的去重参与数量排序，表示关注度而不是劳动待遇或产品质量。'
  };
  return {lane,items,method:methods[lane],boundary:'劳动者视角、普通社区印象、具体劳动主张证据是三条独立通道；任何榜单都不能把情绪或热度升级成事实。'};
}

export function publicDataset(state){
  const categories = Object.fromEntries([...KINDS].sort().map(k=>[k,[]]));
  for (const item of state.contributions) {
    if (!item.public || !item.exportApproved || !['REVIEWED','VERIFIED'].includes(item.status)) continue;
    if (state.flags.some(f=>f.contributionId===item.id && f.status==='OPEN')) continue;
    const company = state.companies.find(x=>x.id===item.companyId);
    if (!company) continue;
    categories[item.kind].push({
      ...publicContribution(item), companyName:company.name, region:company.region, synthetic:company.synthetic,
      license:'LicenseRef-LTP-Public-Interest-1.0'
    });
  }
  return {
    schemaVersion:'0.8', license:'LicenseRef-LTP-Public-Interest-1.0',
    purpose:'仅限非商业公益用途；社区热度与证据等级分离；不授予第三方原文、商标或个人信息权利',
    generatedAt:nowIso(), categories,
    recordCount:Object.values(categories).reduce((n,rows)=>n+rows.length,0)
  };
}


const OFFICIAL_RELATION_TYPES = new Set(['COMPANY_REGISTERS_PRODUCT','COMPANY_OWNS_BRAND','BRAND_MARKETS_PRODUCT','COMPANY_PARENT_OF_COMPANY','COMPANY_SUBSIDIARY_OF_COMPANY','PUBLIC_PROCUREMENT_RELATION','OTHER_OFFICIAL_RELATION']);
function safeOfficialValue(value,max=800){
  const text=String(value??'').trim();if(text.length>max)throw new Error('官方结构化字段过长');if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text))throw new Error('官方结构化字段包含无效控制字符');return text;
}
function relationStableId(item){
  const parts=[item.provider,item.sourceRecordId,item.companyId,item.relationType,item.objectType,item.objectExternalId,item.objectName];
  return `orel_${crypto.createHash('sha256').update(parts.map(x=>String(x||'')).join('\u001f')).digest('hex').slice(0,24)}`;
}
function boundedRelationAttributes(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) return {};
  const out={};let n=0;
  for(const [key,raw] of Object.entries(value)){
    if(n>=20)break;
    if(!/^[A-Za-z0-9_]{1,64}$/.test(key))continue;
    if(typeof raw==='string')out[key]=safeOfficialValue(raw,800);
    else if(typeof raw==='number'&&Number.isFinite(raw))out[key]=raw;
    else if(typeof raw==='boolean')out[key]=raw;
    else if(Array.isArray(raw))out[key]=raw.slice(0,12).map(x=>safeOfficialValue(x,240));
    else continue;
    n++;
  }
  return out;
}
function referenceStableId(item){
  const parts=[item.provider,item.sourceRecordId,item.companyId,item.referenceType];
  return `oref_${crypto.createHash('sha256').update(parts.map(x=>String(x||'')).join('\u001f')).digest('hex').slice(0,24)}`;
}
function validateOfficialReferenceInput(state,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('官方参考需要结构化对象');
  const company=state.companies.find(x=>x.id===String(input.companyId||'')&&!x.synthetic);
  if(!company)throw new Error('官方参考必须绑定真实公司空间');
  const referenceType=String(input.referenceType||'');if(!OFFICIAL_REFERENCE_TYPES.has(referenceType))throw new Error('官方参考类型无效');
  const provider=safeText(input.provider,{min:2,max:80,field:'官方来源标识'});
  const sourceRecordId=safeOfficialValue(input.sourceRecordId,180);if(!sourceRecordId)throw new Error('官方记录标识不能为空');
  const item={
    companyId:company.id,provider,jurisdiction:safeText(input.jurisdiction||'',{min:0,max:20,field:'司法区'}),referenceType,
    sourceRecordId,sourceOfRecord:safeText(input.sourceOfRecord,{min:2,max:180,field:'官方来源名称'}),sourceUrl:safeUrl(input.sourceUrl),
    sourceDate:safeDate(input.sourceDate||'','来源日期'),observedAt:safeText(input.observedAt||nowIso(),{min:10,max:40,field:'观察时间'}),
    confidence:['HIGH','MEDIUM','LOW_MEDIUM'].includes(input.confidence)?input.confidence:'MEDIUM',
    bindingBasis:safeText(input.bindingBasis||'',{min:2,max:180,field:'绑定依据'}),
    scope:safeText(input.scope||'',{min:0,max:500,field:'参考范围'}),caveat:safeText(input.caveat||'',{min:8,max:900,field:'参考边界'}),
    fields:boundedRelationAttributes(input.fields),tier:'OFFICIAL_SOURCE_REFERENCE',status:'CURRENT'
  };
  return {...item,id:referenceStableId(item)};
}
export function upsertOfficialReferences(state,input){
  const rows=Array.isArray(input)?input:Array.isArray(input?.items)?input.items:[];
  if(!rows.length||rows.length>500)throw new Error('官方参考批次需为1—500条');
  const at=nowIso();const saved=[];
  for(const raw of rows){
    const next={...validateOfficialReferenceInput(state,raw),updatedAt:at};
    const index=state.officialReferences.findIndex(x=>x.id===next.id);
    if(index>=0){next.createdAt=state.officialReferences[index].createdAt||at;state.officialReferences[index]=next;}
    else {next.createdAt=at;state.officialReferences.push(next);}
    saved.push(next);
  }
  return {savedCount:saved.length,items:saved};
}
export function publicOfficialReferences(state,companyId){
  return (state.officialReferences||[]).filter(x=>x.companyId===companyId&&x.status==='CURRENT').map(x=>({
    id:x.id,tier:'OFFICIAL_SOURCE_REFERENCE',provider:x.provider,jurisdiction:x.jurisdiction,referenceType:x.referenceType,
    fields:x.fields||{},bindingBasis:x.bindingBasis,confidence:x.confidence,scope:x.scope,caveat:x.caveat,
    source:{sourceOfRecord:x.sourceOfRecord,url:x.sourceUrl,recordId:x.sourceRecordId,date:x.sourceDate||'',observedAt:x.observedAt},updatedAt:x.updatedAt
  })).sort((a,b)=>String(b.source.date||b.updatedAt||'').localeCompare(String(a.source.date||a.updatedAt||''))||a.id.localeCompare(b.id));
}
function validateOfficialRelationInput(state,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('官方关系需要结构化对象');
  const company=state.companies.find(x=>x.id===String(input.companyId||'')&&!x.synthetic);
  if(!company)throw new Error('官方关系必须绑定真实公司空间');
  const relationType=String(input.relationType||'');if(!OFFICIAL_RELATION_TYPES.has(relationType))throw new Error('官方关系类型无效');
  const provider=safeText(input.provider,{min:2,max:80,field:'官方来源标识'});
  const sourceRecordId=safeOfficialValue(input.sourceRecordId,180);if(!sourceRecordId)throw new Error('官方记录标识不能为空');
  const item={
    companyId:company.id,provider,jurisdiction:safeText(input.jurisdiction||'',{min:0,max:20,field:'司法区'}),
    relationType,subjectType:'company',subjectName:company.name,
    objectType:String(input.objectType||''),objectName:safeText(input.objectName,{min:2,max:240,field:'官方关系对象'}),
    objectExternalId:safeOfficialValue(input.objectExternalId||'',180),
    sourceRecordId,sourceOfRecord:safeText(input.sourceOfRecord,{min:2,max:180,field:'官方来源名称'}),sourceUrl:safeUrl(input.sourceUrl),
    sourceDate:safeDate(input.sourceDate||'','来源日期'),observedAt:safeText(input.observedAt||nowIso(),{min:10,max:40,field:'观察时间'}),
    confidence:['HIGH','MEDIUM','LOW_MEDIUM'].includes(input.confidence)?input.confidence:'HIGH',
    scope:safeText(input.scope||'',{min:0,max:500,field:'关系范围'}),
    caveat:safeText(input.caveat||'',{min:8,max:900,field:'关系边界'}),
    attributes:boundedRelationAttributes(input.attributes),tier:'OFFICIAL_SOURCE_RELATION',status:'CURRENT'
  };
  if(!['product','brand','company','contract','other'].includes(item.objectType))throw new Error('官方关系对象类型无效');
  return {...item,id:relationStableId(item)};
}
export function upsertOfficialRelations(state,input){
  const rows=Array.isArray(input)?input:Array.isArray(input?.items)?input.items:[];
  if(!rows.length||rows.length>500)throw new Error('官方关系批次需为1—500条');
  const at=nowIso();const saved=[];
  for(const raw of rows){
    const next={...validateOfficialRelationInput(state,raw),updatedAt:at};
    const index=state.officialRelations.findIndex(x=>x.id===next.id);
    if(index>=0){next.createdAt=state.officialRelations[index].createdAt||at;state.officialRelations[index]=next;}
    else {next.createdAt=at;state.officialRelations.push(next);}
    saved.push(next);
  }
  return {savedCount:saved.length,items:saved};
}
export function publicOfficialRelations(state,companyId){
  return (state.officialRelations||[]).filter(x=>x.companyId===companyId&&x.status==='CURRENT').map(x=>({
    id:x.id,tier:'OFFICIAL_SOURCE_RELATION',provider:x.provider,jurisdiction:x.jurisdiction,relationType:x.relationType,
    subject:{type:x.subjectType,name:x.subjectName},object:{type:x.objectType,name:x.objectName,externalId:x.objectExternalId,attributes:x.attributes||{}},
    source:{sourceOfRecord:x.sourceOfRecord,url:x.sourceUrl,recordId:x.sourceRecordId,date:x.sourceDate||'',observedAt:x.observedAt},
    confidence:x.confidence,scope:x.scope,caveat:x.caveat,updatedAt:x.updatedAt
  })).sort((a,b)=>String(b.source.date||b.updatedAt||'').localeCompare(String(a.source.date||a.updatedAt||''))||a.id.localeCompare(b.id));
}

function eventStableId(item){
  const parts=[item.provider,item.sourceRecordId,item.companyId,item.eventType];
  return `oevt_${crypto.createHash('sha256').update(parts.map(x=>String(x||'')).join('\u001f')).digest('hex').slice(0,24)}`;
}
function validateOfficialEventInput(state,input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('官方事件需要结构化对象');
  const company=state.companies.find(x=>x.id===String(input.companyId||'')&&!x.synthetic);
  if(!company)throw new Error('官方事件必须绑定真实公司空间');
  const eventType=String(input.eventType||'');if(!OFFICIAL_EVENT_TYPES.has(eventType))throw new Error('官方事件类型无效');
  const provider=safeText(input.provider,{min:2,max:80,field:'官方来源标识'});
  const sourceRecordId=safeOfficialValue(input.sourceRecordId,180);if(!sourceRecordId)throw new Error('官方事件记录标识不能为空');
  const eventDate=safeDate(input.eventDate||input.sourceDate||'','事件日期');
  const item={
    companyId:company.id,provider,jurisdiction:safeText(input.jurisdiction||'',{min:0,max:20,field:'司法区'}),eventType,
    title:safeText(input.title,{min:2,max:300,field:'官方事件标题'}),
    summary:safeText(input.summary||'',{min:0,max:1600,field:'官方事件摘要'}),
    eventDate,decisionNo:safeOfficialValue(input.decisionNo||'',120),status:safeOfficialValue(input.status||'',80),
    sourceRecordId,sourceOfRecord:safeText(input.sourceOfRecord,{min:2,max:180,field:'官方来源名称'}),sourceUrl:safeUrl(input.sourceUrl),
    sourceDate:safeDate(input.sourceDate||eventDate,'来源日期'),observedAt:safeText(input.observedAt||nowIso(),{min:10,max:40,field:'观察时间'}),
    confidence:['HIGH','MEDIUM','LOW_MEDIUM'].includes(input.confidence)?input.confidence:'HIGH',
    scope:safeText(input.scope||'',{min:0,max:700,field:'事件范围'}),caveat:safeText(input.caveat||'',{min:8,max:1000,field:'事件边界'}),
    attributes:boundedRelationAttributes(input.attributes),tier:'OFFICIAL_SOURCE_EVENT',recordStatus:'CURRENT'
  };
  return {...item,id:eventStableId(item)};
}
export function upsertOfficialEvents(state,input){
  const rows=Array.isArray(input)?input:Array.isArray(input?.items)?input.items:[];
  if(!rows.length||rows.length>500)throw new Error('官方事件批次需为1—500条');
  const at=nowIso();const saved=[];
  for(const raw of rows){
    const next={...validateOfficialEventInput(state,raw),updatedAt:at};
    const index=state.officialEvents.findIndex(x=>x.id===next.id);
    if(index>=0){next.createdAt=state.officialEvents[index].createdAt||at;state.officialEvents[index]=next;}
    else {next.createdAt=at;state.officialEvents.push(next);}
    saved.push(next);
  }
  return {savedCount:saved.length,items:saved};
}
export function publicOfficialEvents(state,companyId){
  return (state.officialEvents||[]).filter(x=>x.companyId===companyId&&x.recordStatus==='CURRENT').map(x=>({
    id:x.id,tier:'OFFICIAL_SOURCE_EVENT',provider:x.provider,jurisdiction:x.jurisdiction,eventType:x.eventType,
    title:x.title,summary:x.summary||'',eventDate:x.eventDate||'',decisionNo:x.decisionNo||'',status:x.status||'',attributes:x.attributes||{},
    source:{sourceOfRecord:x.sourceOfRecord,url:x.sourceUrl,recordId:x.sourceRecordId,date:x.sourceDate||'',observedAt:x.observedAt},
    confidence:x.confidence,scope:x.scope,caveat:x.caveat,updatedAt:x.updatedAt
  })).sort((a,b)=>String(b.eventDate||b.source.date||b.updatedAt||'').localeCompare(String(a.eventDate||a.source.date||a.updatedAt||''))||a.id.localeCompare(b.id));
}

function latestFeedbackResponse(state,feedbackId){return (state.communityFeedbackResponses||[]).filter(x=>x.feedbackId===feedbackId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]||null;}
export function addCommunityFeedback(state,input,owner){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('意见需要结构化对象');
  const type=String(input.type||'suggestion');if(!COMMUNITY_FEEDBACK_TYPES.has(type))throw new Error('意见类型无效');
  const companyId=String(input.companyId||'');if(companyId&&!state.companies.some(x=>x.id===companyId))throw new Error('关联公司空间不存在');
  if(input.consent!==true)throw new Error('请确认提交边界');
  const cutoff=Date.now()-24*60*60*1000;const recent=(state.communityFeedback||[]).filter(x=>x.owner===owner&&new Date(x.createdAt).getTime()>=cutoff).length;
  if(recent>=10)throw new Error('同一匿名会话24小时内最多提交10条意见，请先等待现有意见处理');
  const at=nowIso();const item={id:id('fb'),owner,type,companyId,message:safeAdvisoryText(input.message,{min:4,max:1600,field:'意见内容'}),status:'RECEIVED',createdAt:at,updatedAt:at};
  state.communityFeedback.push(item);return item;
}
function feedbackProjection(state,item){
  const response=latestFeedbackResponse(state,item.id);const company=state.companies.find(x=>x.id===item.companyId);
  return {id:item.id,type:item.type,company:company?{id:company.id,name:company.name,region:company.region}:null,message:item.message,status:item.status,createdAt:item.createdAt,updatedAt:item.updatedAt,response:response?{decision:response.decision,answer:response.answer,actions:response.actions,createdAt:response.createdAt}:null};
}
export function listOwnCommunityFeedback(state,owner){return (state.communityFeedback||[]).filter(x=>x.owner===owner).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(x=>feedbackProjection(state,x));}
export function communityAgentQueue(state){return (state.communityFeedback||[]).filter(x=>!['ANSWERED','CLOSED'].includes(x.status)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(x=>feedbackProjection(state,x));}
export function respondCommunityFeedback(state,feedbackId,input,agent='community-agent'){
  const item=(state.communityFeedback||[]).find(x=>x.id===feedbackId);if(!item)throw new Error('意见不存在');
  const decision=String(input?.decision||'answered');if(!['answered','accepted','planned','declined','needs_more_info'].includes(decision))throw new Error('意见处理决定无效');
  const answer=safeText(input?.answer||'',{min:4,max:2200,field:'意见答复'});
  const actions=Array.isArray(input?.actions)?input.actions.slice(0,8).map(x=>safeText(String(x),{min:2,max:300,field:'处理动作'})):[];
  const at=nowIso();const response={id:id('fbr'),feedbackId:item.id,decision,answer,actions,agent:safeText(agent,{min:2,max:80,field:'处理Agent'}),createdAt:at};
  state.communityFeedbackResponses.push(response);item.status=decision==='needs_more_info'?'NEEDS_MORE_INFO':'ANSWERED';item.updatedAt=at;return response;
}
function announcementSource(raw,index){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('公告来源需要结构化对象');
  return {id:`AS${index+1}`,label:safeText(raw.label,{min:2,max:180,field:'公告来源名称'}),url:safeUrl(raw.url)};
}
export function addPublicAnnouncement(state,input,agent='community-agent'){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('公告需要结构化对象');
  const day=safeDate(input.day||new Date().toISOString().slice(0,10),'公告日期');
  const items=Array.isArray(input.items)?input.items.slice(0,12).map(x=>safeText(String(x),{min:2,max:500,field:'公告事项'})):[];
  const sources=Array.isArray(input.sources)?input.sources.slice(0,12).map(announcementSource):[];
  const key=`announcement:${day}`;let row=(state.publicAnnouncements||[]).find(x=>x.key===key);const at=nowIso();
  const next={id:row?.id||id('ann'),key,day,title:safeText(input.title||`${day} 每日更新`,{min:2,max:120,field:'公告标题'}),summary:safeText(input.summary,{min:4,max:1600,field:'公告摘要'}),items,sources,agent:safeText(agent,{min:2,max:80,field:'公告Agent'}),createdAt:row?.createdAt||at,updatedAt:at};
  if(row)Object.assign(row,next);else state.publicAnnouncements.push(next);return next;
}
export function publicAnnouncements(state,limit=30){return (state.publicAnnouncements||[]).slice().sort((a,b)=>b.day.localeCompare(a.day)||b.updatedAt.localeCompare(a.updatedAt)).slice(0,Math.max(1,Math.min(100,Number(limit)||30))).map(x=>({id:x.id,day:x.day,title:x.title,summary:x.summary,items:x.items||[],sources:x.sources||[],updatedAt:x.updatedAt}));}
export function recordAgentDailyRun(state,input,agent='community-agent'){
  const day=safeDate(input?.day||new Date().toISOString().slice(0,10),'运行日期');const phase=String(input?.phase||'18');if(!['18','19'].includes(phase))throw new Error('Agent运行阶段无效');
  const key=`${day}:${phase}`;let row=(state.agentDailyRuns||[]).find(x=>x.key===key);const at=nowIso();
  const metrics=input?.metrics&&typeof input.metrics==='object'&&!Array.isArray(input.metrics)?boundedRelationAttributes(input.metrics):{};
  const next={id:row?.id||id('adr'),key,day,phase,status:['COMPLETED','PARTIAL','FAILED'].includes(input?.status)?input.status:'COMPLETED',summary:safeText(input?.summary||'',{min:4,max:1800,field:'每日Agent摘要'}),metrics,logRef:safeText(input?.logRef||'',{min:0,max:240,field:'工作记录引用'}),agent:safeText(agent,{min:2,max:80,field:'运行Agent'}),createdAt:row?.createdAt||at,updatedAt:at};
  if(row)Object.assign(row,next);else state.agentDailyRuns.push(next);return next;
}

function advisoryCompany(state, companyId){
  if (!companyId) return null;
  return state.companies.find(x=>x.id===companyId) || null;
}

export function validateAdvisoryInput(state,input){
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('匿名辅导需要结构化对象');
  const allowed=new Set(['category','companyId','region','employmentStatus','summary','desiredOutcome','tried','urgency','privacyConfirmed','consent']);
  for(const k of Object.keys(input)) if(!allowed.has(k)) throw new Error('匿名辅导包含未定义字段或当前不接收的私密信息字段');
  if(input.consent!==true || input.privacyConfirmed!==true) throw new Error('请确认匿名辅导边界并移除身份/联系方式/敏感信息');
  const category=String(input.category||'other');
  if(!ADVISORY_CATEGORIES.has(category)) throw new Error('辅导类别无效');
  const urgency=String(input.urgency||'routine');
  if(!ADVISORY_URGENCY.has(urgency)) throw new Error('紧急程度无效');
  const employmentStatus=String(input.employmentStatus||'other');
  if(!EMPLOYMENT_STATUS.has(employmentStatus)) throw new Error('工作关系状态无效');
  const companyId=String(input.companyId||'');
  if(companyId && !advisoryCompany(state,companyId)) throw new Error('关联公司空间不存在');
  return {
    category, companyId,
    region:safeAdvisoryText(input.region||'',{min:0,max:80,field:'地区范围'}),
    employmentStatus,
    summary:safeAdvisoryText(input.summary||'',{min:12,max:2200,field:'情况摘要'}),
    desiredOutcome:safeAdvisoryText(input.desiredOutcome||'',{min:4,max:800,field:'希望结果'}),
    tried:safeAdvisoryText(input.tried||'',{min:0,max:1200,field:'已尝试事项'}),
    urgency
  };
}

export function addAdvisoryCase(state,input,owner,receiptHash){
  const v=validateAdvisoryInput(state,input);
  if(!/^[a-f0-9]{64}$/.test(receiptHash||'')) throw new Error('匿名回执摘要无效');
  const cutoff=Date.now()-24*60*60*1000;
  const recent=state.advisoryCases.filter(x=>x.owner===owner && x.status!=='WITHDRAWN' && new Date(x.createdAt).getTime()>=cutoff).length;
  if(recent>=5) throw new Error('同一匿名会话24小时内最多提交5条辅导请求，请先等待现有待办处理');
  const at=nowIso();
  const item={id:id('adv'),owner,receiptHash,...v,status:'RECEIVED',createdAt:at,updatedAt:at,agentReadAt:'',advisedAt:''};
  state.advisoryCases.push(item);
  return item;
}

export function withdrawAdvisoryCase(state,caseId,owner){
  const item=state.advisoryCases.find(x=>x.id===caseId && x.owner===owner && x.status!=='WITHDRAWN');
  if(!item) throw new Error('未找到可撤回的匿名辅导记录');
  item.status='WITHDRAWN';item.updatedAt=nowIso();
  return {id:item.id,status:item.status};
}

function adviceFor(state,caseId){
  return state.advisoryAdvice.filter(x=>x.caseId===caseId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]||null;
}
function advisoryProjection(state,item){
  const advice=adviceFor(state,item.id);
  const company=advisoryCompany(state,item.companyId);
  return {
    id:item.id,category:item.category,company:company?{id:company.id,name:company.name,region:company.region}:null,
    region:item.region,employmentStatus:item.employmentStatus,summary:item.summary,desiredOutcome:item.desiredOutcome,
    tried:item.tried,urgency:item.urgency,status:item.status,createdAt:item.createdAt,updatedAt:item.updatedAt,
    advice:advice?{createdAt:advice.createdAt,situation:advice.situation,steps:advice.steps,cautions:advice.cautions,escalation:advice.escalation,automationNotice:advice.automationNotice}:null
  };
}

export function listOwnAdvisory(state,owner){
  return state.advisoryCases.filter(x=>x.owner===owner && x.status!=='WITHDRAWN').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(x=>advisoryProjection(state,x));
}

export function accessAdvisoryByReceipt(state,receiptHash){
  const item=state.advisoryCases.find(x=>x.receiptHash===receiptHash && x.status!=='WITHDRAWN');
  if(!item) throw new Error('未找到对应匿名回执');
  return advisoryProjection(state,item);
}

export function advisoryAgentQueue(state){
  return state.advisoryCases.filter(x=>!['WITHDRAWN','CLOSED'].includes(x.status) && !adviceFor(state,x.id)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(item=>{
    const company=advisoryCompany(state,item.companyId);
    return {id:item.id,category:item.category,company:company?{name:company.name,region:company.region}:null,region:item.region,employmentStatus:item.employmentStatus,summary:item.summary,desiredOutcome:item.desiredOutcome,tried:item.tried,urgency:item.urgency,status:item.status,createdAt:item.createdAt};
  });
}

function safeAgentText(value,{min=0,max=2000,field='字段'}={}){
  if(value===undefined||value===null)value='';
  if(typeof value!=='string')throw new Error(`${field}必须是文本`);
  value=value.trim();if(value.length<min||value.length>max)throw new Error(`${field}长度需为${min}—${max}字`);
  if(EMAIL_RE.test(value)||LONG_NUMBER_RE.test(value))throw new Error(`${field}不能包含实际邮箱、电话或长数字标识`);
  return value;
}
function safeAdviceList(values,field,max=8){
  if(!Array.isArray(values) || values.length<1 || values.length>max) throw new Error(`${field}数量无效`);
  return values.map((v,i)=>safeAgentText(v,{min:4,max:700,field:`${field}${i+1}`}));
}

export function addAdvisoryAdvice(state,caseId,input,agent='project-agent'){
  const item=state.advisoryCases.find(x=>x.id===caseId && !['WITHDRAWN','CLOSED'].includes(x.status));
  if(!item) throw new Error('匿名辅导记录不存在或已关闭');
  if(adviceFor(state,caseId)) throw new Error('该匿名辅导已经生成建议；如需更新应创建明确的新版本流程');
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('建议需要结构化对象');
  const situation=safeAgentText(input.situation||'',{min:8,max:1200,field:'情况理解'});
  const steps=safeAdviceList(input.steps,'操作建议',8);
  const cautions=safeAdviceList(input.cautions||['不要公开身份、联系方式或可识别同事的信息。'],'注意事项',6);
  const escalation=safeAgentText(input.escalation||'如涉及紧迫安全风险、法定时限或重大权益损失，请尽快核对当地官方劳动机构、工会、法律援助或持证专业人士的正式渠道。',{min:8,max:1000,field:'升级建议'});
  const automationNotice='如需未来全自动持续跟进，需要与项目方另行建立专门联系渠道；当前公开站不收集联系方式，也未配置自动外部联系或正式机构代提交。';
  const record={id:id('advice'),caseId,agent:safeText(agent,{min:2,max:80,field:'Agent标识'}),situation,steps,cautions,escalation,automationNotice,createdAt:nowIso()};
  state.advisoryAdvice.push(record);
  item.status='ADVISED';item.agentReadAt=item.agentReadAt||record.createdAt;item.advisedAt=record.createdAt;item.updatedAt=record.createdAt;
  return {case:item,advice:record};
}

const CATEGORY_LABELS={pay:'薪酬/工资',hours_rest:'工时/休息',contract:'合同/用工关系',termination:'离职/解除',safety:'工作安全',respect:'尊重/不当对待',representation:'代表权/集体沟通',other:'其他'};
const CATEGORY_STEPS={
  pay:['把工资周期、约定标准、实际到账与差额按时间顺序整理成表格。','保留合同、工资单、排班/工时记录等你合法持有的材料，不要在公开站上传原件。','根据所在地区核对官方劳动主管部门、工会或法律援助对工资争议的时限和提交要求。'],
  hours_rest:['按日期记录实际上下班、休息、加班和排班变更，区分事实记录与个人判断。','对照劳动合同、员工手册和当地官方规则，列出你认为不一致的具体日期和事项。','先确定希望结果是补休、调整排班、补偿还是停止持续问题，再选择内部沟通或正式渠道。'],
  contract:['整理合同版本、变更通知和关键时间线，明确哪些内容是书面约定、哪些只是口头说明。','把希望确认的问题拆成主体、岗位、期限、薪酬、地点和解除条件等可核对项。','在签署新文件、放弃权利或接近法定时限前，优先咨询当地工会、法律援助或持证专业人士。'],
  termination:['保存你合法持有的解除/离职通知、合同和时间线，不要在公开站提交原件。','列出解除理由、通知日期、最后工作日、未结工资/假期等待核对事项。','尽快核对所在地申诉或仲裁时限；如时间紧迫，优先联系当地正式劳动渠道或专业人士。'],
  safety:['先区分“立即危险”和“需要整改的问题”；如存在立即人身危险，应优先使用当地紧急/安全主管机构渠道。','记录危险发生时间、地点类别、设备/流程和已做的内部报告，不在公开站披露可识别个人信息。','保留你合法持有的安全通知、培训记录或整改回复，并核对当地职业安全正式渠道。'],
  respect:['把事件按日期、场景、发生行为和影响整理，避免在公开区域写入个人姓名或联系方式。','记录你已使用的内部政策/申诉渠道及回应，区分事实、推测和情绪感受。','如涉及歧视、骚扰或报复风险，核对当地平等就业/劳动主管机构、工会或法律援助渠道。'],
  representation:['明确你希望进行的是个人沟通、集体意见表达、代表参与还是工会相关事项。','整理已有政策、会议通知和你合法持有的沟通记录，避免公开其他人的身份。','核对所在地关于员工代表、集体协商或工会活动的正式规则和保护边界。'],
  other:['先建立一条简洁时间线：发生了什么、何时发生、你已经做了什么、希望得到什么结果。','把现有材料分成“事实证明”“背景参考”“个人判断”，不要把未核实判断当作事实。','根据问题所属地区和类型，寻找官方劳动部门、工会、法律援助或持证专业人士确认下一步和时限。']
};

export function baselineAdvisoryAdvice(item){
  const label=CATEGORY_LABELS[item.category]||'其他';
  const situation=`这是一条“${label}”类匿名辅导请求。系统只根据你提供的非敏感摘要给出操作整理建议，不构成法律意见，也不代表任何机构已经受理。你当前希望的结果是：${item.desiredOutcome}`;
  const steps=[...(CATEGORY_STEPS[item.category]||CATEGORY_STEPS.other)];
  if(item.tried) steps.push('你已经尝试过一些处理：请把每一步的日期、结果和仍未解决的问题单独列出，避免重复无效沟通。');
  if(item.urgency==='urgent') steps.unshift('你将此事标记为紧急：优先检查是否存在人身安全、报复风险或即将到期的正式时限；这些情况不要等待平台日常处理。');
  const cautions=['不要在本平台提交姓名、手机号、邮箱、身份证明、家庭住址、健康/支付信息或敏感附件。','在对外提交任何材料前，确认接收机构、适用地区、时限、所需实名程度和材料范围。'];
  const escalation=item.urgency==='urgent'?'如存在立即危险、报复威胁、重大金额或临近法定时限，请立即使用所在地正式劳动/安全机构、工会、法律援助或持证专业人士渠道，不要只依赖本平台。':'如问题涉及法定时限、重大金额、解除劳动关系、安全或歧视等高影响事项，请核对所在地正式劳动机构、工会、法律援助或持证专业人士渠道。';
  return {situation,steps:steps.slice(0,8),cautions,escalation};
}

function dayInZone(isoValue,timeZone){
  try{return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(isoValue));}
  catch{return String(isoValue||'').slice(0,10);}
}
function publicCategoryCounts(items){
  const counts={};for(const x of items)counts[x.category]=(counts[x.category]||0)+1;
  const out={};let small=0;
  for(const [k,v] of Object.entries(counts)){if(v>=3)out[CATEGORY_LABELS[k]||k]=v;else small+=v;}
  if(small)out['其他/小样本合并']=small;
  return out;
}

export function generateAdvisoryDailyReport(state,{day,timeZone='Asia/Shanghai'}={}){
  day=day||dayInZone(nowIso(),timeZone);
  const received=state.advisoryCases.filter(x=>dayInZone(x.createdAt,timeZone)===day && x.status!=='WITHDRAWN');
  const advised=state.advisoryAdvice.filter(x=>dayInZone(x.createdAt,timeZone)===day);
  const pending=state.advisoryCases.filter(x=>!['WITHDRAWN','CLOSED','ADVISED'].includes(x.status));
  const report={id:`advisory-daily-${day}`,day,generatedAt:nowIso(),receivedCount:received.length,advisedCount:advised.length,pendingCount:pending.length,categories:publicCategoryCounts(received),privacy:'只公开聚合数量；小样本类别合并；不含个案正文、公司、回执码或个人标识。',statement:`${day} 收到 ${received.length} 条匿名辅导/申诉咨询请求；当日生成 ${advised.length} 条私有建议；当前待处理 ${pending.length} 条。`};
  state.advisoryDailyReports=state.advisoryDailyReports.filter(x=>x.day!==day);state.advisoryDailyReports.push(report);
  return report;
}

export function runAdvisoryAgent(state,{day,timeZone='Asia/Shanghai',agent='project-agent'}={}){
  const queue=advisoryAgentQueue(state);const processed=[];
  for(const item of queue){const advice=baselineAdvisoryAdvice(item);const out=addAdvisoryAdvice(state,item.id,advice,agent);processed.push(out.case.id);}
  const report=generateAdvisoryDailyReport(state,{day,timeZone});
  return {processedCount:processed.length,processedIds:processed,report};
}

export function publicAdvisoryReports(state,limit=30){
  return [...state.advisoryDailyReports].sort((a,b)=>b.day.localeCompare(a.day)).slice(0,Math.max(1,Math.min(90,limit))).map(x=>structuredClone(x));
}

export function reviewQueue(state){
  return state.contributions.filter(x=>x.public && x.status!=='WITHDRAWN' && x.owner!=='system').map(x=>({
    ...publicContribution(x),
    flags:state.flags.filter(f=>f.contributionId===x.id && f.status==='OPEN').map(({id,reason,createdAt})=>({id,reason,createdAt}))
  }));
}
