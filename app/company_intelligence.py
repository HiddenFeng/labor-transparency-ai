"""Bounded multi-source company intelligence built on the canonical research packet.

Identity remains GLEIF-rooted. Secondary providers either require an explicit
provider binding or return candidates only. A search hit never becomes a fact by
itself. Public enforcement/case records keep their original procedural meaning.
"""
from __future__ import annotations
import hashlib
import json
import os
import re
import time
from dataclasses import dataclass
from urllib.parse import urlencode, quote
import httpx

from .core import iso, utcnow
from .gleif_source import GleifClient, SourceError, collect as gleif_collect, normal_name
from .company_source_registry import SOURCE_REGISTRY, source_registry

MAX_JSON = 12_000_000
PROJECT_UA = 'LaborTransparencyPublicInterest/0.8.1 (+https://github.com/HiddenFeng/labor-transparency-ai)'


def _obs_id(prefix: str, url: str) -> str:
    return prefix + '-' + hashlib.sha256(url.encode()).hexdigest()[:14]


def _safe_external_id(value: str, pattern: str, label='来源标识') -> str:
    value = str(value or '').strip()
    if not re.fullmatch(pattern, value):
        raise ValueError(label + '无效')
    return value


def _sql_literal(value: str) -> str:
    # Used only inside fixed query templates sent to a fixed Datasette host.
    return "'" + str(value).replace("'", "''") + "'"

def _company_query_name(name):
    cleaned=re.sub(r'\b(corporation|corp\.?|incorporated|inc\.?|llc|ltd\.?|limited|company|co\.?)\b',' ',str(name),flags=re.I)
    cleaned=' '.join(cleaned.split())
    return cleaned if len(cleaned)>=2 else str(name)

def _group_name_candidates(rows,provider,name_field,region_field,sample_field,basis):
    groups={}
    for row in rows if isinstance(rows,list) else []:
        label=str(row.get(name_field) or '').strip();sample=str(row.get(sample_field) or '')
        if not label:continue
        key=normal_name(label);cur=groups.setdefault(key,{'provider':provider,'external_id':label,'label':label,'region':str(row.get(region_field) or 'US'),'sample_record':sample,'match_basis':basis,'matches':0});cur['matches']+=1
    return sorted(groups.values(),key=lambda x:-x['matches'])[:8]


class BoundedJsonClient:
    provider = 'GENERIC'
    allowed_hosts: set[str] = set()
    mode = 'LIVE_PUBLIC_SOURCE'

    def __init__(self, *, allow_network=False, transport=None, max_requests=3, timeout=15,
                 max_seconds=70, min_interval=0.35, cache=None):
        self.allow_network = allow_network
        self.transport = transport
        self.max_requests = max_requests
        self.timeout = timeout
        self.max_seconds = max_seconds
        self.min_interval = min_interval
        self.cache = cache
        self.calls = 0
        self.cache_hits = 0
        self.started = time.monotonic()
        self.last_call = 0.0
        self.observations: list[dict] = []
        self.pause_seconds = 0
        self.access_denied = False
        if transport is not None:
            self.mode = 'INJECTED_TEST_TRANSPORT'

    def _get_json(self, url: str, *, title: str, publisher: str, reuse_status: str,
                  license_url: str, cache_key: str | None = None, public_url: str | None = None, headers=None) -> tuple[object, dict]:
        if not self.allow_network and self.transport is None:
            raise SourceError('NETWORK_NOT_AUTHORIZED')
        u = httpx.URL(url)
        if u.scheme != 'https' or u.host not in self.allowed_hosts or u.username or u.password:
            raise SourceError('SOURCE_URL_NOT_ALLOWED')
        key = cache_key or url
        cached = self.cache('get', key, None) if self.cache else None
        if cached:
            raw, fetched_at = cached
            self.cache_hits += 1
            return self._decode(raw, url, fetched_at, True, title, publisher, reuse_status, license_url)
        remaining = self.max_seconds - (time.monotonic() - self.started)
        if self.calls >= self.max_requests or remaining <= 0:
            raise SourceError('JOB_BUDGET_EXHAUSTED', True)
        delay = max(0, self.min_interval - (time.monotonic() - self.last_call))
        if delay >= remaining:
            raise SourceError('JOB_BUDGET_EXHAUSTED', True)
        if delay:
            time.sleep(delay)
        self.calls += 1
        self.last_call = time.monotonic()
        request_headers = {'Accept': 'application/json', 'User-Agent': PROJECT_UA}
        request_headers.update(headers or {})
        try:
            with httpx.Client(transport=self.transport, follow_redirects=False,
                              timeout=min(self.timeout, remaining), headers=request_headers) as client:
                with client.stream('GET', url) as response:
                    status = response.status_code
                    if status in (301,302,303,307,308):
                        raise SourceError('SOURCE_REDIRECT_DENIED')
                    if status in (401,403):
                        self.access_denied = True
                        raise SourceError('SOURCE_ACCESS_DENIED')
                    if status == 429:
                        self.pause_seconds = 900
                        raise SourceError('SOURCE_RATE_LIMITED', True, 900)
                    if status >= 500:
                        raise SourceError('SOURCE_UNAVAILABLE', True)
                    if status == 404:
                        raise SourceError('RECORD_NOT_FOUND')
                    if status != 200:
                        raise SourceError('UNEXPECTED_SOURCE_STATUS')
                    if 'json' not in response.headers.get('content-type','').lower():
                        raise SourceError('SOURCE_CONTENT_TYPE')
                    body = bytearray()
                    for chunk in response.iter_bytes():
                        body.extend(chunk)
                        if len(body) > MAX_JSON:
                            raise SourceError('SOURCE_TOO_LARGE')
                    raw = bytes(body)
        except SourceError:
            raise
        except httpx.TimeoutException:
            raise SourceError('SOURCE_TIMEOUT', True) from None
        except httpx.HTTPError:
            raise SourceError('SOURCE_NETWORK_ERROR', True) from None
        fetched_at = iso(utcnow())
        decoded = self._decode(raw, public_url or url, fetched_at, False, title, publisher, reuse_status, license_url)
        if self.cache:
            self.cache('put', key, (raw, fetched_at))
        return decoded

    def _post_json(self, url: str, payload: dict, *, title: str, publisher: str, reuse_status: str,
                   license_url: str, cache_key: str | None = None) -> tuple[object, dict]:
        if not self.allow_network and self.transport is None:
            raise SourceError('NETWORK_NOT_AUTHORIZED')
        u=httpx.URL(url)
        if u.scheme!='https' or u.host not in self.allowed_hosts or u.username or u.password:
            raise SourceError('SOURCE_URL_NOT_ALLOWED')
        if not isinstance(payload,dict):raise SourceError('SOURCE_QUERY_NOT_ALLOWED')
        raw_payload=json.dumps(payload,sort_keys=True,separators=(',',':')).encode()
        key=cache_key or ('POST '+url+' '+hashlib.sha256(raw_payload).hexdigest())
        cached=self.cache('get',key,None) if self.cache else None
        if cached:
            raw,fetched_at=cached;self.cache_hits+=1
            return self._decode(raw,url,fetched_at,True,title,publisher,reuse_status,license_url)
        remaining=self.max_seconds-(time.monotonic()-self.started)
        if self.calls>=self.max_requests or remaining<=0:raise SourceError('JOB_BUDGET_EXHAUSTED',True)
        delay=max(0,self.min_interval-(time.monotonic()-self.last_call))
        if delay>=remaining:raise SourceError('JOB_BUDGET_EXHAUSTED',True)
        if delay:time.sleep(delay)
        self.calls+=1;self.last_call=time.monotonic()
        try:
            with httpx.Client(transport=self.transport,follow_redirects=False,timeout=min(self.timeout,remaining),
                              headers={'Accept':'application/json','Content-Type':'application/json','User-Agent':PROJECT_UA}) as client:
                response=client.post(url,content=raw_payload)
                status=response.status_code
                if status in (301,302,303,307,308):raise SourceError('SOURCE_REDIRECT_DENIED')
                if status in (401,403):self.access_denied=True;raise SourceError('SOURCE_ACCESS_DENIED')
                if status==429:self.pause_seconds=900;raise SourceError('SOURCE_RATE_LIMITED',True,900)
                if status>=500:raise SourceError('SOURCE_UNAVAILABLE',True)
                if status!=200:raise SourceError('UNEXPECTED_SOURCE_STATUS')
                if 'json' not in response.headers.get('content-type','').lower():raise SourceError('SOURCE_CONTENT_TYPE')
                raw=response.content
                if len(raw)>MAX_JSON:raise SourceError('SOURCE_TOO_LARGE')
        except SourceError:raise
        except httpx.TimeoutException:raise SourceError('SOURCE_TIMEOUT',True) from None
        except httpx.HTTPError:raise SourceError('SOURCE_NETWORK_ERROR',True) from None
        fetched_at=iso(utcnow());decoded=self._decode(raw,url,fetched_at,False,title,publisher,reuse_status,license_url)
        if self.cache:self.cache('put',key,(raw,fetched_at))
        return decoded

    def _decode(self, raw, url, fetched_at, cached, title, publisher, reuse_status, license_url):
        try:
            obj = json.loads(raw)
        except (ValueError, TypeError):
            raise SourceError('SOURCE_JSON_INVALID') from None
        obs = {
            'id': _obs_id(self.provider.lower(), url), 'title': title, 'url': url,
            'publisher': publisher, 'accessed_at': fetched_at, 'reuse_status': reuse_status,
            'license_url': license_url, 'content_sha256': hashlib.sha256(raw).hexdigest(),
            'cached': cached, 'provider': self.provider
        }
        self.observations.append(obs)
        return obj, obs


class SecClient(BoundedJsonClient):
    provider = 'SEC_EDGAR'
    allowed_hosts = {'www.sec.gov','data.sec.gov'}
    TICKERS = 'https://www.sec.gov/files/company_tickers.json'

    def search(self, name: str) -> list[dict]:
        obj, _ = self._get_json(self.TICKERS, title='SEC company ticker directory',
            publisher='U.S. Securities and Exchange Commission', reuse_status='US-GOV-PUBLIC-RECORD',
            license_url='https://www.sec.gov/about/developer-resources')
        target = normal_name(name)
        rows = []
        values = obj.values() if isinstance(obj, dict) else []
        for row in values:
            if not isinstance(row, dict):
                continue
            title = str(row.get('title') or '')
            if not title:
                continue
            n = normal_name(title)
            if target == n or target in n or n in target:
                cik = str(row.get('cik_str') or '').zfill(10)
                if re.fullmatch(r'\d{10}', cik):
                    rows.append({'provider': self.provider, 'external_id': cik, 'label': title,
                        'region': 'US', 'ticker': str(row.get('ticker') or ''),
                        'match_basis': 'SEC ticker directory name match; explicit CIK binding required'})
        rows.sort(key=lambda x: (normal_name(x['label']) != target, len(x['label'])))
        return rows[:5]

    def submissions(self, cik: str) -> tuple[dict, dict]:
        cik = _safe_external_id(cik, r'\d{10}', 'SEC CIK')
        url = f'https://data.sec.gov/submissions/CIK{cik}.json'
        obj, obs = self._get_json(url, title='SEC EDGAR company submissions',
            publisher='U.S. Securities and Exchange Commission', reuse_status='US-GOV-PUBLIC-RECORD',
            license_url='https://www.sec.gov/search-filings/edgar-application-programming-interfaces')
        if not isinstance(obj, dict) or str(obj.get('cik','')).zfill(10) != cik:
            raise SourceError('SOURCE_IDENTITY_MISMATCH')
        return obj, obs

    def companyfacts(self, cik: str) -> tuple[dict, dict]:
        cik = _safe_external_id(cik, r'\d{10}', 'SEC CIK')
        url = f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json'
        obj, obs = self._get_json(url, title='SEC EDGAR XBRL company facts',
            publisher='U.S. Securities and Exchange Commission', reuse_status='US-GOV-PUBLIC-RECORD',
            license_url='https://www.sec.gov/search-filings/edgar-application-programming-interfaces')
        if not isinstance(obj, dict):
            raise SourceError('SOURCE_SCHEMA_CHANGED')
        return obj, obs


class WikidataClient(BoundedJsonClient):
    provider = 'WIKIDATA'
    allowed_hosts = {'www.wikidata.org'}
    API = 'https://www.wikidata.org/w/api.php'

    def _api(self, params: dict, title: str):
        url = self.API + '?' + urlencode(params)
        return self._get_json(url, title=title, publisher='Wikidata', reuse_status='CC0-1.0',
            license_url='https://www.wikidata.org/wiki/Wikidata:Licensing')

    def search(self, name: str) -> list[dict]:
        obj, _ = self._api({'action':'wbsearchentities','search':name,'language':'en','uselang':'en',
                            'type':'item','limit':'5','format':'json','origin':'*'}, 'Wikidata entity search')
        out=[]
        for row in (obj.get('search',[]) if isinstance(obj,dict) else [])[:5]:
            qid=str(row.get('id') or '')
            if not re.fullmatch(r'Q\d+',qid): continue
            out.append({'provider':self.provider,'external_id':qid,'label':str(row.get('label') or qid),
                        'region':'GLOBAL','description':str(row.get('description') or ''),
                        'match_basis':'Wikidata name search; explicit QID binding required'})
        return out

    def entity(self, qid: str) -> tuple[dict, dict]:
        qid = _safe_external_id(qid, r'Q\d+', 'Wikidata QID')
        obj, obs = self._api({'action':'wbgetentities','ids':qid,'props':'labels|descriptions|claims',
                              'languages':'en|zh','format':'json','origin':'*'}, 'Wikidata bound entity')
        ent=(obj.get('entities') or {}).get(qid) if isinstance(obj,dict) else None
        if not isinstance(ent,dict) or ent.get('missing') is not None:
            raise SourceError('RECORD_NOT_FOUND')
        return ent, obs

    def labels(self, qids: list[str]) -> dict[str,str]:
        ids=[x for x in dict.fromkeys(qids) if re.fullmatch(r'Q\d+',str(x))][:40]
        if not ids:return {}
        obj,_=self._api({'action':'wbgetentities','ids':'|'.join(ids),'props':'labels','languages':'en|zh',
                         'format':'json','origin':'*'}, 'Wikidata referenced entity labels')
        out={}
        for qid,ent in (obj.get('entities') or {}).items():
            labels=ent.get('labels') or {}
            out[qid]=str((labels.get('en') or labels.get('zh') or {}).get('value') or qid)
        return out


class LaborDataClient(BoundedJsonClient):
    provider = 'LABORDATA'
    allowed_hosts = {'labordata.bunkum.us'}
    BASE = 'https://labordata.bunkum.us'

    def _query(self, db: str, sql: str, title: str, *, provider: str):
        if db not in ('nlrb','osha_enforcement','whisard','f7','voluntary_recognitions','work_stoppages','lm20'):
            raise SourceError('SOURCE_PATH_NOT_ALLOWED')
        url=f'{self.BASE}/{db}/-/query.json?' + urlencode({'sql':sql,'_shape':'array'})
        old=self.provider;self.provider=provider
        try:
            return self._get_json(url,title=title,publisher='LaborData structured mirror',
                reuse_status='STRUCTURED-MIRROR-OF-US-GOV-PUBLIC-DATA',
                license_url='https://github.com/labordata')
        finally:
            self.provider=old

    def nlrb_search(self, name: str) -> list[dict]:
        literal=_sql_literal(name)
        sql=("select case_number,name,case_type,url,city,state,date_filed,status from filing "
             f"where strpos(lower(name),lower({literal}))>0 order by date_filed desc limit 30")
        rows,_=self._query('nlrb',sql,'LaborData NLRB case-name candidate search',provider='NLRB_CASES')
        groups={}
        for row in rows if isinstance(rows,list) else []:
            label=str(row.get('name') or '').strip();case=str(row.get('case_number') or '')
            if not label or not case:continue
            key=normal_name(label)
            cur=groups.setdefault(key,{'provider':'NLRB_CASES','external_id':label,'label':label,
                'region':str(row.get('state') or 'US'),'sample_case':case,'sample_url':str(row.get('url') or ''),
                'match_basis':'NLRB case-name search via structured mirror; exact case-name binding required','matches':0})
            cur['matches']+=1
        return sorted(groups.values(),key=lambda x:-x['matches'])[:8]

    def nlrb_cases(self, exact_name: str) -> tuple[list[dict],dict]:
        sql=("select case_number,name,case_type,url,city,state,date_filed,region_assigned,status,date_closed,"
             "reason_closed,certified_representative from filing where lower(name)=lower("
             +_sql_literal(exact_name)+") order by date_filed desc limit 12")
        return self._query('nlrb',sql,'LaborData mirror of bound NLRB case records',provider='NLRB_CASES')

    def osha_search(self, name: str) -> list[dict]:
        literal=_sql_literal(name)
        sql=("select activity_nr,estab_name,site_city,site_state,open_date from inspection "
             f"where strpos(lower(estab_name),lower({literal}))>0 order by open_date desc limit 30")
        rows,_=self._query('osha_enforcement',sql,'LaborData OSHA establishment candidate search',provider='OSHA_ENFORCEMENT')
        groups={}
        for row in rows if isinstance(rows,list) else []:
            label=str(row.get('estab_name') or '').strip();aid=str(row.get('activity_nr') or '')
            if not label or not aid:continue
            key=normal_name(label)
            cur=groups.setdefault(key,{'provider':'OSHA_ENFORCEMENT','external_id':label,'label':label,
                'region':str(row.get('site_state') or 'US'),'sample_activity':aid,
                'match_basis':'OSHA establishment-name search via DOL-data mirror; exact establishment binding required','matches':0})
            cur['matches']+=1
        return sorted(groups.values(),key=lambda x:-x['matches'])[:8]

    def osha_inspections(self, exact_name: str) -> tuple[list[dict],dict]:
        sql=("select i.activity_nr,i.estab_name,i.site_city,i.site_state,i.naics_code,i.insp_type,i.insp_scope,"
             "i.open_date,i.close_case_date,count(v.citation_id) as citation_count,"
             "coalesce(sum(case when coalesce(v.delete_flag,'') != 'X' then coalesce(v.current_penalty,0) else 0 end),0) as current_penalty "
             "from inspection i left join violation v on v.activity_nr=i.activity_nr "
             "where lower(i.estab_name)=lower("+_sql_literal(exact_name)+") "
             "group by i.activity_nr,i.estab_name,i.site_city,i.site_state,i.naics_code,i.insp_type,i.insp_scope,i.open_date,i.close_case_date "
             "order by i.open_date desc limit 10")
        return self._query('osha_enforcement',sql,'LaborData mirror of bound OSHA inspection/citation records',provider='OSHA_ENFORCEMENT')

    def whd_search(self, name: str) -> list[dict]:
        literal=_sql_literal(name)
        sql=("select case_id,trade_nm,legal_name,cty_nm,st_cd,naics_code_description,findings_end_date "
             f"from cases where strpos(lower(legal_name),lower({literal}))>0 or strpos(lower(trade_nm),lower({literal}))>0 "
             "order by findings_end_date desc limit 30")
        rows,_=self._query('whisard',sql,'LaborData WHD employer candidate search',provider='DOL_WHD')
        groups={}
        for row in rows if isinstance(rows,list) else []:
            label=str(row.get('legal_name') or row.get('trade_nm') or '').strip();case=str(row.get('case_id') or '')
            if not label or not case:continue
            key=normal_name(label)
            cur=groups.setdefault(key,{'provider':'DOL_WHD','external_id':label,'label':label,
                'region':str(row.get('st_cd') or 'US'),'sample_case':case,'industry':str(row.get('naics_code_description') or ''),
                'match_basis':'WHD concluded-compliance-action employer-name search via structured mirror; exact employer-name binding required','matches':0})
            cur['matches']+=1
        return sorted(groups.values(),key=lambda x:-x['matches'])[:8]

    def whd_cases(self, exact_name: str) -> tuple[list[dict],dict]:
        lit=_sql_literal(exact_name)
        sql=("select case_id,trade_nm,legal_name,cty_nm,st_cd,naic_cd,naics_code_description,case_violtn_cnt,cmp_assd,"
             "ee_violtd_cnt,bw_atp_amt,ee_atp_cnt,findings_start_date,findings_end_date,flsa_repeat_violator "
             "from cases where lower(legal_name)=lower("+lit+") or lower(trade_nm)=lower("+lit+") "
             "order by findings_end_date desc limit 12")
        return self._query('whisard',sql,'LaborData mirror of bound WHD concluded compliance actions',provider='DOL_WHD')

    def f7_search(self,name):
        lit=_sql_literal(name)
        sql=f"select employer,employer_state,notice_date,union_name,category from f7 where strpos(lower(employer),lower({lit}))>0 order by notice_date desc limit 30"
        rows,_=self._query('f7',sql,'LaborData FMCS F-7 employer candidate search',provider='FMCS_F7')
        return _group_name_candidates(rows,'FMCS_F7','employer','employer_state','notice_date','FMCS F-7 employer-name search; exact employer binding required')

    def f7_notices(self,exact_name):
        lit=_sql_literal(exact_name)
        sql=("select notice_date,initiated_date,employer,employer_city,employer_state,union_name,affected_location_city,affected_location_state,"
             "expiration_date,naics,industry,bargaining_unit_size,establishment_size,category,healthcare_related "
             "from f7 where lower(employer)=lower("+lit+") order by notice_date desc limit 15")
        return self._query('f7',sql,'LaborData mirror of bound FMCS F-7 notices',provider='FMCS_F7')

    def voluntary_search(self,name):
        lit=_sql_literal(name)
        sql='select "Employer","Unit State","VR Case Number","Date VR Request Received" from voluntary_recognitions where strpos(lower("Employer"),lower('+lit+'))>0 order by "Date VR Request Received" desc limit 30'
        rows,_=self._query('voluntary_recognitions',sql,'LaborData NLRB voluntary-recognition employer candidate search',provider='NLRB_VOLUNTARY_RECOGNITION')
        return _group_name_candidates(rows,'NLRB_VOLUNTARY_RECOGNITION','Employer','Unit State','VR Case Number','NLRB voluntary-recognition employer-name search; exact employer binding required')

    def voluntary_records(self,exact_name):
        lit=_sql_literal(exact_name)
        sql='select "VR Case Number","Employer","Union","Unit City","Unit State","Date VR Request Received","Date of Voluntary Recogition","Number of Employees","Unit Description" from voluntary_recognitions where lower("Employer")=lower('+lit+') order by "Date VR Request Received" desc limit 12'
        return self._query('voluntary_recognitions',sql,'LaborData mirror of bound NLRB voluntary-recognition notices',provider='NLRB_VOLUNTARY_RECOGNITION')

    def stoppage_search(self,name):
        lit=_sql_literal(name)
        sql='select "Employer","City, State","Case Number","Start Date" from work_stoppages where strpos(lower("Employer"),lower('+lit+'))>0 order by "Start Date" desc limit 30'
        rows,_=self._query('work_stoppages',sql,'LaborData FMCS work-stoppage employer candidate search',provider='FMCS_WORK_STOPPAGES')
        return _group_name_candidates(rows,'FMCS_WORK_STOPPAGES','Employer','City, State','Case Number','FMCS work-stoppage employer-name search; exact employer binding required')

    def stoppage_records(self,exact_name):
        lit=_sql_literal(exact_name)
        sql='select "Employer","Union","Union Local","Case Number","BU","NAICS","Industry","City, State","# Idled","Start Date","End Date","Duration" from work_stoppages where lower("Employer")=lower('+lit+') order by "Start Date" desc limit 12'
        return self._query('work_stoppages',sql,'LaborData mirror of bound FMCS work stoppages',provider='FMCS_WORK_STOPPAGES')

    def lm20_search(self,name):
        lit=_sql_literal(name);short=_sql_literal(_company_query_name(name))
        sql=f"select rptId,empLabOrg,empTrdName,state,termDate,amount from employer where strpos(lower(empLabOrg),lower({lit}))>0 or strpos(lower(empTrdName),lower({lit}))>0 or strpos(lower(empLabOrg),lower({short}))>0 or strpos(lower(empTrdName),lower({short}))>0 order by termDate desc limit 30"
        rows,_=self._query('lm20',sql,'LaborData OLMS LM-20/21 employer candidate search',provider='OLMS_LM20')
        groups={}
        for row in rows if isinstance(rows,list) else []:
            label=str(row.get('empTrdName') or row.get('empLabOrg') or '').strip();rid=str(row.get('rptId') or '')
            if not label or not rid:continue
            key=normal_name(label);cur=groups.setdefault(key,{'provider':'OLMS_LM20','external_id':label,'label':label,'region':str(row.get('state') or 'US'),'sample_report':rid,'match_basis':'OLMS employer/consultant disclosure name search; exact employer/trade-name binding required','matches':0});cur['matches']+=1
        return sorted(groups.values(),key=lambda x:-x['matches'])[:8]

    def lm20_records(self,exact_name):
        lit=_sql_literal(exact_name)
        sql=("select e.rptId,e.empLabOrg,e.empTrdName,e.city,e.state,e.termDate,e.amount,fi.filing_url,fi.formFiled,fi.receiveDate,"
             "(select companyName from filer fx where ','||replace(cast(fx.srFilerId as varchar),' ','')||',' like '%,'||cast(fi.srFilerId as varchar)||',%' limit 1) as consultant "
             "from employer e join filing fi on fi.rptId=e.rptId where lower(e.empTrdName)=lower("+lit+") or lower(e.empLabOrg)=lower("+lit+") order by e.termDate desc limit 12")
        return self._query('lm20',sql,'LaborData mirror of bound OLMS employer/consultant disclosure reports',provider='OLMS_LM20')


class USAspendingClient(BoundedJsonClient):
    provider='USA_SPENDING';allowed_hosts={'api.usaspending.gov'}
    BASE='https://api.usaspending.gov'
    def search(self,name):
        payload={'search_text':_company_query_name(name)}
        obj,_=self._post_json(self.BASE+'/api/v2/autocomplete/recipient/',payload,title='USAspending recipient autocomplete',publisher='USAspending.gov',reuse_status='US-GOV-PUBLIC-RECORD',license_url='https://api.usaspending.gov/docs/')
        out=[]
        for row in (obj.get('results') or [])[:10] if isinstance(obj,dict) else []:
            label=str(row.get('recipient_name') or '').strip();
            if label:out.append({'provider':self.provider,'external_id':label,'label':label,'region':'US','uei':str(row.get('uei') or ''),'match_basis':'USAspending recipient autocomplete; explicit recipient binding required'})
        return out
    def awards(self,exact_name):
        today=utcnow().date().isoformat();payload={'filters':{'time_period':[{'start_date':'2007-10-01','end_date':today}],'award_type_codes':['A','B','C','D'],'recipient_search_text':[exact_name]},'fields':['Award ID','Recipient Name','Start Date','End Date','Award Amount','Awarding Agency','Awarding Sub Agency','Award Type','Description'],'page':1,'limit':15,'sort':'Award Amount','order':'desc'}
        obj,obs=self._post_json(self.BASE+'/api/v2/search/spending_by_award/',payload,title='USAspending federal contract awards',publisher='USAspending.gov / U.S. Department of the Treasury',reuse_status='US-GOV-PUBLIC-RECORD',license_url='https://api.usaspending.gov/docs/endpoints')
        rows=[]
        for row in (obj.get('results') or []) if isinstance(obj,dict) else []:
            if normal_name(row.get('Recipient Name',''))==normal_name(exact_name):rows.append(row)
        return rows,obs


class OpenCorporatesClient(BoundedJsonClient):
    provider='OPENCORPORATES'
    allowed_hosts={'api.opencorporates.com'}
    def __init__(self,*args,token='',license_approved=False,**kwargs):
        super().__init__(*args,**kwargs);self.token=token;self.license_approved=license_approved
    def search(self,name,jurisdiction=''):
        if not self.token: raise SourceError('OPTIONAL_SOURCE_TOKEN_REQUIRED')
        if not self.license_approved: raise SourceError('OPTIONAL_SOURCE_LICENSE_REVIEW_REQUIRED')
        params={'q':name,'order':'score','per_page':'5','api_token':self.token}
        if jurisdiction:params['jurisdiction_code']=jurisdiction
        public_params={k:v for k,v in params.items() if k!='api_token'}
        url='https://api.opencorporates.com/v0.4/companies/search?'+urlencode(params)
        cache_key='https://api.opencorporates.com/v0.4/companies/search?'+urlencode(public_params)
        return self._get_json(url,title='OpenCorporates company search',publisher='OpenCorporates',
            reuse_status='ODBL-OR-COMMERCIAL-TERMS-REVIEWED',
            license_url='https://api.opencorporates.com/documentation/API-Reference',cache_key=cache_key,public_url=cache_key)


class OpenSupplyHubClient(BoundedJsonClient):
    provider='OPEN_SUPPLY_HUB'
    allowed_hosts={'opensupplyhub.org'}
    def __init__(self,*args,token='',**kwargs):super().__init__(*args,**kwargs);self.token=token
    def search(self,name,country=''):
        if not self.token: raise SourceError('OPTIONAL_SOURCE_TOKEN_REQUIRED')
        params={'q':name,'detail':'true'}
        if country:params['countries']=country
        url='https://opensupplyhub.org/api/facilities/?'+urlencode(params)
        return self._get_json(url,title='Open Supply Hub facility search',publisher='Open Supply Hub',
            reuse_status='SERVICE-TERMS-AND-CONTRIBUTOR-PROVENANCE',
            license_url='https://info.opensupplyhub.org/resources/api-documentation',
            headers={'Authorization':'Token '+self.token})


@dataclass
class CompanyIntelligenceClient:
    gleif: GleifClient
    sec: SecClient
    wikidata: WikidataClient
    labor: LaborDataClient
    usaspending: USAspendingClient
    opencorporates: OpenCorporatesClient
    opensupplyhub: OpenSupplyHubClient
    mode: str = 'LIVE_MULTI_SOURCE'

    @classmethod
    def live(cls, *, cache=None):
        kw={'allow_network':True,'cache':cache}
        return cls(GleifClient(allow_network=True,cache=cache),SecClient(**kw),WikidataClient(**kw),
                   LaborDataClient(allow_network=True,cache=cache,max_requests=11),USAspendingClient(**kw),
                   OpenCorporatesClient(**kw,token=os.getenv('LTP_OPENCORPORATES_TOKEN',''),
                       license_approved=os.getenv('LTP_OPENCORPORATES_LICENSE_APPROVED')=='true'),
                   OpenSupplyHubClient(**kw,token=os.getenv('LTP_OPEN_SUPPLY_HUB_TOKEN','')))

    @property
    def calls(self):return sum(x.calls for x in (self.gleif,self.sec,self.wikidata,self.labor,self.usaspending,self.opencorporates,self.opensupplyhub))
    @property
    def cache_hits(self):return sum(x.cache_hits for x in (self.gleif,self.sec,self.wikidata,self.labor,self.usaspending,self.opencorporates,self.opensupplyhub))
    @property
    def observations(self):
        out=[]
        for x in (self.gleif,self.sec,self.wikidata,self.labor,self.usaspending,self.opencorporates,self.opensupplyhub):out.extend(x.observations)
        return out
    @property
    def pause_seconds(self):return self.gleif.pause_seconds
    @property
    def access_denied(self):return self.gleif.access_denied
    @property
    def max_requests_total(self):
        return sum(x.max_requests for x in (self.gleif,self.sec,self.wikidata,self.labor,self.usaspending))


def _add_source(packet: dict, obs: dict, *, publisher=None, url=None, reuse_status=None, title=None) -> str:
    src={'id':obs['id'],'title':title or obs['title'],'url':url or obs['url'],
         'publisher':publisher or obs['publisher'],'accessed_at':obs['accessed_at'],
         'reuse_status':reuse_status or obs['reuse_status'],'license_url':obs.get('license_url','')}
    if not any(x['id']==src['id'] for x in packet['sources']):packet['sources'].append(src)
    return src['id']


def _candidate_error(packet,section,provider,code):
    old=packet['sections'][section].get('gap','')
    msg=f'{provider}：本轮未取得可用记录（{code}），不代表不存在。'
    packet['sections'][section]['gap']=' '.join(x for x in (old,msg) if x)


def _wikidata_entity_projection(ent: dict, client: WikidataClient):
    claims=ent.get('claims') or {}
    def qids(prop):
        out=[]
        for c in claims.get(prop,[]):
            try:
                v=c['mainsnak']['datavalue']['value']['id']
                if re.fullmatch(r'Q\d+',v):out.append(v)
            except (KeyError,TypeError):pass
        return out[:12]
    refs={p:qids(p) for p in ('P452','P1056','P1716','P159','P749','P355')}
    labels=client.labels([x for rows in refs.values() for x in rows])
    urls=[]
    for c in claims.get('P856',[]):
        try:
            v=c['mainsnak']['datavalue']['value']
            if isinstance(v,str) and v.startswith('https://'):urls.append(v)
        except (KeyError,TypeError):pass
    inception=''
    for c in claims.get('P571',[]):
        try: inception=str(c['mainsnak']['datavalue']['value']['time']).lstrip('+')[:10]
        except (KeyError,TypeError):pass
        if inception:break
    label=((ent.get('labels') or {}).get('en') or (ent.get('labels') or {}).get('zh') or {}).get('value','')
    return {'label':label,'industries':[labels.get(x,x) for x in refs['P452']],
            'products':[labels.get(x,x) for x in refs['P1056']],
            'brands':[labels.get(x,x) for x in refs['P1716']],
            'headquarters':[labels.get(x,x) for x in refs['P159']],
            'parents':[labels.get(x,x) for x in refs['P749']],
            'subsidiaries':[labels.get(x,x) for x in refs['P355']],
            'websites':urls[:3],'inception':inception}


def _add_sec(packet, client: SecClient, cik: str):
    obj,obs=client.submissions(cik);sid=_add_source(packet,obs)
    name=str(obj.get('name') or '');tickers=[str(x) for x in obj.get('tickers',[])[:6]];exchanges=[str(x) for x in obj.get('exchanges',[])[:6]]
    parts=[f'SEC登记名称：{name}' if name else '',f'CIK：{cik}',f'证券代码：{", ".join(tickers)}' if tickers else '',f'交易场所：{", ".join(exchanges)}' if exchanges else '',
           f'SIC：{obj.get("sic")} {obj.get("sicDescription") or ""}'.strip() if obj.get('sic') else '',f'实体类型：{obj.get("entityType")}' if obj.get('entityType') else '']
    recent=obj.get('filings',{}).get('recent',{}) if isinstance(obj.get('filings'),dict) else {}
    forms=recent.get('form',[]) if isinstance(recent,dict) else []
    dates=recent.get('filingDate',[]) if isinstance(recent,dict) else []
    recent_text=', '.join(f'{forms[i]}({dates[i] if i<len(dates) else ""})' for i in range(min(8,len(forms))))
    if recent_text:parts.append('近期申报：'+recent_text)
    packet['sections']['business']['items'].append({'text':'；'.join(x for x in parts if x),'source_ids':[sid],
        'as_of':obs['accessed_at'],'basis':'SEC EDGAR申报主体元数据；仅适用于该CIK对应的公开申报主体，不代表产品质量或劳动实践。','provider':'SEC_EDGAR','external_id':cik})
    packet['sections']['business']['status']='PARTIAL'
    try:
        facts,fobs=client.companyfacts(cik);fsid=_add_source(packet,fobs)
        usgaap=((facts.get('facts') or {}).get('us-gaap') or {}) if isinstance(facts,dict) else {}
        aliases={'Revenues':'营业收入/Revenue','RevenueFromContractWithCustomerExcludingAssessedTax':'营业收入/Revenue','Assets':'资产总额/Assets','NetIncomeLoss':'净利润或净亏损/NetIncomeLoss'}
        used=set()
        for tag,label in aliases.items():
            if label in used or tag not in usgaap:continue
            units=(usgaap[tag].get('units') or {})
            vals=units.get('USD') or []
            rows=[r for r in vals if r.get('form') in ('10-K','10-Q','20-F','40-F') and r.get('val') is not None]
            if not rows:continue
            r=sorted(rows,key=lambda x:(x.get('filed',''),x.get('end','')))[-1];used.add(label)
            packet['sections']['business']['items'].append({'text':f'{label}：{r.get("val")} USD；报告期末：{r.get("end") or "未知"}；表单：{r.get("form") or ""}。',
                'source_ids':[fsid],'as_of':fobs['accessed_at'],'basis':'SEC XBRL Company Facts最新可用申报事实；不同会计口径/期间不可直接横向比较。','provider':'SEC_EDGAR','external_id':cik,'xbrl_tag':tag})
    except SourceError as exc:
        _candidate_error(packet,'business','SEC XBRL',exc.code)


def _add_wikidata(packet, client: WikidataClient, qid: str):
    ent,obs=client.entity(qid);data=_wikidata_entity_projection(ent,client);sid=_add_source(packet,obs)
    basis='Wikidata社区维护知识图谱，仅作上下文参考；若与官方登记/申报冲突，以更高权威来源为准。'
    if data['industries'] or data['products'] or data['brands'] or data['inception']:
        bits=[]
        if data['industries']:bits.append('行业：'+', '.join(data['industries'][:8]))
        if data['products']:bits.append('产品/产出类别：'+', '.join(data['products'][:10]))
        if data['brands']:bits.append('品牌：'+', '.join(data['brands'][:10]))
        if data['inception']:bits.append('成立/起始日期：'+data['inception'])
        packet['sections']['business']['items'].append({'text':'；'.join(bits),'source_ids':[sid],'as_of':obs['accessed_at'],'basis':basis,'provider':'WIKIDATA','external_id':qid})
        packet['sections']['business']['status']='PARTIAL'
    if data['headquarters']:
        packet['sections']['facilities']['items'].append({'text':'Wikidata总部地点：'+', '.join(data['headquarters'][:5])+'。','source_ids':[sid],'as_of':obs['accessed_at'],'basis':basis+' 这里只表示总部地点，不等于全部工厂/用工地点。','provider':'WIKIDATA','external_id':qid,'relationship_type':'HEADQUARTERS_REFERENCE'})
        packet['sections']['facilities']['status']='PARTIAL'
    rel=[]
    if data['parents']:rel.append('上级/母组织：'+', '.join(data['parents'][:6]))
    if data['subsidiaries']:rel.append('子组织：'+', '.join(data['subsidiaries'][:8]))
    if rel:
        packet['sections']['ownership']['items'].append({'text':'；'.join(rel),'source_ids':[sid],'as_of':obs['accessed_at'],'basis':basis+' 关系字段不等于已核验的会计合并、股权比例或供应链责任。','provider':'WIKIDATA','external_id':qid,'relationship_type':'WIKIDATA_ORGANIZATION_RELATION'})
        packet['sections']['ownership']['status']='PARTIAL'
    if data['websites']:
        packet['sections']['channels']['items'].append({'text':'公开官网参考入口：'+', '.join(data['websites'])+'。','source_ids':[sid],'as_of':obs['accessed_at'],'basis':basis+' 这是官网入口，不表示专用劳动申诉渠道。','provider':'WIKIDATA','external_id':qid})
        packet['sections']['channels']['status']='PARTIAL'


def _add_nlrb(packet, client: LaborDataClient, bound_name: str):
    rows,obs=client.nlrb_cases(bound_name);sid=_add_source(packet,obs)
    for row in rows if isinstance(rows,list) else []:
        case=str(row.get('case_number') or '');url=str(row.get('url') or '')
        parts=[f'NLRB案件 {case}',f'类型 {row.get("case_type")}' if row.get('case_type') else '',f'立案 {row.get("date_filed")}' if row.get('date_filed') else '',
               f'状态 {row.get("status")}' if row.get('status') else '',f'结案 {row.get("date_closed")}' if row.get('date_closed') else '',f'结案原因 {row.get("reason_closed")}' if row.get('reason_closed') else '',
               f'地点 {row.get("city") or ""}, {row.get("state") or ""}'.strip(', ') if (row.get('city') or row.get('state')) else '',f'认证代表 {row.get("certified_representative")}' if row.get('certified_representative') else '']
        packet['sections']['work_conditions']['items'].append({'text':'；'.join(x for x in parts if x)+'。','source_ids':[sid],'as_of':obs['accessed_at'],
            'basis':'NLRB公开案件记录（由LaborData结构化镜像查询）。案件、charge或petition的存在不等于NLRB已认定雇主违法；必须按案件状态、决定和文书另行判断。',
            'provider':'NLRB_CASES','external_id':bound_name,'case_number':case,'official_url':url})
    if rows:packet['sections']['work_conditions']['status']='PARTIAL'
    else:_candidate_error(packet,'work_conditions','NLRB','NO_MATCHED_CASES')


def _add_osha(packet, client: LaborDataClient, bound_name: str):
    rows,obs=client.osha_inspections(bound_name);sid=_add_source(packet,obs)
    seen_locations=set()
    for row in rows if isinstance(rows,list) else []:
        aid=str(row.get('activity_nr') or '')
        loc=', '.join(x for x in (str(row.get('site_city') or '').strip(),str(row.get('site_state') or '').strip()) if x)
        if loc and loc not in seen_locations:
            seen_locations.add(loc)
            packet['sections']['facilities']['items'].append({'text':f'OSHA检查记录涉及地点：{loc}（establishment name: {bound_name}）。','source_ids':[sid],'as_of':obs['accessed_at'],
                'basis':'OSHA/DOL执法数据的检查地点，仅证明该检查记录涉及的establishment，不等于公司全部工厂/办公地点。','provider':'OSHA_ENFORCEMENT','external_id':bound_name,'activity_nr':aid,'relationship_type':'ENFORCEMENT_EVENT_LOCATION'})
        text=(f'OSHA检查记录 activity {aid}；检查开始 {row.get("open_date") or "未知"}；类型 {row.get("insp_type") or "未知"}；范围 {row.get("insp_scope") or "未知"}；'
              f'当前数据中citation数量 {row.get("citation_count") or 0}；当前罚款汇总 {row.get("current_penalty") or 0} USD。')
        packet['sections']['work_conditions']['items'].append({'text':text,'source_ids':[sid],'as_of':obs['accessed_at'],
            'basis':'OSHA/DOL执法数据结构化镜像。检查/引用/罚款只适用于该具体记录；删除、争议、和解、最终命令状态可能改变含义，不能外推为公司整体劳动条件。','provider':'OSHA_ENFORCEMENT','external_id':bound_name,'activity_nr':aid,'relationship_type':'ENFORCEMENT_EVENT_LOCATION'})
    if rows:
        packet['sections']['facilities']['status']='PARTIAL';packet['sections']['work_conditions']['status']='PARTIAL'
    else:_candidate_error(packet,'work_conditions','OSHA','NO_MATCHED_INSPECTIONS')


def _add_whd(packet, client: LaborDataClient, bound_name: str):
    rows,obs=client.whd_cases(bound_name);sid=_add_source(packet,obs)
    locations=set();industries=set()
    for row in rows if isinstance(rows,list) else []:
        case=str(row.get('case_id') or '')
        loc=', '.join(x for x in (str(row.get('cty_nm') or '').strip(),str(row.get('st_cd') or '').strip()) if x)
        industry=str(row.get('naics_code_description') or '').strip()
        if industry:industries.add(industry)
        if loc:locations.add(loc)
        text=(f'WHD已结案合规行动 {case}；调查/发现期间 {row.get("findings_start_date") or "未知"} 至 {row.get("findings_end_date") or "未知"}；'
              f'记录的violations数量 {row.get("case_violtn_cnt") or 0}；受影响员工 {row.get("ee_violtd_cnt") or 0}；'
              f'同意支付欠薪 {row.get("bw_atp_amt") or 0} USD（员工 {row.get("ee_atp_cnt") or 0}）；民事罚款 {row.get("cmp_assd") or 0} USD。')
        packet['sections']['work_conditions']['items'].append({'text':text,'source_ids':[sid],'as_of':obs['accessed_at'],
          'basis':'美国WHD已结案合规行动数据（由LaborData结构化镜像查询）。该记录可说明该具体案件/期间的执法结果，但不能外推为企业所有地点、所有时期或所有劳动实践。',
          'provider':'DOL_WHD','external_id':bound_name,'case_id':case})
    if industries:
        packet['sections']['business']['items'].append({'text':'WHD案件记录中的NAICS行业描述：'+', '.join(sorted(industries)[:8])+'。','source_ids':[sid],'as_of':obs['accessed_at'],
          'basis':'WHD执法案件中的行业分类，仅作涉案单位业务上下文；不等于完整业务或产品目录。','provider':'DOL_WHD','external_id':bound_name})
        packet['sections']['business']['status']='PARTIAL'
    for loc in sorted(locations)[:10]:
        packet['sections']['facilities']['items'].append({'text':'WHD已结案行动涉及地点：'+loc+'。','source_ids':[sid],'as_of':obs['accessed_at'],
          'basis':'WHD涉案单位地点，仅证明该执法记录涉及的位置，不等于企业全部用工地点。','provider':'DOL_WHD','external_id':bound_name,'relationship_type':'ENFORCEMENT_CASE_LOCATION'})
    if rows:
        packet['sections']['work_conditions']['status']='PARTIAL'
        if locations:packet['sections']['facilities']['status']='PARTIAL'
    else:_candidate_error(packet,'work_conditions','DOL WHD','NO_MATCHED_COMPLIANCE_ACTIONS')



def _add_usaspending(packet, client: USAspendingClient, bound_name: str):
    rows,obs=client.awards(bound_name);sid=_add_source(packet,obs)
    for row in rows:
        aid=str(row.get('Award ID') or '')
        agency=str(row.get('Awarding Agency') or '')
        sub=str(row.get('Awarding Sub Agency') or '')
        amount=row.get('Award Amount')
        desc=str(row.get('Description') or '').strip()
        packet['sections']['supply_chain']['items'].append({
          'text':f'美国联邦合同/award {aid}；授标机构：{agency}{(" / "+sub) if sub else ""}；金额：{amount if amount is not None else "未知"} USD；期间：{row.get("Start Date") or "未知"} 至 {row.get("End Date") or "未知"}。',
          'source_ids':[sid],'as_of':obs['accessed_at'],
          'basis':'USAspending.gov公开联邦award记录，只支持该具体政府采购/award关系；不是企业完整客户、供应商或商业合作网络。',
          'provider':'USA_SPENDING','external_id':bound_name,'award_id':aid,'description':desc[:500],'relationship_type':'FEDERAL_AWARD_CUSTOMER_RELATION'})
        if desc:
            packet['sections']['business']['items'].append({'text':'联邦award公开描述：'+desc[:700],'source_ids':[sid],'as_of':obs['accessed_at'],
              'basis':'USAspending award描述只说明该具体联邦交易的公开用途，不等于企业完整业务/产品目录。','provider':'USA_SPENDING','external_id':bound_name,'award_id':aid})
    if rows:
        packet['sections']['supply_chain']['status']='PARTIAL';packet['sections']['business']['status']='PARTIAL'
    else:_candidate_error(packet,'supply_chain','USAspending','NO_MATCHED_CONTRACT_AWARDS')


def _add_f7(packet, client: LaborDataClient, bound_name: str):
    rows,obs=client.f7_notices(bound_name);sid=_add_source(packet,obs)
    industries=set();locations=set()
    for row in rows if isinstance(rows,list) else []:
        loc=', '.join(x for x in (str(row.get('affected_location_city') or row.get('employer_city') or '').strip(),str(row.get('affected_location_state') or row.get('employer_state') or '').strip()) if x)
        if loc:locations.add(loc)
        industry=str(row.get('industry') or '').strip()
        if industry:industries.add(industry)
        packet['sections']['work_conditions']['items'].append({'text':f'FMCS F-7 collective-bargaining notice：日期 {row.get("notice_date") or "未知"}；类别 {row.get("category") or "未知"}；工会 {row.get("union_name") or "未知"}；bargaining unit {row.get("bargaining_unit_size") or "未知"} 人；合同/到期日 {row.get("expiration_date") or "未知"}。','source_ids':[sid],'as_of':obs['accessed_at'],
          'basis':'FMCS F-7通知用于记录集体谈判通知/关系及受影响单位；它不是劳动法违法认定。','provider':'FMCS_F7','external_id':bound_name})
    for loc in sorted(locations)[:12]:packet['sections']['facilities']['items'].append({'text':'FMCS F-7通知涉及用工/谈判地点：'+loc+'。','source_ids':[sid],'as_of':obs['accessed_at'],'basis':'F-7通知涉及地点，不等于企业全部用工地点。','provider':'FMCS_F7','external_id':bound_name,'relationship_type':'BARGAINING_NOTICE_LOCATION'})
    if industries:packet['sections']['business']['items'].append({'text':'F-7通知中的行业描述：'+', '.join(sorted(industries)[:8])+'。','source_ids':[sid],'as_of':obs['accessed_at'],'basis':'F-7通知中的行业字段仅作涉案/谈判单位上下文。','provider':'FMCS_F7','external_id':bound_name})
    if rows:
        packet['sections']['work_conditions']['status']='PARTIAL'
        if locations:packet['sections']['facilities']['status']='PARTIAL'
        if industries:packet['sections']['business']['status']='PARTIAL'
    else:_candidate_error(packet,'work_conditions','FMCS F-7','NO_MATCHED_NOTICES')


def _add_voluntary(packet, client: LaborDataClient, bound_name: str):
    rows,obs=client.voluntary_records(bound_name);sid=_add_source(packet,obs)
    locations=set()
    for row in rows if isinstance(rows,list) else []:
        loc=', '.join(x for x in (str(row.get('Unit City') or '').strip(),str(row.get('Unit State') or '').strip()) if x)
        if loc:locations.add(loc)
        packet['sections']['work_conditions']['items'].append({'text':f'NLRB voluntary-recognition记录 {row.get("VR Case Number") or ""}；工会 {row.get("Union") or "未知"}；请求日期 {row.get("Date VR Request Received") or "未知"}；认可日期 {row.get("Date of Voluntary Recogition") or "未知"}；单位人数 {row.get("Number of Employees") or "未知"}；unit：{str(row.get("Unit Description") or "")[:500]}','source_ids':[sid],'as_of':obs['accessed_at'],'basis':'NLRB voluntary-recognition公开记录表示代表权/认可事件，不表示违法或劳动条件优劣。','provider':'NLRB_VOLUNTARY_RECOGNITION','external_id':bound_name})
    for loc in sorted(locations)[:10]:packet['sections']['facilities']['items'].append({'text':'NLRB voluntary-recognition记录涉及单位地点：'+loc+'。','source_ids':[sid],'as_of':obs['accessed_at'],'basis':'该地点仅属于具体representation record。','provider':'NLRB_VOLUNTARY_RECOGNITION','external_id':bound_name,'relationship_type':'REPRESENTATION_UNIT_LOCATION'})
    if rows:
        packet['sections']['work_conditions']['status']='PARTIAL'
        if locations:packet['sections']['facilities']['status']='PARTIAL'
    else:_candidate_error(packet,'work_conditions','NLRB voluntary recognition','NO_MATCHED_RECORDS')


def _add_stoppages(packet, client: LaborDataClient, bound_name: str):
    rows,obs=client.stoppage_records(bound_name);sid=_add_source(packet,obs)
    industries=set();locations=set()
    for row in rows if isinstance(rows,list) else []:
        loc=str(row.get('City, State') or '').strip();industry=str(row.get('Industry') or '').strip()
        if loc:locations.add(loc)
        if industry:industries.add(industry)
        packet['sections']['work_conditions']['items'].append({'text':f'FMCS work stoppage {row.get("Case Number") or ""}；工会 {row.get("Union") or "未知"} {row.get("Union Local") or ""}；开始 {row.get("Start Date") or "未知"}；结束 {row.get("End Date") or "未知"}；持续 {row.get("Duration") or "未知"}；受影响/idle {row.get("# Idled") or "未知"}。','source_ids':[sid],'as_of':obs['accessed_at'],'basis':'FMCS work-stoppage记录证明特定停工事件；事件原因、责任、合法性和结果需另行证据。','provider':'FMCS_WORK_STOPPAGES','external_id':bound_name})
    for loc in sorted(locations)[:10]:packet['sections']['facilities']['items'].append({'text':'FMCS work-stoppage记录涉及地点：'+loc+'。','source_ids':[sid],'as_of':obs['accessed_at'],'basis':'停工事件地点不等于企业全部设施。','provider':'FMCS_WORK_STOPPAGES','external_id':bound_name,'relationship_type':'WORK_STOPPAGE_LOCATION'})
    if industries:packet['sections']['business']['items'].append({'text':'work-stoppage记录行业：'+', '.join(sorted(industries)[:8])+'。','source_ids':[sid],'as_of':obs['accessed_at'],'basis':'FMCS事件记录行业字段只作该事件上下文。','provider':'FMCS_WORK_STOPPAGES','external_id':bound_name})
    if rows:
        packet['sections']['work_conditions']['status']='PARTIAL'
        if locations:packet['sections']['facilities']['status']='PARTIAL'
        if industries:packet['sections']['business']['status']='PARTIAL'
    else:_candidate_error(packet,'work_conditions','FMCS work stoppages','NO_MATCHED_RECORDS')


def _add_lm20(packet, client: LaborDataClient, bound_name: str):
    rows,obs=client.lm20_records(bound_name);sid=_add_source(packet,obs)
    for row in rows if isinstance(rows,list) else []:
        report=str(row.get('rptId') or '')
        packet['sections']['work_conditions']['items'].append({'text':f'OLMS报告 {report}（{row.get("formFiled") or "LM disclosure"}）；雇主/交易名 {row.get("empTrdName") or row.get("empLabOrg") or bound_name}；顾问/申报方 {row.get("consultant") or "未解析"}；活动/协议终止日 {row.get("termDate") or "未知"}；金额 {row.get("amount") if row.get("amount") is not None else "未知"} USD；收件日 {row.get("receiveDate") or "未知"}。','source_ids':[sid],'as_of':obs['accessed_at'],'basis':'DOL OLMS LMRDA employer/consultant公开披露记录；报告说明法定披露/安排，具体含义取决于表单和报告内容，不能自动表述为不公平劳动行为认定。','provider':'OLMS_LM20','external_id':bound_name,'report_id':report,'official_url':str(row.get('filing_url') or '')})
    if rows:packet['sections']['work_conditions']['status']='PARTIAL'
    else:_candidate_error(packet,'work_conditions','OLMS LM reports','NO_MATCHED_REPORTS')


def collect_company_intelligence(company: dict, client: CompanyIntelligenceClient,
                                 gleif_binding: dict | None = None, external_bindings: dict | None = None) -> dict:
    """Collect one bounded draft. GLEIF identity is the gate for all asserted secondary facts."""
    external_bindings=external_bindings or {}
    base=gleif_collect(company,client.gleif,gleif_binding)
    if base['state']!='DRAFT_READY':
        return base
    packet=base['packet'];candidates=[]
    country=(gleif_binding or {}).get('country') or (company.get('region') if re.fullmatch(r'[A-Z]{2}',str(company.get('region') or '')) else '')

    providers=[
        ('SEC_EDGAR', client.sec, country=='US'),
        ('WIKIDATA', client.wikidata, True),
        ('NLRB_CASES', client.labor, country=='US'),
        ('OSHA_ENFORCEMENT', client.labor, country=='US'),
        ('DOL_WHD', client.labor, country=='US'),
        ('FMCS_F7', client.labor, country=='US'),
        ('NLRB_VOLUNTARY_RECOGNITION', client.labor, country=='US'),
        ('FMCS_WORK_STOPPAGES', client.labor, country=='US'),
        ('OLMS_LM20', client.labor, country=='US'),
        ('USA_SPENDING', client.usaspending, country=='US'),
    ]
    for provider,obj,eligible in providers:
        if not eligible:continue
        binding=external_bindings.get(provider)
        try:
            if provider=='SEC_EDGAR':
                if binding:_add_sec(packet,obj,binding['external_id'])
                else:candidates.extend(obj.search(company['name']))
            elif provider=='WIKIDATA':
                if binding:_add_wikidata(packet,obj,binding['external_id'])
                else:candidates.extend(obj.search(company['name']))
            elif provider=='NLRB_CASES':
                if binding:_add_nlrb(packet,obj,binding['external_id'])
                else:candidates.extend(obj.nlrb_search(company['name']))
            elif provider=='OSHA_ENFORCEMENT':
                if binding:_add_osha(packet,obj,binding['external_id'])
                else:candidates.extend(obj.osha_search(company['name']))
            elif provider=='DOL_WHD':
                if binding:_add_whd(packet,obj,binding['external_id'])
                else:candidates.extend(obj.whd_search(company['name']))
            elif provider=='FMCS_F7':
                if binding:_add_f7(packet,obj,binding['external_id'])
                else:candidates.extend(obj.f7_search(company['name']))
            elif provider=='NLRB_VOLUNTARY_RECOGNITION':
                if binding:_add_voluntary(packet,obj,binding['external_id'])
                else:candidates.extend(obj.voluntary_search(company['name']))
            elif provider=='FMCS_WORK_STOPPAGES':
                if binding:_add_stoppages(packet,obj,binding['external_id'])
                else:candidates.extend(obj.stoppage_search(company['name']))
            elif provider=='OLMS_LM20':
                if binding:_add_lm20(packet,obj,binding['external_id'])
                else:candidates.extend(obj.lm20_search(company['name']))
            elif provider=='USA_SPENDING':
                if binding:_add_usaspending(packet,obj,binding['external_id'])
                else:candidates.extend(obj.search(company['name']))
        except SourceError as exc:
            section='business' if provider=='SEC_EDGAR' else 'work_conditions' if provider in ('NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20') else 'business'
            _candidate_error(packet,section,provider,exc.code)
    # Never turn unresolved supply-chain candidates into facts. Optional token sources are advertised in registry only.
    packet['sections']['supply_chain']['gap']='Open Supply Hub已配置为可选token候选来源；未有明确OS ID绑定与贡献者/关系复核前不写入供应链事实。'
    if not packet['sections']['channels']['items']:
        packet['sections']['channels']['gap']='当前可自动得到的企业官网只作参考入口；尚未有全球统一的正式劳动申诉渠道来源。'
    legacy_gap='GLEIF适配器不提供这一类资料。可由社区补充，或接入另外经许可的来源；本轮保持未知。'
    partial_notes={
      'business':'当前只汇总已绑定来源可支持的公开业务/申报上下文，不等于完整产品目录、市场表现或公司全部经营事实。',
      'facilities':'当前只列已绑定公开来源返回的总部/检查涉及地点，不等于企业全部工厂、门店、办公室或实际用工地点。',
      'work_conditions':'当前只列已绑定来源中的案件/检查/执法记录与已审社区证据；记录本身须保留程序状态，不能外推为公司整体劳动条件。',
      'channels':'当前自动来源主要提供官网/公开入口；官网不等于正式劳动申诉渠道，具体受理渠道仍需按地区和机构核对。'
    }
    for key,note in partial_notes.items():
        section=packet['sections'][key]
        if section['items']:
            gap=section.get('gap','').replace(legacy_gap,'').strip()
            section['gap']=' '.join(x for x in (note,gap) if x)

    packet['source_policy']={'adapter':'multi-source-0.8.1','identity_root':'GLEIF',
        'providers':[k for k,_,eligible in providers if eligible], 'optional_providers':['OPENCORPORATES','OPEN_SUPPLY_HUB'],
        'automatic_export':False,'candidate_rule':'secondary name search requires explicit provider binding before facts'}
    packet['source_registry']=source_registry()
    return {'state':'DRAFT_READY','packet':packet,'candidates':candidates[:30],
            'reason':'已获取多源公开资料草稿；未绑定的二级来源只保留为候选，等待逐项主体/范围/许可复核。'}
