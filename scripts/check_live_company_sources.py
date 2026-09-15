# -*- coding: utf-8 -*-
"""Finite live reachability/candidate check for configured public company sources.

This does not bind an entity, approve facts, or publish anything. A candidate count
proves only that the source returned search candidates under the requested name.
"""
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from app.gleif_source import GleifClient,SourceError
from app.company_intelligence import SecClient,WikidataClient,LaborDataClient,USAspendingClient
from app.company_source_registry import source_registry


def probe(label,fn):
    try:
        value=fn()
        return {'status':'PASS','candidate_count':len(value) if isinstance(value,list) else None,
                'sample':value[:3] if isinstance(value,list) else value}
    except SourceError as e:
        return {'status':'SOURCE_ERROR','code':e.code,'retryable':e.retryable}
    except Exception as e:
        return {'status':'UNEXPECTED_ERROR','type':type(e).__name__}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--network',action='store_true');ap.add_argument('--name',default='Starbucks Corporation');ap.add_argument('--country',default='US');ap.add_argument('--out',default='qa/v0_8/live-company-sources.json');args=ap.parse_args()
    if not args.network:raise SystemExit('Refusing live source calls without --network')
    gleif=GleifClient(allow_network=True,max_requests=1,min_interval=0)
    sec=SecClient(allow_network=True,max_requests=1,min_interval=0)
    wiki=WikidataClient(allow_network=True,max_requests=1,min_interval=0)
    labor=LaborDataClient(allow_network=True,max_requests=8,min_interval=0,timeout=20,max_seconds=60)
    spend=USAspendingClient(allow_network=True,max_requests=2,min_interval=0,timeout=30,max_seconds=60)
    results={
      'GLEIF':probe('GLEIF',lambda:gleif.search(args.name,args.country)[0]),
      'SEC_EDGAR':probe('SEC',lambda:sec.search(args.name)),
      'WIKIDATA':probe('Wikidata',lambda:wiki.search(args.name)),
      'NLRB_CASES':probe('NLRB',lambda:labor.nlrb_search(args.name)),
      'OSHA_ENFORCEMENT':probe('OSHA',lambda:labor.osha_search(args.name)),
      'DOL_WHD':probe('WHD',lambda:labor.whd_search(args.name)),
      'FMCS_F7':probe('F7',lambda:labor.f7_search(args.name)),
      'NLRB_VOLUNTARY_RECOGNITION':probe('VR',lambda:labor.voluntary_search(args.name)),
      'FMCS_WORK_STOPPAGES':probe('stoppages',lambda:labor.stoppage_search(args.name)),
      'OLMS_LM20':probe('LM20',lambda:labor.lm20_search(args.name)),
      'USA_SPENDING':probe('USAspending',lambda:spend.search(args.name)),
    }
    calls={'GLEIF':gleif.calls,'SEC_EDGAR':sec.calls,'WIKIDATA':wiki.calls,'LABORDATA_TOTAL':labor.calls,'USA_SPENDING':spend.calls}
    obj={'status':'FINITE_LIVE_CANDIDATE_CHECK','name':args.name,'country':args.country,'results':results,'requests':calls,
         'claim_boundary':'Search reachability/candidates only. This run does not prove entity match, labor violations, full coverage, or publication readiness.',
         'source_registry':source_registry()}
    out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(obj,ensure_ascii=False))
if __name__=='__main__':main()
