"""Loopback launcher. Does not install schedulers, deploy online, or call a model."""
from pathlib import Path
import argparse,os,secrets,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app.research import Store

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--port',type=int,default=8765)
    p.add_argument('--db',default=str(ROOT/'local-data'/'demo.sqlite3'))
    p.add_argument('--phase',choices=['plan','community','assistance'],default=None)
    p.add_argument('--public-research',action='store_true',help='允许登记真实企业公开资料，仍非生产服务')
    p.add_argument('--research-network',action='store_true',help='允许运营在明确确认后触发有限公开查询')
    args=p.parse_args()
    if not 1024<=args.port<=65535:raise SystemExit('请选择1024—65535的本地端口')
    store=Store(args.db,os.getenv('LTP_TZ','Asia/Tokyo'),int(os.getenv('LTP_PUBLISH_HOUR','9')))
    if args.phase:store.set_phase(args.phase)
    token=secrets.token_urlsafe(32)
    os.environ['LTP_DB']=args.db
    os.environ['LTP_ADMIN_TOKEN']=token
    print(f'本地网页：http://127.0.0.1:{args.port}',flush=True)
    print(f'本地运营页：http://127.0.0.1:{args.port}/#manage',flush=True)
    print(f'本次管理凭据（不要分享）：{token}',flush=True)
    print('仅本机体验；勿使用真实材料。按 Ctrl+C 停止。',flush=True)
    import uvicorn
    from app.server import create_app
    uvicorn.run(create_app(args.db,admin_token=token,public_research=args.public_research,research_network=args.research_network),host='127.0.0.1',port=args.port,access_log=False)

if __name__=='__main__':main()
