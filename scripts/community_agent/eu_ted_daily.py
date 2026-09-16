#!/usr/bin/env python3
"""Collect bounded EU TED procurement relations for existing EU/EEA company spaces.

Search is broad enough to find multilingual/phrase hits, but publishing is fail-closed:
only an exact normalized participant name becomes an OFFICIAL_SOURCE_RELATION.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import unicodedata
from pathlib import Path
from typing import Iterable

if __package__:
    from .nmpa_udi_daily import DEFAULT_ORIGIN, http_json, load_agent_token
else:
    from nmpa_udi_daily import DEFAULT_ORIGIN, http_json, load_agent_token

TED_SEARCH='https://api.ted.europa.eu/v3/notices/search'
TED_HOME='https://ted.europa.eu/'
SOURCE_OF_RECORD='Publications Office of the European Union / Tenders Electronic Daily (TED)'
EU_EEA_CODES={'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO'}
REGION_ALIASES={
 'austria':'AT','österreich':'AT','belgium':'BE','belgië':'BE','belgique':'BE','bulgaria':'BG','croatia':'HR','cyprus':'CY','czechia':'CZ','czech republic':'CZ','denmark':'DK','estonia':'EE','finland':'FI','france':'FR','germany':'DE','deutschland':'DE','greece':'GR','hungary':'HU','ireland':'IE','italy':'IT','italia':'IT','latvia':'LV','lithuania':'LT','luxembourg':'LU','malta':'MT','netherlands':'NL','the netherlands':'NL','poland':'PL','portugal':'PT','romania':'RO','slovakia':'SK','slovenia':'SI','spain':'ES','españa':'ES','sweden':'SE','iceland':'IS','liechtenstein':'LI','norway':'NO','eu':'EU','eea':'EEA','european union':'EU'
}


def normalize_name(value:str)->str:
    value=unicodedata.normalize('NFKC',str(value or '')).strip().casefold()
    value=re.sub(r'[\s\u00a0]+',' ',value)
    value=re.sub(r'[“”„‟"\']','',value)
    return value


def region_code(value:str)->str:
    raw=unicodedata.normalize('NFKC',str(value or '')).strip()
    upper=raw.upper()
    if upper in EU_EEA_CODES or upper in {'EU','EEA'}: return upper
    lower=raw.casefold()
    for label,code in REGION_ALIASES.items():
        if lower==label or re.search(rf'(^|[,/·\s]){re.escape(label)}($|[,/·\s])',lower): return code
    return ''


def eligible_companies(companies:Iterable[dict])->list[dict]:
    out=[]
    for c in companies:
        if c.get('synthetic'): continue
        if region_code(c.get('region','')):
            name=str(c.get('name','')).strip()
            if len(name)>=3: out.append(c)
    return out


def flatten_names(value)->list[str]:
    if isinstance(value,dict):
        out=[]
        for v in value.values():
            if isinstance(v,list): out.extend(str(x) for x in v if x)
            elif v: out.append(str(v))
        return out
    if isinstance(value,list): return [str(x) for x in value if x]
    return [str(value)] if value else []


def localized_text(value)->str:
    if isinstance(value,dict):
        for key in ('eng','en','deu','fra','ita','spa'):
            v=value.get(key)
            if isinstance(v,list) and v: return str(v[0])
            if isinstance(v,str) and v: return v
        for v in value.values():
            if isinstance(v,list) and v: return str(v[0])
            if isinstance(v,str) and v: return v
    if isinstance(value,list) and value: return str(value[0])
    return str(value or '')


def notice_url(notice:dict)->str:
    links=notice.get('links') or {}
    for bucket in ('html','htmlDirect'):
        values=links.get(bucket) or {}
        if isinstance(values,dict):
            for lang in ('ENG','DEU','FRA','ITA','SPA'):
                if values.get(lang): return str(values[lang])
            if values: return str(next(iter(values.values())))
    number=str(notice.get('publication-number') or '')
    return f'https://ted.europa.eu/en/notice/-/detail/{number}' if number else TED_HOME


def publication_date(value)->str:
    s=str(value or '')
    m=re.match(r'^(\d{4}-\d{2}-\d{2})',s)
    return m.group(1) if m else ''


def escape_query_phrase(value:str)->str:
    return str(value).replace('\\','\\\\').replace('"','\\"')


def query_body(name:str,role:str,start:dt.date,end:dt.date,limit:int=25)->dict:
    field='winner-name' if role=='WINNER' else 'buyer-name'
    query=f'{field} ~ "{escape_query_phrase(name)}" AND PD = ({start:%Y%m%d} <> {end:%Y%m%d})'
    return {
        'query':query,
        'fields':['publication-number','notice-title','buyer-name','winner-name','publication-date'],
        'page':1,'limit':max(1,min(25,int(limit))),'scope':'ALL','paginationMode':'PAGE_NUMBER'
    }


def exact_role_match(company_name:str,notice:dict,role:str)->bool:
    field='winner-name' if role=='WINNER' else 'buyer-name'
    target=normalize_name(company_name)
    return any(normalize_name(x)==target for x in flatten_names(notice.get(field)))


def relation_from_notice(company:dict,notice:dict,role:str)->dict|None:
    if not exact_role_match(company.get('name',''),notice,role): return None
    number=str(notice.get('publication-number') or '').strip()
    if not number: return None
    title=localized_text(notice.get('notice-title')) or f'EU public procurement notice {number}'
    buyers=flatten_names(notice.get('buyer-name'))[:12]
    winners=flatten_names(notice.get('winner-name'))[:12]
    source_date=publication_date(notice.get('publication-date'))
    attrs={
        'participantRole':role,
        'noticeNumber':number,
        'noticeTitle':title[:600],
        'buyerNames':buyers,
        'winnerNames':winners,
        'publicationDate':source_date,
    }
    return {
        'companyId':company['id'],'provider':'EU_TED','jurisdiction':'EU',
        'relationType':'PUBLIC_PROCUREMENT_RELATION','objectType':'contract',
        'objectName':title[:240],'objectExternalId':number,'sourceRecordId':number,
        'sourceOfRecord':SOURCE_OF_RECORD,'sourceUrl':notice_url(notice),'sourceDate':source_date,
        'confidence':'HIGH',
        'scope':f'TED published notice {number}: the exact company name appears as the {"winner/supplier" if role=="WINNER" else "buyer"} participant in this specific procurement notice.',
        'caveat':'This official notice supports only the company role in this specific published procurement event. It does not establish the company complete customer/supplier network, product quality, labor quality, legality beyond the notice, or endorsement by the buyer/EU.',
        'attributes':attrs,
    }


def search_ted(name:str,role:str,start:dt.date,end:dt.date,limit:int=25,fetch=http_json)->dict:
    return fetch(TED_SEARCH,method='POST',payload=query_body(name,role,start,end,limit))


def collect(companies:Iterable[dict],start:dt.date,end:dt.date,limit:int=25,fetch=http_json)->tuple[list[dict],dict]:
    eligible=eligible_companies(companies)
    relations=[]; requests=0; notices=0; exact=0; errors=[]
    for company in eligible:
        for role in ('WINNER','BUYER'):
            try:
                data=search_ted(company['name'],role,start,end,limit,fetch=fetch);requests+=1
                rows=data.get('notices') or []; notices+=len(rows)
                for notice in rows:
                    rel=relation_from_notice(company,notice,role)
                    if rel: relations.append(rel); exact+=1
            except Exception as exc:
                requests+=1;errors.append({'companyId':company.get('id'),'role':role,'error':type(exc).__name__})
    seen=set();unique=[]
    for rel in relations:
        key=(rel['companyId'],rel['sourceRecordId'],rel['attributes']['participantRole'])
        if key in seen: continue
        seen.add(key);unique.append(rel)
    return unique,{
        'eligibleCompanies':len(eligible),'requests':requests,'noticesReturned':notices,
        'exactRelations':exact,'uniqueRelations':len(unique),'errors':errors,
        'windowStart':start.isoformat(),'windowEnd':end.isoformat()
    }


def load_companies(origin:str,companies_file:str='')->list[dict]:
    if companies_file:
        data=json.loads(Path(companies_file).read_text(encoding='utf-8'))
        return data.get('items',data) if isinstance(data,dict) else data
    return http_json(f'{origin.rstrip("/")}/api/companies').get('items',[])


def publish_relations(origin:str,relations:list[dict])->int:
    if not relations:return 0
    token=load_agent_token();saved=0
    for i in range(0,len(relations),250):
        result=http_json(f'{origin.rstrip("/")}/api/community-agent/official-relations',token=token,method='POST',payload={'items':relations[i:i+250]})
        saved+=int(result.get('savedCount',0))
    return saved


def run(args)->dict:
    today=dt.date.fromisoformat(args.to_date) if args.to_date else dt.datetime.now(dt.timezone.utc).date()
    start=dt.date.fromisoformat(args.from_date) if args.from_date else today-dt.timedelta(days=max(1,min(90,args.days))-1)
    if start>today: raise ValueError('from-date must be <= to-date')
    companies=load_companies(args.origin,args.companies_file)
    relations,metrics=collect(companies,start,today,args.limit)
    published=publish_relations(args.origin,relations) if args.publish else 0
    result={'status':'PASS' if not metrics['errors'] else 'PASS_WITH_SOURCE_ERRORS','provider':'EU_TED',**metrics,'publishedRelations':published,'publishRequested':bool(args.publish)}
    if args.output:
        path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return result


def parser()->argparse.ArgumentParser:
    p=argparse.ArgumentParser();p.add_argument('--origin',default=DEFAULT_ORIGIN);p.add_argument('--companies-file',default='');p.add_argument('--days',type=int,default=8);p.add_argument('--from-date',default='');p.add_argument('--to-date',default='');p.add_argument('--limit',type=int,default=25);p.add_argument('--publish',action='store_true');p.add_argument('--output',default='');return p

if __name__=='__main__': print(json.dumps(run(parser().parse_args()),ensure_ascii=False))
