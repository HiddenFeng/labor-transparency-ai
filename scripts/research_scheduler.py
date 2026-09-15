"""Finite/persistent research scheduler entry point.

Nothing is installed automatically. Network collection requires --network on each process start.
Use --once for a single cycle; --loop is suitable for a supervised service after deployment review.
"""
from __future__ import annotations
import argparse,json,os,signal,socket,time,uuid,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app.research import Store

STOP=False
def _stop(*_):
    global STOP;STOP=True

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--db',default=os.getenv('LTP_DB','local-data/demo.sqlite3'))
    p.add_argument('--timezone',default=os.getenv('LTP_TZ','Asia/Tokyo'))
    p.add_argument('--publish-hour',type=int,default=int(os.getenv('LTP_PUBLISH_HOUR','9')))
    mode=p.add_mutually_exclusive_group();mode.add_argument('--once',action='store_true');mode.add_argument('--loop',action='store_true')
    p.add_argument('--network',action='store_true',help='明确允许公开企业资料网络查询')
    p.add_argument('--include-current',action='store_true')
    p.add_argument('--max-jobs',type=int,default=5);p.add_argument('--max-attempts',type=int,default=3)
    p.add_argument('--daily-budget',type=int,default=120);p.add_argument('--interval-seconds',type=int,default=300)
    p.add_argument('--worker-id',default='scheduler-'+socket.gethostname()+'-'+uuid.uuid4().hex[:8])
    a=p.parse_args()
    if not 60<=a.interval_seconds<=3600:raise SystemExit('interval-seconds must be 60..3600')
    store=Store(Path(a.db),a.timezone,a.publish_hour)
    signal.signal(signal.SIGTERM,_stop);signal.signal(signal.SIGINT,_stop)
    def cycle():
        try:
            result=store.scheduler_cycle(worker_id=a.worker_id,allow_network=a.network,max_jobs=a.max_jobs,
                max_attempts=a.max_attempts,daily_budget=a.daily_budget,include_current=a.include_current,
                interval_seconds=a.interval_seconds)
            print(json.dumps({'ok':True,'worker_id':a.worker_id,**result},ensure_ascii=False),flush=True)
        except Exception as exc:
            # Do not serialize upstream query/credentials or private payloads into service logs.
            store._scheduler_heartbeat(a.worker_id,'NETWORK' if a.network else 'RELEASE_ONLY',a.interval_seconds,{},error=type(exc).__name__)
            print(json.dumps({'ok':False,'worker_id':a.worker_id,'error':type(exc).__name__},ensure_ascii=False),flush=True)
            if not a.loop:raise
    cycle()
    if a.loop:
        while not STOP:
            for _ in range(a.interval_seconds):
                if STOP:break
                time.sleep(1)
            if not STOP:cycle()

if __name__=='__main__':main()
