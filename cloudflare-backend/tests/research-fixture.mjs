import assert from 'node:assert/strict';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}});}

export function makeResearchFetch({failProviders=[]}={}){
  const failed=new Set(failProviders);
  return async function mockFetch(input,init={}){
    const u=new URL(String(input));
    if(u.hostname==='api.gleif.org')return failed.has('GLEIF')?json({error:'down'},503):json({data:[{id:'OQSJ1DU9TAOC51A47K68',attributes:{lei:'OQSJ1DU9TAOC51A47K68',entity:{legalName:{name:'ACME CORPORATION'},legalAddress:{country:'US'},jurisdiction:'US-CA',status:'ACTIVE'},registration:{status:'ISSUED'}}}]});
    if(u.hostname==='www.wikidata.org'){
      if(failed.has('WIKIDATA'))return json({error:'down'},503);
      const action=u.searchParams.get('action');
      if(action==='wbsearchentities'){
        const q=u.searchParams.get('search')||'';
        if(q==='星宇股份有限公司')return json({search:[]});
        if(q==='星宇股份'||q==='星宇')return json({search:[{id:'QCN',label:'常州星宇车灯股份有限公司',description:'一家研制、生产、销售汽车车灯的专业厂家'}]});
        return json({search:[{id:'Q1',label:'Acme Corporation',description:'fixture manufacturer'}]});
      }
      if(action==='wbgetentities'){
        const ids=(u.searchParams.get('ids')||'').split('|');const entities={};
        const related={Q148:'中华人民共和国',Q30:'美国',Q100:'汽车零部件产业',Q200:'常州',Q201:'Fixture City',Q300:'汽车灯',Q301:'电子零件',Q400:'上海证券交易所',Q401:'Fixture Exchange',Q500:'股份有限公司',Q501:'corporation'};
        for(const id of ids){
          if(id==='Q1')entities[id]={id,labels:{en:{language:'en',value:'ACME CORPORATION'}},descriptions:{en:{language:'en',value:'fixture manufacturer'}},claims:{P17:[{mainsnak:{datavalue:{value:{id:'Q30'}}}}],P856:[{mainsnak:{datavalue:{value:'https://example.com/'}}}],P571:[{mainsnak:{datavalue:{value:{time:'+1999-01-01T00:00:00Z'}}}}],P452:[{mainsnak:{datavalue:{value:{id:'Q100'}}}}],P159:[{mainsnak:{datavalue:{value:{id:'Q201'}}}}],P1056:[{mainsnak:{datavalue:{value:{id:'Q301'}}}}],P414:[{mainsnak:{datavalue:{value:{id:'Q401'}}}}],P1454:[{mainsnak:{datavalue:{value:{id:'Q501'}}}}]},sitelinks:{enwiki:{title:'Acme Corporation'}}};
          else if(id==='QCN')entities[id]={id,labels:{zh:{language:'zh',value:'常州星宇车灯股份有限公司'},en:{language:'en',value:'Changzhou Xingyu Automotive Lighting Systems Co.,Ltd.'}},descriptions:{zh:{language:'zh',value:'一家研制、生产、销售汽车车灯的专业厂家'}},claims:{P17:[{mainsnak:{datavalue:{value:{id:'Q148'}}}}],P856:[{mainsnak:{datavalue:{value:'https://www.xyl.cn/'}}}],P571:[{mainsnak:{datavalue:{value:{time:'+1993-00-00T00:00:00Z'}}}}],P452:[{mainsnak:{datavalue:{value:{id:'Q100'}}}}],P159:[{mainsnak:{datavalue:{value:{id:'Q200'}}}}],P1056:[{mainsnak:{datavalue:{value:{id:'Q300'}}}}],P414:[{mainsnak:{datavalue:{value:{id:'Q400'}}}}],P1454:[{mainsnak:{datavalue:{value:{id:'Q500'}}}}]},sitelinks:{zhwiki:{title:'星宇股份'},enwiki:{title:'Changzhou Xingyu Automotive Lighting Systems'}}};
          else if(related[id])entities[id]={id,labels:{zh:{language:'zh',value:related[id]},en:{language:'en',value:related[id]}}};
        }
        return json({entities});
      }
      return json({});
    }
    if(u.hostname==='www.sec.gov')return failed.has('SEC_EDGAR')?json({error:'down'},503):json({'0':{cik_str:123456,ticker:'ACME',title:'ACME CORPORATION'}});
    if(u.hostname==='labordata.bunkum.us'){
      const cases=[
        ['NLRB_CASES','/nlrb/',[{case_number:'01-CA-1',name:'Acme Corporation',state:'CA',date_filed:'2026-01-01'}]],
        ['OSHA_ENFORCEMENT','/osha_enforcement/',[{activity_nr:1,estab_name:'ACME CORPORATION',site_state:'CA',open_date:'2026-02-01'}]],
        ['DOL_WHD','/whisard/',[{case_id:2,legal_name:'Acme Corporation',trade_nm:'Acme',st_cd:'CA',findings_end_date:'2026-03-01'}]],
        ['FMCS_F7','/f7/',[{employer:'Acme Corporation',employer_state:'CA',notice_date:'2026-04-01'}]],
        ['NLRB_VOLUNTARY_RECOGNITION','/voluntary_recognitions/',[{'Employer':'Acme Corporation','Unit State':'CA','VR Case Number':'VR-1'}]],
        ['FMCS_WORK_STOPPAGES','/work_stoppages/',[{'Employer':'Acme Corporation','City, State':'Fixture, CA','Case Number':'WS-1'}]],
        ['OLMS_LM20','/lm20/',[{rptId:3,empLabOrg:'Acme Corporation',empTrdName:'Acme Corporation',state:'CA',termDate:'2026-05-01'}]]
      ];
      for(const [provider,path,data] of cases)if(u.pathname.includes(path))return failed.has(provider)?json({error:'down'},503):json(data);
    }
    if(u.hostname==='api.usaspending.gov'){
      assert.equal(init.method,'POST');
      return failed.has('USA_SPENDING')?json({error:'down'},503):json({results:[{recipient_name:'ACME CORPORATION',uei:'UEIACME'}]});
    }
    throw new Error('unexpected URL '+u.href);
  };
}

export const mockResearchFetch=makeResearchFetch();
