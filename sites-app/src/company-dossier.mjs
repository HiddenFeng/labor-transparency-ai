import {publicContribution} from './domain.mjs';
import {publicCompanyResearch} from './research-status.mjs';

function groupedContributions(state,companyId){
  const groups={products:[],companyFacts:[],relationships:[],labourClaims:[],productClaims:[]};
  for(const item of state?.contributions||[]){
    if(item.companyId!==companyId||!item.public||['WITHDRAWN','REJECTED'].includes(item.status))continue;
    const value=publicContribution(item);
    if(item.kind==='product')groups.products.push(value);
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
  const contributionCount=Object.values(contributions).reduce((n,rows)=>n+rows.length,0);
  return {
    company:{id:company.id,name:company.name,region:company.region,website:company.website||'',synthetic:Boolean(company.synthetic),createdAt:company.createdAt||null},
    community:{positive,negative,participants:ballots.length,boundary:'社区反馈只表示参与者的正向/负向感受，不改变机器资料、来源信号或贡献证据等级。'},
    research,
    contributions,
    contributionCount,
    updatedAt:research?.collectedAt||company.updatedAt||company.createdAt||null,
    boundary:'公司详情把社区反馈、机器参考事实、开放知识上下文、公共记录事件候选和用户贡献分层展示；任一层都不能自动扩张成公司整体好坏、违法或产品质量结论。'
  };
}
