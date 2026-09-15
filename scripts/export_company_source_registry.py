# -*- coding: utf-8 -*-
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from app.company_source_registry import source_registry,coverage_summary

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',default='docs/v0_8/source-registry.json');args=ap.parse_args()
 out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
 payload={'schema':'ltp-company-source-registry-1','sources':source_registry(),'sections':coverage_summary(),
          'boundary':'Registry status describes adapter/source capability, not a claim that every company has records in every source.'}
 out.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(out)
if __name__=='__main__':main()
