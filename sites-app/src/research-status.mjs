export const COMPANY_RESEARCH_COVERAGE = Object.freeze({
  status:'MULTI_SOURCE_AUTOMATION_PARTIAL_GLOBAL_COVERAGE',
  runtime:'PYTHON_MULTI_SOURCE_BACKOFFICE_PLUS_CLOUDFLARE_PUBLIC_API',
  pipeline:{
    queue:'IMPLEMENTED',
    boundedCollector:'IMPLEMENTED',
    retryLeaseBudgetCache:'IMPLEMENTED',
    identityDisambiguation:'IMPLEMENTED_GLEIF_ROOT',
    providerSpecificBinding:'IMPLEMENTED',
    independentReview:'IMPLEMENTED',
    scheduledRelease:'IMPLEMENTED',
    requesterFollowerNotice:'IMPLEMENTED',
    persistentState:'IMPLEMENTED_SQLITE_BACKOFFICE',
    publicationRule:'UNRESOLVED_SOURCE_CANDIDATES_ARE_NOT_FACTS'
  },
  sections:[
    {key:'identity',label:'法律实体身份',status:'AUTOMATED_SUPPORTED',source:'GLEIF；OpenCorporates 为可选 token/许可复核来源',scope:'法律名称、LEI、登记国家/地区、法律辖区、实体/维护状态；OpenCorporates 默认关闭'},
    {key:'ownership',label:'母子公司与品牌',status:'AUTOMATED_PARTIAL',source:'GLEIF + 绑定后的 Wikidata；OpenCorporates 可选',scope:'GLEIF直接/最终会计合并母公司；Wikidata上下级/子组织仅作上下文，不等于完整股权或控制关系'},
    {key:'business',label:'业务/产品/公开披露',status:'AUTOMATED_PARTIAL_REGION_LIMITED',source:'SEC EDGAR（美国公开申报主体）+ Wikidata + DOL WHD 行业上下文 + USAspending award 描述',scope:'CIK、ticker、交易所、SIC、近期申报、部分XBRL财务事实、行业/成立时间/产品或品牌上下文，以及特定政府award描述；仍不等于完整产品目录或全部市场数据'},
    {key:'facilities',label:'总部/厂区/用工地点',status:'AUTOMATED_PARTIAL_REGION_LIMITED',source:'Wikidata总部 + 美国 OSHA/WHD/F-7/representation/work-stoppage 记录涉及地点；Open Supply Hub 可选 token 候选',scope:'总部或执法记录涉及地点，不代表企业全部工厂/办公室；供应链设施须独立绑定与复核'},
    {key:'supply_chain',label:'供应链/客户/合作关系',status:'AUTOMATED_PARTIAL_REGION_LIMITED',source:'USAspending 美国联邦award关系 + Open Supply Hub（需 token/订阅）的设施/供应链候选',scope:'美国联邦合同可自动形成具体政府客户/award关系；OS Hub 可补设施/产品/加工/parent候选。两者都不能代表企业完整全球供应链/客户网络'},
    {key:'work_conditions',label:'劳动执法/工会案件/社区证据',status:'AUTOMATED_PARTIAL_REGION_LIMITED',source:'美国 NLRB 案件 + OSHA 执法 + WHD已结案行动 + FMCS F-7/停工 + NLRB voluntary recognition + OLMS employer/consultant disclosures + 社区证据',scope:'案件、charge、petition、inspection、citation、已结案WHD行动、集体谈判通知、认可、停工及LM披露都保留各自程序/记录原义；只有来源本身明确的agency finding可按具体案件表达，不能外推公司整体'},
    {key:'channels',label:'官方沟通/申诉渠道',status:'AUTOMATED_PARTIAL_CONTEXT_ONLY',source:'绑定后的 Wikidata 官网 + 地区权益资源目录',scope:'官网仅作公开入口，不冒充专用劳动申诉渠道；全球统一正式投诉渠道来源尚不存在'}
  ],
  optionalSources:[
    {provider:'OPENCORPORATES',status:'OPTIONAL_TOKEN_LICENSE_REVIEW_REQUIRED',reason:'API key required; open-data usage has share-alike attribution terms that must be reviewed against this project license.'},
    {provider:'OPEN_SUPPLY_HUB',status:'OPTIONAL_TOKEN_SUBSCRIPTION',reason:'API token/trial or subscription required; facility relationship remains a candidate until provenance review.'}
  ],
  claimBoundary:'自动研究已从 GLEIF 单源扩展为多源候选/绑定/复核流程。当前能够自动覆盖若干法律实体、美国公开申报、开放知识图谱、美国 NLRB/OSHA/WHD/FMCS/OLMS 劳工记录和 USAspending 联邦award关系；它仍不是“全球所有公司所有数据”的完整镜像。没有来源、未绑定候选、地区不适用和来源不可达都会显式保留为未知。'
});

export function companyResearchCoverage(){return structuredClone(COMPANY_RESEARCH_COVERAGE);}
