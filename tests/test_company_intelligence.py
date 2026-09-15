import json,tempfile,unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
from urllib.parse import parse_qs
import httpx

from app.company_intelligence import CompanyIntelligenceClient,SecClient,WikidataClient,LaborDataClient,USAspendingClient,OpenCorporatesClient,OpenSupplyHubClient
from app.company_source_registry import SOURCE_REGISTRY,coverage_summary
from app.gleif_source import GleifClient
from app.research import Store


def make_lei(seed):
    prefix=('TEST'+str(seed).zfill(14));number=''.join(str(ord(c)-55) if c.isalpha() else c for c in prefix)+'00'
    return prefix+str(98-int(number)%97).zfill(2)
LEI=make_lei(81);PARENT=make_lei(82);AT=datetime(2026,10,10,tzinfo=timezone.utc)


def gleif_record(lei=LEI,name='Acme Public Corp',country='US'):
    return {'id':lei,'attributes':{'lei':lei,'entity':{'legalName':{'name':name},'legalAddress':{'country':country},'jurisdiction':country,'status':'ACTIVE','category':'GENERAL'},'registration':{'status':'ISSUED','lastUpdateDate':'2026-09-01T00:00:00Z'}}}


def mock_handler(request):
    host=request.url.host;path=request.url.path
    if host=='api.gleif.org':
        if path.endswith('direct-parent'):return httpx.Response(200,json={'data':gleif_record(PARENT,'Acme Holdings Inc')},headers={'content-type':'application/json'})
        if path.endswith('ultimate-parent'):return httpx.Response(404)
        if path.endswith('/lei-records'):return httpx.Response(200,json={'data':[gleif_record()]},headers={'content-type':'application/json'})
        return httpx.Response(200,json={'data':gleif_record()},headers={'content-type':'application/json'})
    if host=='www.sec.gov' and path=='/files/company_tickers.json':
        return httpx.Response(200,json={'0':{'cik_str':123456,'ticker':'ACME','title':'Acme Public Corp'}},headers={'content-type':'application/json'})
    if host=='data.sec.gov' and path.startswith('/submissions/'):
        return httpx.Response(200,json={'cik':'0000123456','name':'Acme Public Corp','tickers':['ACME'],'exchanges':['NYSE'],'sic':'3571','sicDescription':'Electronic Computers','entityType':'operating','filings':{'recent':{'form':['10-K','10-Q'],'filingDate':['2026-02-20','2026-05-02']}}},headers={'content-type':'application/json'})
    if host=='data.sec.gov' and path.startswith('/api/xbrl/companyfacts/'):
        return httpx.Response(200,json={'facts':{'us-gaap':{'Revenues':{'units':{'USD':[{'val':1000000,'form':'10-K','filed':'2026-02-20','end':'2025-12-31'}]}},'Assets':{'units':{'USD':[{'val':2500000,'form':'10-K','filed':'2026-02-20','end':'2025-12-31'}]}}}}},headers={'content-type':'application/json'})
    if host=='www.wikidata.org':
        q=dict(request.url.params);action=q.get('action')
        if action=='wbsearchentities':return httpx.Response(200,json={'search':[{'id':'Q123','label':'Acme Public Corp','description':'fixture company'}]},headers={'content-type':'application/json'})
        ids=q.get('ids','')
        if ids=='Q123':
            claims={'P452':[{'mainsnak':{'datavalue':{'value':{'id':'Q100'}}}}], 'P1056':[{'mainsnak':{'datavalue':{'value':{'id':'Q104'}}}}], 'P1716':[{'mainsnak':{'datavalue':{'value':{'id':'Q105'}}}}], 'P159':[{'mainsnak':{'datavalue':{'value':{'id':'Q101'}}}}], 'P749':[{'mainsnak':{'datavalue':{'value':{'id':'Q102'}}}}], 'P355':[{'mainsnak':{'datavalue':{'value':{'id':'Q103'}}}}], 'P856':[{'mainsnak':{'datavalue':{'value':'https://acme.example/'}}}], 'P571':[{'mainsnak':{'datavalue':{'value':{'time':'+1999-01-01T00:00:00Z'}}}}]}
            return httpx.Response(200,json={'entities':{'Q123':{'labels':{'en':{'value':'Acme Public Corp'}},'claims':claims}}},headers={'content-type':'application/json'})
        ents={qid:{'labels':{'en':{'value':{'Q100':'Technology','Q101':'Fixture City','Q102':'Acme Holdings','Q103':'Acme Subsidiary','Q104':'Widget','Q105':'Acme Brand'}.get(qid,qid)}}} for qid in ids.split('|')}
        return httpx.Response(200,json={'entities':ents},headers={'content-type':'application/json'})
    if host=='labordata.bunkum.us' and path.endswith('/query.json'):
        sql=dict(request.url.params).get('sql','')
        if '/nlrb/' in path:
            if 'lower(name)=lower' in sql:
                rows=[{'case_number':'01-CA-123456','name':'Acme Public Corp','case_type':'CA','url':'https://www.nlrb.gov/case/01-CA-123456','city':'Fixture City','state':'CA','date_filed':'2026-01-02','region_assigned':'Region 1','status':'Closed','date_closed':'2026-04-01','reason_closed':'Settlement','certified_representative':None}]
            else:rows=[{'case_number':'01-CA-123456','name':'Acme Public Corp','case_type':'CA','url':'https://www.nlrb.gov/case/01-CA-123456','city':'Fixture City','state':'CA','date_filed':'2026-01-02','status':'Closed'}]
            return httpx.Response(200,json=rows,headers={'content-type':'application/json'})
        if '/osha_enforcement/' in path:
            if 'left join violation' in sql:
                rows=[{'activity_nr':9988,'estab_name':'Acme Public Corp','site_city':'Fixture City','site_state':'CA','naics_code':334111,'insp_type':'A','insp_scope':'B','open_date':'2026-03-01','close_case_date':'2026-04-02','citation_count':2,'current_penalty':1200.0}]
            else:rows=[{'activity_nr':9988,'estab_name':'Acme Public Corp','site_city':'Fixture City','site_state':'CA','open_date':'2026-03-01'}]
            return httpx.Response(200,json=rows,headers={'content-type':'application/json'})
        if '/whisard/' in path:
            if 'lower(legal_name)=lower' in sql:
                rows=[{'case_id':7788,'trade_nm':'Acme','legal_name':'Acme Public Corp','cty_nm':'Fixture City','st_cd':'CA','naic_cd':'334111','naics_code_description':'Electronic Computer Manufacturing','case_violtn_cnt':3,'cmp_assd':500.0,'ee_violtd_cnt':4,'bw_atp_amt':2500.0,'ee_atp_cnt':4,'findings_start_date':'2025-01-01','findings_end_date':'2025-12-01','flsa_repeat_violator':'N/A'}]
            else:rows=[{'case_id':7788,'trade_nm':'Acme','legal_name':'Acme Public Corp','cty_nm':'Fixture City','st_cd':'CA','naics_code_description':'Electronic Computer Manufacturing','findings_end_date':'2025-12-01'}]
            return httpx.Response(200,json=rows,headers={'content-type':'application/json'})
        if '/f7/' in path:
            if 'lower(employer)=lower' in sql:
                rows=[{'notice_date':'2026-08-12','initiated_date':'2026-07-01','employer':'Acme Public Corp','employer_city':'Fixture City','employer_state':'CA','union_name':'Fixture Workers United','affected_location_city':'Fixture City','affected_location_state':'CA','expiration_date':'2027-08-01','naics':'334111','industry':'Electronic Computer Manufacturing','bargaining_unit_size':20,'establishment_size':100,'category':'Initial Contract','healthcare_related':'No'}]
            else: rows=[{'employer':'Acme Public Corp','employer_state':'CA','notice_date':'2026-08-12','union_name':'Fixture Workers United','category':'Initial Contract'}]
            return httpx.Response(200,json=rows,headers={'content-type':'application/json'})
        if '/voluntary_recognitions/' in path:
            if 'lower(\"Employer\")=lower' in sql:
                rows=[{'VR Case Number':'VR-100','Employer':'Acme Public Corp','Union':'Fixture Workers United','Unit City':'Fixture City','Unit State':'CA','Date VR Request Received':'2026-06-01','Date of Voluntary Recogition':'2026-06-20','Number of Employees':18,'Unit Description':'Fixture bargaining unit'}]
            else: rows=[{'Employer':'Acme Public Corp','Unit State':'CA','VR Case Number':'VR-100','Date VR Request Received':'2026-06-01'}]
            return httpx.Response(200,json=rows,headers={'content-type':'application/json'})
        if '/work_stoppages/' in path:
            if 'lower(\"Employer\")=lower' in sql:
                rows=[{'Employer':'Acme Public Corp','Union':'Fixture Workers United','Union Local':'Local 1','Case Number':'WS-100','BU':'Fixture Unit','NAICS':'334111','Industry':'Electronic Computer Manufacturing','City, State':'Fixture City, CA','# Idled':25,'Start Date':'2026-04-01','End Date':'2026-04-03','Duration':'3'}]
            else: rows=[{'Employer':'Acme Public Corp','City, State':'Fixture City, CA','Case Number':'WS-100','Start Date':'2026-04-01'}]
            return httpx.Response(200,json=rows,headers={'content-type':'application/json'})
        if '/lm20/' in path:
            if 'lower(e.empTrdName)=lower' in sql:
                rows=[{'rptId':9001,'empLabOrg':'Acme Public Corp','empTrdName':'Acme Public Corp','city':'Fixture City','state':'CA','termDate':'2026-02-01','amount':5000,'filing_url':'https://olmsapps.dol.gov/query/orgReport.do?rptId=9001','formFiled':'LM-20','receiveDate':'2026-02-10','consultant':'Fixture Labor Relations LLC'}]
            else: rows=[{'rptId':9001,'empLabOrg':'Acme Public Corp','empTrdName':'Acme Public Corp','state':'CA','termDate':'2026-02-01','amount':5000}]
            return httpx.Response(200,json=rows,headers={'content-type':'application/json'})
    if host=='api.usaspending.gov':
        body=json.loads(request.content or b'{}')
        if path.endswith('/autocomplete/recipient/'):
            return httpx.Response(200,json={'count':1,'results':[{'recipient_name':'ACME PUBLIC CORP','recipient_level':None,'uei':'UEIACME123','duns':None}]},headers={'content-type':'application/json'})
        if path.endswith('/search/spending_by_award/'):
            return httpx.Response(200,json={'spending_level':'awards','results':[{'Award ID':'ACME-AWARD-1','Recipient Name':'ACME PUBLIC CORP','Start Date':'2026-01-01','End Date':'2027-01-01','Award Amount':123456.0,'Awarding Agency':'Fixture Department','Awarding Sub Agency':'Fixture Office','Award Type':None,'Description':'Fixture cloud services contract'}]},headers={'content-type':'application/json'})
    return httpx.Response(404)


def composite():
    tr=httpx.MockTransport(mock_handler);kw={'transport':tr,'min_interval':0}
    return CompanyIntelligenceClient(GleifClient(**kw),SecClient(**kw),WikidataClient(**kw),LaborDataClient(**kw,max_requests=11),USAspendingClient(**kw,max_requests=3),OpenCorporatesClient(**kw),OpenSupplyHubClient(**kw))


class RegistryTests(unittest.TestCase):
    def test_registry_covers_seven_sections_and_auth_boundaries(self):
        cov=coverage_summary();self.assertEqual(set(cov),{'identity','business','ownership','facilities','supply_chain','work_conditions','channels'})
        self.assertEqual(SOURCE_REGISTRY['SEC_EDGAR']['access'],'KEYLESS_PUBLIC_API')
        self.assertIn('LICENSE_REVIEW_REQUIRED',SOURCE_REGISTRY['OPENCORPORATES']['state'])
        self.assertIn('TOKEN',SOURCE_REGISTRY['OPEN_SUPPLY_HUB']['access'])
        self.assertIn('not a finding',SOURCE_REGISTRY['NLRB_CASES']['semantic_boundary'])

    def test_optional_sources_fail_closed_without_token_and_license(self):
        with self.assertRaisesRegex(Exception,'TOKEN_REQUIRED'):OpenSupplyHubClient().search('Acme')
        with self.assertRaisesRegex(Exception,'TOKEN_REQUIRED'):OpenCorporatesClient().search('Acme')
        with self.assertRaisesRegex(Exception,'LICENSE_REVIEW_REQUIRED'):OpenCorporatesClient(token='x').search('Acme')


class MultiSourcePipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.store=Store(Path(self.tmp.name)/'state.sqlite3')
        p={'name':'Acme Public Corp','region':'US','registry_id':'LEI:'+LEI,'needs':['company','products','supply_chain'],'public':True,'synthetic':False,'consent':True}
        self.receipt=self.store.register('OWNER',p,'request-multi-1',AT-timedelta(days=2))
    def tearDown(self):self.tmp.cleanup()
    def run_research_once(self):return self.store.run_research(at=AT,client_factory=composite,daily_budget=60)

    def test_unbound_secondary_sources_are_candidates_not_facts(self):
        out=self.run_research_once();self.assertEqual(out['runs'][0]['state'],'DRAFT_READY')
        run=self.store.task_list()[0]['run'];providers={x.get('provider') for x in run['candidates']}
        self.assertTrue({'SEC_EDGAR','WIKIDATA','NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20','USA_SPENDING'}<=providers)
        packet=run['packet'];self.assertTrue(packet['sections']['identity']['items'])
        self.assertFalse(any(x.get('provider')=='SEC_EDGAR' for x in packet['sections']['business']['items']))
        self.assertFalse(packet['sections']['work_conditions']['items'])

    def test_bound_sources_enrich_only_after_explicit_candidate_binding(self):
        self.run_research_once();run=self.store.task_list()[0]['run']
        for provider in ('SEC_EDGAR','WIKIDATA','NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20','USA_SPENDING'):
            c=next(x for x in run['candidates'] if x.get('provider')==provider)
            self.store.bind_external_source(run['id'],provider,c['external_id'],'operator:test','测试明确核对该来源候选主体与公司空间匹配',AT)
        out=self.run_research_once();self.assertEqual(out['runs'][0]['state'],'DRAFT_READY')
        packet=self.store.task_list()[0]['run']['packet']
        self.assertTrue(any(x.get('provider')=='SEC_EDGAR' for x in packet['sections']['business']['items']))
        self.assertTrue(any(x.get('provider')=='WIKIDATA' for x in packet['sections']['facilities']['items']))
        nlrb=next(x for x in packet['sections']['work_conditions']['items'] if x.get('provider')=='NLRB_CASES')
        self.assertIn('不等于NLRB已认定雇主违法',nlrb['basis'])
        osha=next(x for x in packet['sections']['work_conditions']['items'] if x.get('provider')=='OSHA_ENFORCEMENT')
        self.assertIn('不能外推为公司整体劳动条件',osha['basis'])
        whd=next(x for x in packet['sections']['work_conditions']['items'] if x.get('provider')=='DOL_WHD')
        self.assertIn('已结案合规行动',whd['basis']);self.assertIn('2500.0 USD',whd['text'])
        self.assertTrue(any(x.get('provider')=='FMCS_F7' for x in packet['sections']['work_conditions']['items']))
        self.assertTrue(any(x.get('provider')=='NLRB_VOLUNTARY_RECOGNITION' for x in packet['sections']['work_conditions']['items']))
        self.assertTrue(any(x.get('provider')=='FMCS_WORK_STOPPAGES' for x in packet['sections']['work_conditions']['items']))
        lm=next(x for x in packet['sections']['work_conditions']['items'] if x.get('provider')=='OLMS_LM20');self.assertIn('不能自动表述为不公平劳动行为认定',lm['basis'])
        self.assertTrue(any(x.get('provider')=='USA_SPENDING' for x in packet['sections']['supply_chain']['items']))
        self.assertIn('source_registry',packet)

    def test_binding_must_come_from_current_candidate(self):
        self.run_research_once();run=self.store.task_list()[0]['run']
        with self.assertRaisesRegex(ValueError,'本次来源实际返回'):
            self.store.bind_external_source(run['id'],'SEC_EDGAR','9999999999','operator:test','不能凭空绑定一个未返回的CIK',AT)

if __name__=='__main__':unittest.main()
