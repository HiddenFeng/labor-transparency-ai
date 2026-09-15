# -*- coding: utf-8 -*-
"""Finite live multi-source draft build using explicit operator-supplied bindings.

It writes a local QA artifact only; it never approves or publishes a packet.
"""
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from app.company_intelligence import CompanyIntelligenceClient,collect_company_intelligence


def main():
 ap=argparse.ArgumentParser();ap.add_argument('--network',action='store_true');ap.add_argument('--name',required=True);ap.add_argument('--country',required=True)
 ap.add_argument('--lei',required=True);ap.add_argument('--wikidata');ap.add_argument('--nlrb-name');ap.add_argument('--osha-name');ap.add_argument('--whd-name');ap.add_argument('--f7-name');ap.add_argument('--vr-name');ap.add_argument('--stoppage-name');ap.add_argument('--lm20-name');ap.add_argument('--usa-recipient');ap.add_argument('--sec-cik')
 ap.add_argument('--out',default='qa/v0_8/live-company-intelligence.json');args=ap.parse_args()
 if not args.network:raise SystemExit('Refusing live source calls without --network')
 company={'id':'qa-live-company','name':args.name,'region':args.country,'registry_id':'LEI:'+args.lei,'public':True,'synthetic':False}
 gleif_binding={'lei':args.lei,'legal_name':args.name.upper(),'country':args.country}
 ext={}
 if args.wikidata:ext['WIKIDATA']={'external_id':args.wikidata}
 if args.nlrb_name:ext['NLRB_CASES']={'external_id':args.nlrb_name}
 if args.osha_name:ext['OSHA_ENFORCEMENT']={'external_id':args.osha_name}
 if args.whd_name:ext['DOL_WHD']={'external_id':args.whd_name}
 if args.f7_name:ext['FMCS_F7']={'external_id':args.f7_name}
 if args.vr_name:ext['NLRB_VOLUNTARY_RECOGNITION']={'external_id':args.vr_name}
 if args.stoppage_name:ext['FMCS_WORK_STOPPAGES']={'external_id':args.stoppage_name}
 if args.lm20_name:ext['OLMS_LM20']={'external_id':args.lm20_name}
 if args.usa_recipient:ext['USA_SPENDING']={'external_id':args.usa_recipient}
 if args.sec_cik:ext['SEC_EDGAR']={'external_id':args.sec_cik.zfill(10)}
 client=CompanyIntelligenceClient.live()
 out=collect_company_intelligence(company,client,gleif_binding,ext)
 packet=out.get('packet')
 summary={k:{'status':v['status'],'items':len(v['items']),'gap':v.get('gap','')} for k,v in (packet.get('sections') or {}).items()} if packet else {}
 result={'status':out['state'],'company':{'name':args.name,'country':args.country,'lei':args.lei},'bindings':{k:v['external_id'] for k,v in ext.items()},
   'requests':client.calls,'cache_hits':client.cache_hits,'candidate_count':len(out.get('candidates') or []),'sections':summary,
   'packet_source_count':len(packet.get('sources',[])) if packet else 0,
   'providers_in_items':sorted({i.get('provider','GLEIF') for s in (packet.get('sections') or {}).values() for i in s['items']}) if packet else [],
   'claim_boundary':'Live draft assembly only. Explicit bindings were supplied for QA; this run does not approve/publish facts and does not prove global completeness.',
   'packet':packet}
 p=Path(args.out);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({k:v for k,v in result.items() if k!='packet'},ensure_ascii=False))
if __name__=='__main__':main()
