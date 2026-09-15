"""Prepare a static, read-only public artifact; no deploy or Sites binding."""
import argparse,json,sys,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from app.publication import write_snapshot
from app.community import LICENSE_ID,KINDS
from app.core import iso,utcnow

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--data',help='精确的/api/public-data快照；未指定则发布零条记录')
    p.add_argument('--out',required=True);a=p.parse_args();out=Path(a.out)
    if out.exists() and any(out.iterdir()):raise SystemExit('请提供空目录，避免覆盖已有站点')
    d=json.loads(Path(a.data).read_text()) if a.data else {'schema_version':'0.4','license':LICENSE_ID,'purpose':'仅限非商业公益用途','generated_at':iso(utcnow()),'categories':{k:[] for k in KINDS},'record_count':0,'withdrawal_notice':'撤回从后续快照排除，已下载副本不能保证回收。'}
    # Validate everything before copying, including the safety projection.
    from app.publication import validate_dataset
    validate_dataset(d);out.mkdir(parents=True,exist_ok=True)
    for name in ['index.html','styles.css','site.js']:shutil.copy2(ROOT/'site-src'/name,out/name)
    write_snapshot(d,out/'data')
    for src,dst in [('LICENSE','LICENSE.txt'),('LICENSE-DATA.md','LICENSE-DATA.md'),('CONTRIBUTING.md','CONTRIBUTING.md')]:shutil.copy2(ROOT/src,out/dst)
    body=(ROOT/'app/web/whitepaper.html').read_text()
    (out/'whitepaper.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>劳动透明计划 · 完整白皮书</title><link rel="stylesheet" href="styles.css"><body><main class="reading"><a href="index.html">返回公益计划</a><h1>完整白皮书与历史基线</h1><p>历史方案中的功能不代表已全部接入。v0.4新增共建与公益数据，当前站点为只读发行。</p>'+body+'</main></body></html>')
    (out/'.nojekyll').write_text('')
    print(json.dumps({'status':'BUILT_NOT_DEPLOYED','directory':str(out),'records':d['record_count'],'mode':'read-only-static'},ensure_ascii=False))
if __name__=='__main__':main()
