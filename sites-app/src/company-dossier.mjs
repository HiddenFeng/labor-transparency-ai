import {publicContribution,publicOfficialReferences,publicOfficialRelations,publicOfficialEvents} from './domain.mjs';
import {publicCompanyResearch} from './research-status.mjs';

function isChinaCompany(company){return /(^|[\s,，·/])(cn|china)($|[\s,，·/])|中国|中华人民共和国|中国大陆/i.test(String(company?.region||''));}
function buildChinaInvestigation(company,research,officialReferences,officialRelations,officialEvents,contributions){
  if(!isChinaCompany(company))return null;
  const penalties=officialEvents.filter(x=>x.eventType==='ADMINISTRATIVE_PENALTY');
  const measures=officialEvents.filter(x=>x.eventType==='REGULATORY_MEASURE');
  const recalls=officialEvents.filter(x=>x.eventType==='PRODUCT_RECALL');
  const products=officialRelations.filter(x=>x.relationType==='COMPANY_REGISTERS_PRODUCT');
  const procurement=officialRelations.filter(x=>x.relationType==='PUBLIC_PROCUREMENT_RELATION');
  const disclosureRefs=officialReferences.filter(x=>x.referenceType==='DISCLOSURE_REGISTRY');
  const legalRefs=officialReferences.filter(x=>x.referenceType==='LEGAL_ENTITY_REGISTRY');
  const legalIdentityStatus=research?.intelligence?.identity?.status||'NO_RESEARCH_REFERENCE';
  const gaps=[];
  if(!legalRefs.length&&legalIdentityStatus!=='AUTO_BOUND_REFERENCE')gaps.push({code:'CN_LEGAL_IDENTITY_NOT_STRICTLY_BOUND',label:'法律主体仍需官方登记核验',detail:'当前没有可公开自动化的全国工商严格绑定；GSXT 保留为官方核验入口，不绕验证码或反爬。'});
  if(!disclosureRefs.length)gaps.push({code:'CN_LISTING_DISCLOSURE_NOT_BOUND',label:'尚无交易所/披露登记严格绑定',detail:'已接入上交所证券代码→公司概况双重核验，以及深交所官方股票列表完整名称精确核验；未精确命中不代表企业未上市，北交所仍是明确覆盖缺口。'});
  if(!products.length)gaps.push({code:'CN_PRODUCT_RELATION_LIMITED',label:'官方产品关系覆盖有限',detail:'NMPA UDI 目前只覆盖医疗器械；没有命中不代表企业没有产品。'});
  if(!penalties.length&&!measures.length)gaps.push({code:'CN_REGULATORY_EVENT_NO_MATCH',label:'当前未命中证监处罚/监管事件',detail:'未命中只表示已接入来源当前没有精确公司记录，不代表不存在其他行政、司法或地方监管事项。'});
  if(!recalls.length)gaps.push({code:'CN_RECALL_NO_MATCH',label:'当前未命中召回事件',detail:'召回源仅覆盖国家市场监管总局缺陷产品召回中心公开范围；未命中不代表产品不存在其他质量或安全问题。'});
  if(!procurement.length)gaps.push({code:'CN_PROCUREMENT_NOT_AUTOMATED',label:'政府采购关系仍待安全自动化',detail:'中国政府采购网公开公告可核验，但带验证码的搜索路径不会被绕过；当前不据此声称没有政府采购关系。'});
  if(!(contributions?.labourClaims||[]).length)gaps.push({code:'CN_LABOUR_PUBLIC_DATA_LIMITED',label:'劳动实践公开数据仍有限',detail:'全国劳动监察/仲裁没有统一可安全自动化的企业级公开接口；社区劳动主张和正式来源必须继续分层。'});
  return {
    jurisdiction:'CN',
    status:(officialReferences.length||officialRelations.length||officialEvents.length||research)?'PARTIAL_EVIDENCE':'LIMITED_DATA',
    summary:`已接入中国官方来源：登记参考 ${officialReferences.length} 条、官方关系 ${officialRelations.length} 条、官方事件 ${officialEvents.length} 条；所有结论仅限具体来源记录，不生成企业整体好坏评分。`,
    dimensions:{
      identity:{legalIdentityStatus,officialReferenceCount:legalRefs.length,openContextCount:research?.intelligence?.coverage?.openContextReferences||0},
      listingDisclosure:{officialReferenceCount:disclosureRefs.length,providers:[...new Set(disclosureRefs.map(x=>x.provider).filter(Boolean))]},
      brandProducts:{officialProductRelations:products.length,communityBrands:(contributions?.brands||[]).length,communityProducts:(contributions?.products||[]).length},
      regulatory:{administrativePenalties:penalties.length,regulatoryMeasures:measures.length,latest:[...penalties,...measures].slice().sort((a,b)=>String(b.eventDate).localeCompare(String(a.eventDate))).slice(0,5)},
      recalls:{count:recalls.length,latest:recalls.slice(0,5)},
      procurement:{officialRelations:procurement.length},
      labour:{communityClaims:(contributions?.labourClaims||[]).length,officialAutomatedCoverage:'LIMITED'}
    },
    sourceCoverage:[
      {provider:'CN_NMPA_UDI',label:'国家药监局 UDI',mode:'AUTOMATED_EXACT_MATCH',scope:'医疗器械注册人/备案人 ↔ 产品记录'},
      {provider:'CN_SSE_LISTING',label:'上海证券交易所股票列表 / 公司概况',mode:'AUTOMATED_CODE_PLUS_EXACT_FULL_NAME',scope:'证券代码候选 → 官方公司概况完整名称精确复核；只形成上市/披露参考'},
      {provider:'CN_SZSE_LISTING',label:'深圳证券交易所股票列表',mode:'AUTOMATED_EXACT_FULL_NAME_REPORT',scope:'官方股票列表完整公司名称唯一精确匹配；只形成上市/披露参考'},
      {provider:'CN_SAMR_RECALL',label:'市场监管总局缺陷产品召回',mode:'AUTOMATED_EXACT_MATCH',scope:'具体汽车/消费品召回公告'},
      {provider:'CN_CSRC_PENALTY',label:'中国证监会行政处罚',mode:'AUTOMATED_EXACT_MATCH',scope:'具体行政处罚决定'},
      {provider:'CN_GSXT',label:'国家企业信用信息公示系统',mode:'OFFICIAL_LOOKUP_ONLY',scope:'工商/企业信用官方核验入口'},
      {provider:'CN_CNIPA_TRADEMARK',label:'国家知识产权局商标查询',mode:'OFFICIAL_LOOKUP_ONLY',scope:'商标申请/注册/权利人核验'}
    ],
    gaps,
    boundary:'中国企业调查页是来源分层的证据索引，不是信用评级、违法推定、雇主评分或产品质量评分。未命中、未接入和不适用都必须保留为未知。'
  };
}

function groupedContributions(state,companyId){
  const groups={brands:[],products:[],companyFacts:[],relationships:[],labourClaims:[],productClaims:[]};
  for(const item of state?.contributions||[]){
    if(item.companyId!==companyId||!item.public||['WITHDRAWN','REJECTED'].includes(item.status))continue;
    const value=publicContribution(item);
    if(item.kind==='brand')groups.brands.push(value);
    else if(item.kind==='product')groups.products.push(value);
    else if(item.kind==='company_fact')groups.companyFacts.push(value);
    else if(item.kind==='relationship')groups.relationships.push(value);
    else if(item.kind==='labour_claim')groups.labourClaims.push(value);
    else if(item.kind==='product_claim')groups.productClaims.push(value);
  }
  for(const rows of Object.values(groups))rows.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))||String(a.id).localeCompare(String(b.id)));
  return groups;
}

export function publicCompanyDetail(state,companyId){
  const company=(state?.companies||[]).find(x=>x.id===companyId);
  if(!company)return null;
  const ballots=(state?.ballots||[]).filter(x=>x.companyId===companyId);
  const positive=ballots.filter(x=>x.direction==='positive').length;
  const negative=ballots.filter(x=>x.direction==='negative').length;
  const researchRecord=(state?.companyResearch||[]).find(x=>x.companyId===companyId);
  const research=publicCompanyResearch(researchRecord);
  const contributions=groupedContributions(state,companyId);
  const officialReferences=publicOfficialReferences(state,companyId);
  const officialRelations=publicOfficialRelations(state,companyId);
  const officialEvents=publicOfficialEvents(state,companyId);
  const contributionCount=Object.values(contributions).reduce((n,rows)=>n+rows.length,0);
  const chinaInvestigation=buildChinaInvestigation(company,research,officialReferences,officialRelations,officialEvents,contributions);
  const updatedAt=[research?.collectedAt,company.updatedAt,company.createdAt,...officialReferences.map(x=>x.updatedAt),...officialRelations.map(x=>x.updatedAt),...officialEvents.map(x=>x.updatedAt),...Object.values(contributions).flat().map(x=>x.updatedAt||x.createdAt)].filter(Boolean).sort().at(-1)||null;
  return {
    company:{id:company.id,name:company.name,region:company.region,website:company.website||'',synthetic:Boolean(company.synthetic),createdAt:company.createdAt||null},
    community:{positive,negative,participants:ballots.length,boundary:'社区反馈只表示参与者的正向/负向感受，不改变机器资料、来源信号或贡献证据等级。'},
    research,
    officialReferences,
    officialRelations,
    officialEvents,
    chinaInvestigation,
    contributions,
    contributionCount,
    updatedAt,
    boundary:'公司详情把社区反馈、机器参考事实、官方登记参考、官方来源关系、官方事件、开放知识上下文、公共记录事件候选和用户贡献分层展示；任一层都不能自动扩张成公司整体好坏、违法或产品质量结论。'
  };
}
