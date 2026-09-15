# -*- coding: utf-8 -*-
"""Deterministic audit of the current multi-source research contract.

Uses injected HTTP fixtures only. It does not access the network, publish externally,
or change the real project database.
"""
from __future__ import annotations
import argparse,json,tempfile,sys
from datetime import datetime,timedelta
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from app.research import Store
from app.company_source_registry import source_registry,coverage_summary
from tests.test_company_intelligence import composite,LEI,AT

EXPECTED={'GLEIF','SEC_EDGAR','WIKIDATA','NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20','USA_SPENDING'}
BINDABLE=EXPECTED-{'GLEIF'}

def assert_(cond,msg):
    if not cond:raise AssertionError(msg)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',default='qa/v0_8/company-intelligence-audit.json');args=ap.parse_args()
    with tempfile.TemporaryDirectory(prefix='ltp-company-intel-audit-') as td:
        store=Store(Path(td)/'audit.sqlite3')
        receipt=store.register('AUDIT_OWNER',{'name':'Acme Public Corp','region':'US','registry_id':'LEI:'+LEI,'needs':['company','products','supply_chain'],'public':True,'synthetic':False,'consent':True},'company-intel-audit-01',AT)
        first=store.run_research(at=AT,client_factory=composite,daily_budget=120,include_current=True)
        assert_(first['runs'] and first['runs'][0]['state']=='DRAFT_READY','first multi-source run not draft-ready')
        run=store.task_list()[0]['run'];providers={x.get('provider') for x in run['candidates']}
        assert_(BINDABLE<=providers,'missing provider candidates: '+str(sorted(BINDABLE-providers)))
        assert_(not run['packet']['sections']['work_conditions']['items'],'unbound secondary labor candidates leaked into facts')
        bound=[]
        for provider in sorted(BINDABLE):
            candidate=next(x for x in run['candidates'] if x.get('provider')==provider)
            store.bind_external_source(run['id'],provider,candidate['external_id'],'operator:audit','确定性fixture中逐来源核对候选主体后绑定',AT)
            bound.append({'provider':provider,'external_id':candidate['external_id']})
        second=store.run_research(at=AT,client_factory=composite,daily_budget=120,include_current=True)
        assert_(second['runs'] and second['runs'][0]['state']=='DRAFT_READY','bound multi-source run not draft-ready')
        final=store.task_list()[0]['run'];packet=final['packet']
        item_providers={i.get('provider','GLEIF') for sec in packet['sections'].values() for i in sec['items']}
        assert_(EXPECTED<=item_providers,'bound providers missing from facts: '+str(sorted(EXPECTED-item_providers)))
        assert_(packet['sections']['supply_chain']['items'],'supply-chain/public-award section did not receive bound facts')
        assert_(packet['sections']['work_conditions']['items'],'labor sections did not receive bound facts')
        nlr=next(x for x in packet['sections']['work_conditions']['items'] if x.get('provider')=='NLRB_CASES')
        assert_('不等于NLRB已认定雇主违法' in nlr['basis'],'NLRB procedural boundary missing')
        lm=next(x for x in packet['sections']['work_conditions']['items'] if x.get('provider')=='OLMS_LM20')
        assert_('不能自动表述为不公平劳动行为认定' in lm['basis'],'OLMS semantic boundary missing')
        review=store.review_research(final['id'],final['packet_hash'],'operator:independent-review','确定性多源审计完成主体、来源、范围、隐私和许可复核',{'identity_checked':True,'sources_checked':True,'scope_checked':True,'no_private_data':True,'license_checked':True},AT)
        release_at=datetime.fromisoformat(receipt['due_at'])+timedelta(seconds=1)
        released=store.release(release_at)
        status=store.task_list()[0]
        assert_(status['state']=='PUBLISHED' and released,'reviewed multi-source packet did not enter existing release path')
        reopened=Store(Path(td)/'audit.sqlite3').task_list()[0]
        assert_(reopened['state']=='PUBLISHED','multi-source state did not survive store reopen')
        obj={
          'status':'PASS_MULTI_SOURCE_PIPELINE_SOURCE_COVERAGE_PARTIAL',
          'synthetic_fixture':True,'network_used':False,'company_id':receipt['company_id'],
          'candidate_providers':sorted(providers),'bound_providers':bound,'item_providers':sorted(item_providers),
          'sections':{k:{'status':v['status'],'items':len(v['items']),'gap':v.get('gap','')} for k,v in packet['sections'].items()},
          'source_count':len(packet['sources']),'review_digest':review['digest'],'released':len(released),'restart_persistence':True,
          'registry_source_count':len(source_registry()),'registry_sections':coverage_summary(),
          'claim_boundary':'This audit proves deterministic multi-source candidate→binding→draft→independent review→release orchestration. It does not prove live provider uptime, global data completeness, or correctness for an arbitrary real company.'
        }
        out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(obj,ensure_ascii=False))
if __name__=='__main__':main()
