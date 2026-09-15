"""Run ONE bounded research/release cycle. Does not install a daemon or auto-approve.
A service manager may later invoke this command. Network use requires --allow-network.
"""
import argparse,json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.research import Store

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--db',required=True)
    p.add_argument('--tz',default=os.getenv('LTP_TZ','Asia/Tokyo'))
    p.add_argument('--publish-hour',type=int,default=int(os.getenv('LTP_PUBLISH_HOUR','9')))
    p.add_argument('--allow-network',action='store_true')
    p.add_argument('--max-jobs',type=int,default=5)
    p.add_argument('--daily-budget',type=int,default=120)
    p.add_argument('--include-current',action='store_true',help='Explicit on-demand test; otherwise closed calendar days only')
    p.add_argument('--release-only',action='store_true')
    p.add_argument('--out')
    a=p.parse_args()
    if not a.release_only and not a.allow_network:p.error('查询需 --allow-network；仅发布已复核版本使用 --release-only')
    s=Store(a.db,a.tz,a.publish_hour)
    result={'collection':None,'released':[],'scheduler_installed':False}
    if not a.release_only:
        result['collection']=s.run_research(allow_network=True,max_jobs=a.max_jobs,
            daily_budget=a.daily_budget,include_current=a.include_current)
    result['released']=s.release()
    text=json.dumps(result,ensure_ascii=False,indent=2)
    if a.out:
        out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(text)
    print(text)
    runs=(result['collection'] or {}).get('runs',[])
    # A transport failure must not give unattended operators an all-clear exit status.
    if any(r['state'] in ('RETRY_WAIT','FAILED_FINAL','LEASE_EXPIRED') for r in runs):raise SystemExit(2)
if __name__=='__main__':main()
