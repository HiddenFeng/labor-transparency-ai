"""Bounded GLEIF adapter. It reads public reference data, never user-provided URLs.

Runtime calls need explicit allow_network. Tests inject a transport and are not
live evidence. CC0 provenance is retained; project restrictions do not replace it.
"""
from __future__ import annotations
import hashlib
import json
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlencode
import httpx
from .core import empty_packet, iso, utcnow

BASE = 'https://api.gleif.org/api/v1'
LICENSE_URL = 'https://www.gleif.org/en/about/open-data'
MAX_BYTES = 2_000_000

class SourceError(Exception):
    def __init__(self, code: str, retryable: bool = False, retry_after: int = 0):
        self.code, self.retryable, self.retry_after = code, retryable, retry_after
        super().__init__(code)


def lei_value(value: str) -> str:
    value = str(value).strip().upper()
    if value.startswith('LEI:'): value = value[4:].strip()
    if not re.fullmatch(r'[A-Z0-9]{18}[0-9]{2}', value):
        raise ValueError('请填写20位LEI，不是个人证件或任意网址')
    number = ''.join(str(ord(c)-55) if c.isalpha() else c for c in value)
    if int(number) % 97 != 1: raise ValueError('LEI校验码不正确')
    return value


def normal_name(value):
    return ' '.join(unicodedata.normalize('NFKC', str(value)).casefold().split())


def record_projection(document: dict) -> dict:
    """Whitelist only legal-entity fields; do not project addresses or contacts."""
    try:
        a = document['attributes']; ent = a['entity']; reg = a.get('registration', {})
        lei = lei_value(a.get('lei') or document['id'])
        name = ent['legalName']['name']
        if not isinstance(name, str) or not 1 <= len(name) <= 500: raise ValueError()
        # A reference registry may include natural persons; these are out of scope.
        if ent.get('category') == 'SOLE_PROPRIETOR': raise SourceError('NATURAL_PERSON_EXCLUDED')
        country = str(ent.get('legalAddress', {}).get('country') or '')
        return {'lei': lei, 'name': name, 'country': country,
                'jurisdiction': str(ent.get('jurisdiction') or ''),
                'entity_status': str(ent.get('status') or 'UNKNOWN'),
                'registration_status': str(reg.get('status') or 'UNKNOWN'),
                'last_update': str(reg.get('lastUpdateDate') or ''),
                'next_renewal': str(reg.get('nextRenewalDate') or '')}
    except SourceError: raise
    except (KeyError, TypeError, ValueError): raise SourceError('SOURCE_SCHEMA_CHANGED') from None


def retry_seconds(header: str, now=None) -> int:
    if not header: return 0
    try: return max(0, min(604800, int(header)))
    except ValueError:
        try:
            dt = parsedate_to_datetime(header)
            return max(0, min(604800, int((dt-(now or utcnow())).total_seconds())))
        except (ValueError, TypeError, OverflowError): return 0


class GleifClient:
    """At most six GETs per job. No redirects, arbitrary hosts, or hidden retries."""
    mode = 'LIVE_GLEIF'
    def __init__(self, allow_network=False, transport=None, max_requests=6, timeout=12,
                 max_seconds=80, min_interval=1.1, cache=None):
        self.allow_network = allow_network
        self.transport = transport
        self.mode = 'INJECTED_TEST_TRANSPORT' if transport is not None else 'LIVE_GLEIF'
        self.max_requests = max_requests; self.timeout = timeout
        self.max_seconds = max_seconds; self.min_interval = min_interval
        self.cache = cache; self.calls = 0; self.cache_hits = 0; self.started = time.monotonic()
        self.last_call = 0.0; self.observations = []
        self.pause_seconds = 0; self.access_denied = False

    def _read(self, path, params=None, optional=False):
        if not self.allow_network and self.transport is None: raise SourceError('NETWORK_NOT_AUTHORIZED')
        if not re.fullmatch(r'/lei-records(?:/[A-Z0-9]{20}(?:/(?:direct-parent|ultimate-parent))?)?', path):
            raise SourceError('SOURCE_PATH_NOT_ALLOWED')
        allowed_params = {'filter[entity.legalName]', 'filter[entity.legalAddress.country]', 'page[size]'}
        if params and (path != '/lei-records' or set(params)-allowed_params): raise SourceError('SOURCE_QUERY_NOT_ALLOWED')
        url = BASE+path+('?' + urlencode(params) if params else '')
        cached = self.cache('get', url, None) if self.cache else None
        if cached:
            body, fetched_at = cached; self.cache_hits += 1
            return self._decode(body, url, fetched_at, True)
        remaining = self.max_seconds-(time.monotonic()-self.started)
        if self.calls >= self.max_requests or remaining <= 0: raise SourceError('JOB_BUDGET_EXHAUSTED', True)
        delay = max(0, self.min_interval-(time.monotonic()-self.last_call))
        if delay >= remaining: raise SourceError('JOB_BUDGET_EXHAUSTED', True)
        if delay: time.sleep(delay)
        self.calls += 1; self.last_call = time.monotonic()
        try:
            with httpx.Client(transport=self.transport, follow_redirects=False,
                              timeout=min(self.timeout, remaining),
                              headers={'Accept':'application/vnd.api+json',
                                       'User-Agent':'LaborTransparency/0.5 (bounded public reference research)'}) as client:
                with client.stream('GET',url) as response:
                    status = response.status_code
                    if status == 404 and optional: return None
                    if status in (401,403):
                        self.access_denied = True
                        raise SourceError('SOURCE_ACCESS_DENIED')
                    if status == 429:
                        self.pause_seconds = max(900, retry_seconds(response.headers.get('retry-after','')))
                        raise SourceError('SOURCE_RATE_LIMITED',True,self.pause_seconds)
                    if status >= 500: raise SourceError('SOURCE_UNAVAILABLE',True)
                    if status == 404: raise SourceError('RECORD_NOT_FOUND')
                    if status != 200: raise SourceError('UNEXPECTED_SOURCE_STATUS')
                    if 'json' not in response.headers.get('content-type',''): raise SourceError('SOURCE_CONTENT_TYPE')
                    body = bytearray()
                    for chunk in response.iter_bytes():
                        body.extend(chunk)
                        if len(body) > MAX_BYTES: raise SourceError('SOURCE_TOO_LARGE')
                        if time.monotonic()-self.started > self.max_seconds: raise SourceError('JOB_DEADLINE_EXCEEDED',True)
                    raw = bytes(body)
        except SourceError: raise
        except httpx.TimeoutException: raise SourceError('SOURCE_TIMEOUT', True) from None
        except httpx.HTTPError: raise SourceError('SOURCE_NETWORK_ERROR', True) from None
        fetched_at = iso(utcnow())
        decoded = self._decode(raw,url,fetched_at,False)
        if self.cache: self.cache('put',url,(raw,fetched_at))
        return decoded

    def _decode(self, raw, url, fetched_at, cached):
        try:
            obj = json.loads(raw)
            if not isinstance(obj,dict) or 'data' not in obj: raise ValueError()
        except (ValueError, TypeError): raise SourceError('SOURCE_JSON_INVALID') from None
        obs = {'id':'gleif-'+hashlib.sha256(url.encode()).hexdigest()[:12],
               'title':'GLEIF公开法律实体参考记录', 'url':url,'publisher':'GLEIF',
               'accessed_at':fetched_at,'reuse_status':'CC0-1.0', 'license_url':LICENSE_URL,
               'content_sha256':hashlib.sha256(raw).hexdigest(), 'cached':cached}
        self.observations.append(obs)
        return obj, obs

    def search(self, name: str, country=''):
        if not 2 <= len(name) <= 120: raise ValueError('企业名称长度不正确')
        params = {'filter[entity.legalName]':name,'page[size]':'5'}
        if re.fullmatch('[A-Z]{2}',country): params['filter[entity.legalAddress.country]'] = country
        obj, obs = self._read('/lei-records',params)
        if not isinstance(obj['data'],list): raise SourceError('SOURCE_SCHEMA_CHANGED')
        candidates=[]
        for row in obj['data'][:5]:
            try: candidates.append(record_projection(row))
            except SourceError as exc:
                if exc.code!='NATURAL_PERSON_EXCLUDED': raise
        return candidates, obs

    def entity(self, lei):
        lei = lei_value(lei)
        obj, obs = self._read('/lei-records/'+lei)
        record = record_projection(obj['data'])
        if record['lei'] != lei: raise SourceError('SOURCE_IDENTITY_MISMATCH')
        return record, obs

    def parent(self, lei, kind):
        if kind not in ('direct-parent','ultimate-parent'): raise ValueError('关系类型不支持')
        result = self._read('/lei-records/'+lei_value(lei)+'/'+kind, optional=True)
        if result is None: return None
        obj, obs = result
        if obj['data'] is None: return None
        return record_projection(obj['data']), obs


def collect(company: dict, client: GleifClient, binding: dict | None = None) -> dict:
    """A plain name yields candidates, never an automatic merge. No model calls."""
    if company['synthetic'] or not company['public']: raise SourceError('PUBLIC_REAL_COMPANY_REQUIRED')
    packet = empty_packet(company); packet['version']='0.5'
    packet['review']={'status':'DRAFT','reviewer':None}
    registry = company.get('registry_id','')
    lei = binding['lei'] if binding else (registry if registry.upper().startswith('LEI:') else '')
    if not lei:
        candidates, _ = client.search(company['name'],company['region'])
        return {'state':'NEEDS_IDENTITY','candidates':candidates,'packet':None,
                'reason':'请选择并核对唯一的企业主体；没有检索结果不等于企业不存在。'}
    try: record, source = client.entity(lei)
    except ValueError: raise SourceError('INVALID_LEI') from None
    matched = (normal_name(record['name'])==normal_name(company['name']) and
               re.fullmatch('[A-Z]{2}',company['region']) and company['region']==record['country'])
    if binding:
        matched = normal_name(record['name'])==normal_name(binding['legal_name']) and record['country']==binding['country']
    if not matched:
        return {'state':'NEEDS_IDENTITY','candidates':[record],'packet':None,
                'reason':'标识、名称或地区需要人工消歧；不自动把相似公司合并。'}
    packet['identity_status']='MATCHED'
    packet['sources']=[source]
    as_of=record['last_update'] or source['accessed_at']
    basis='GLEIF登记参考数据；记录更新时间不是公司劳动条件的核验时间。'
    fields=[('法律名称',record['name'],'/data/attributes/entity/legalName/name'),
            ('LEI',record['lei'],'/data/attributes/lei'),
            ('登记国家/地区',record['country'],'/data/attributes/entity/legalAddress/country'),
            ('法律辖区',record['jurisdiction'],'/data/attributes/entity/jurisdiction'),
            ('来源中的实体状态',record['entity_status'],'/data/attributes/entity/status'),
            ('LEI维护状态（不是企业合法性评级）',record['registration_status'],'/data/attributes/registration/status')]
    packet['sections']['identity']={'status':'PARTIAL','gap':'只核对本条登记参考记录，不代表掌握所有用工主体。',
        'items':[{'text':f'{label}：{value}', 'source_ids':[source['id']], 'as_of':as_of,
                  'basis':basis,'locator':locator} for label,value,locator in fields if value]}
    gaps=[]
    for kind,label in [('direct-parent','直接会计合并母公司'),('ultimate-parent','最终会计合并母公司')]:
        try: result=client.parent(record['lei'],kind)
        except SourceError as exc:
            # Identity remains useful when optional relation retrieval is unavailable.
            gaps.append(f'{label}：本轮未取得可用记录（{exc.code}），不代表没有关系。')
            if exc.code in ('SOURCE_RATE_LIMITED','SOURCE_ACCESS_DENIED'):
                gaps.append('来源要求暂停，其余关系本轮不继续请求。')
                break
            continue
        if result is None:
            gaps.append(f'{label}：接口本轮没有可用记录；未核对申报例外，不推断无母公司。');continue
        parent,ps=result
        if parent['lei']==record['lei']:
            gaps.append(f'{label}：返回自指记录，暂不列入关系。');continue
        packet['sources'].append(ps)
        packet['sections']['ownership']['items'].append({
            'text':f'GLEIF本次查询返回的{label}：{parent["name"]}；LEI：{parent["lei"]}。',
            'source_ids':[ps['id']], 'as_of':ps['accessed_at'],
            'basis':'来源报告的会计合并关系，不等于全部股权、供货、产品质量或劳动责任。',
            'relationship_type':'DIRECT_ACCOUNTING_CONSOLIDATION' if kind=='direct-parent' else 'ULTIMATE_ACCOUNTING_CONSOLIDATION',
            'locator':'/data/attributes/entity/legalName/name','target_lei':parent['lei']})
    section=packet['sections']['ownership']
    section['status']='PARTIAL' if section['items'] else 'NO_DATA'
    section['gap']=' '.join(gaps) or '只覆盖来源披露的直接/最终会计合并关系；不是完整股权或产业链。'
    for key in ('business','facilities','supply_chain','work_conditions','channels'):
        packet['sections'][key]['gap']='GLEIF适配器不提供这一类资料。可由社区补充，或接入另外经许可的来源；本轮保持未知。'
    packet['source_policy']={'adapter':'gleif-0.5','upstream_license':'CC0-1.0',
       'scope':'entity_reference_and_accounting_parents_only','collection_mode':client.mode,'automatic_export':False}
    return {'state':'DRAFT_READY','packet':packet,'candidates':[],'reason':'已获取有限来源资料，等待逐项复核。'}
