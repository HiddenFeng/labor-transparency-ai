"""Finite local CLI: no scheduling, external website visits or automatic publishing online."""
import argparse
import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from .core import SECTIONS, empty_packet, utcnow
from .platform import PHASES
from .research import Store

ROOT = Path(__file__).resolve().parents[1]

def demonstration_packet(company, now):
    packet = empty_packet(company)
    packet['identity_status'] = 'MATCHED'
    packet['review'] = {'status': 'APPROVED', 'reviewer': 'SYNTHETIC_FIXTURE_NOT_REAL_REVIEW'}
    packet['sources'] = [{'id':'demo-s1','title':'虚构公司演示资料（非真实来源）',
         'url':'https://example.invalid/synthetic-company-disclosure',
         'publisher':'本地合成测试夹具','accessed_at':now.isoformat(),
         'reuse_status':'SYNTHETIC_FIXTURE_ONLY'}]
    examples = {
        'identity':('演示主体：'+company['name']+'。此信息为合成数据，不代表现实企业。',None),
        'business':('业务示例：轻型设备零部件；产品示例：连接器、金属外壳。',None),
        'ownership':('示例青禾制造集团（虚构）为母公司；仅演示有来源的关系结构。','PARENT_DISCLOSED'),
        'facilities':('示例工厂A（虚构）为生产地点，不等同独立法定用工主体。','OPERATES_SITE'),
        'supply_chain':('示例品牌B（虚构）曾在2025年演示供应商名单中列出本公司；当前关系未知。','HISTORICAL_SUPPLIER_DISCLOSURE')
    }
    for k,(text, rel) in examples.items():
        item={'text':text,'source_ids':['demo-s1'],'as_of':'2025（合成演示期间）','basis':'合成演示，不是核实结论'}
        if rel: item['relationship_type']=rel
        packet['sections'][k]={'status':'PARTIAL','items':[item], 'gap':'演示只有有限条目，不声称完整覆盖。'}
    packet['sections']['work_conditions']['gap']='未接入真实劳动信息；讨论不会因本栏空白而被阻塞。'
    packet['sections']['channels']['gap']='未确定首发法域和经核验渠道；不得据此自动提交申诉。'
    return packet


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db',default=str(ROOT/'local-data'/'demo.sqlite3'))
    parser.add_argument('--tz',default='Asia/Tokyo')
    parser.add_argument('--publish-hour',type=int,default=9,choices=range(24))
    sub=parser.add_subparsers(dest='command',required=True)
    sub.add_parser('init')
    phase=sub.add_parser('phase'); phase.add_argument('value',choices=list(PHASES))
    sub.add_parser('queue')
    sub.add_parser('release')
    forum=sub.add_parser('forum'); forum.add_argument('value',choices=['on','off'])
    prep=sub.add_parser('prepare'); prep.add_argument('company_id'); prep.add_argument('day'); prep.add_argument('packet')
    sub.add_parser('seed-demo')
    sub.add_parser('seed-community-demo')
    sub.add_parser('cycle-demo')
    args=parser.parse_args()
    store=Store(args.db,args.tz,args.publish_hour)
    result={}
    if args.command=='init': result={'database':args.db,'mode':'LOCAL_DEMO'}
    elif args.command=='phase':
        store.set_phase(args.value); result={'phase':store.phase(),'capabilities':store.capabilities()}
    elif args.command=='forum':
        store.set_forum(args.value=='on'); result={'forum_enabled':args.value=='on','scope':'LOCAL_ONLY'}
    elif args.command=='queue':
        with store.db() as c:
            result=[dict(r) for r in c.execute('SELECT j.id,j.company_id,co.name,j.batch_day,j.due_at,j.status FROM jobs j JOIN companies co ON co.id=j.company_id ORDER BY j.batch_day,j.id')]
    elif args.command=='prepare':
        packet=json.loads(Path(args.packet).read_text(encoding='utf-8'))
        result={'packet_digest':store.prepare(args.company_id,args.day,packet)}
    elif args.command=='release': result=store.release()
    elif args.command=='seed-community-demo':
        from .demo import seed_community
        result=seed_community(store)
    elif args.command=='seed-demo':
        at=utcnow()-timedelta(days=2)
        receipt=store.register('seed-demo-owner',{'name':'青禾精密制造（虚构）','region':'示例地区','needs':['company'],
             'public':True,'consent':True,'synthetic':True},'seed-company-0001',at)
        co=store.company(receipt['company_id'],'seed-demo-owner')
        if receipt['status']=='QUEUED':
            store.prepare(co['id'],receipt['batch_day'],demonstration_packet(co,utcnow()))
        result={'seed_receipt':receipt,'release':store.release()}
    elif args.command=='cycle-demo':
        # Advances only synthetic work using a simulated clock. Never described as a real next-day run.
        with store.db() as c:
            jobs=[dict(j) for j in c.execute("SELECT j.*,co.synthetic FROM jobs j JOIN companies co ON co.id=j.company_id WHERE j.status IN ('QUEUED','PREPARED')")]
        if any(not j['synthetic'] for j in jobs):
            raise SystemExit('拒绝：队列含非合成主体，不能运行时间推进演示')
        future=utcnow()
        for j in jobs:
            with store.db() as c: co=dict(c.execute('SELECT * FROM companies WHERE id=?',(j['company_id'],)).fetchone())
            if j['status']=='QUEUED': store.prepare(co['id'],j['batch_day'],demonstration_packet(co,utcnow()))
            future=max(future,datetime.fromisoformat(j['due_at'])+timedelta(seconds=1))
        result={'clock':'SIMULATED','network_research':False,'released':store.release(future)}
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
