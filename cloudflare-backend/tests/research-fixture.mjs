import assert from 'node:assert/strict';

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}});}

export function makeResearchFetch({failProviders=[]}={}){
  const failed=new Set(failProviders);
  return async function mockFetch(input,init={}){
    const u=new URL(String(input));
    if(u.hostname==='api.gleif.org')return failed.has('GLEIF')?json({error:'down'},503):json({data:[{id:'OQSJ1DU9TAOC51A47K68',attributes:{lei:'OQSJ1DU9TAOC51A47K68',entity:{legalName:{name:'ACME CORPORATION'},legalAddress:{country:'US'},jurisdiction:'US-CA',status:'ACTIVE'},registration:{status:'ISSUED'}}}]});
    if(u.hostname==='www.wikidata.org')return failed.has('WIKIDATA')?json({error:'down'},503):json({search:[{id:'Q1',label:'Acme Corporation',description:'fixture manufacturer'}]});
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
