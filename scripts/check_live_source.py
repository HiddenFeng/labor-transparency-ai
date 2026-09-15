"""One explicitly authorized public-source probe; no DB, publication, or scheduling.
This is a connectivity/schema check, not an assertion about a company's labor practices.
"""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.gleif_source import GleifClient,SourceError
from app.core import iso,utcnow

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--allow-network',action='store_true')
    p.add_argument('--name',default='Apple Inc.')
    p.add_argument('--country',default='US')
    p.add_argument('--out',required=True)
    a=p.parse_args()
    if not a.allow_network:p.error('真实来源检查需要 --allow-network；不会使用模拟数据替代')
    client=GleifClient(allow_network=True,max_requests=1,max_seconds=20,timeout=12)
    result={'at':iso(utcnow()),'provider':'GLEIF','mode':client.mode,'fixture_used':False,
            'max_requests':1,'company_query':a.name,'country_query':a.country,
            'published':False,'scheduler_installed':False,'labor_claim_verified':False}
    try:
        candidates,source=client.search(a.name,a.country)
        result.update(status='CONNECTIVITY_AND_SEARCH_SCHEMA_PASSED',candidate_count=len(candidates),
                      projections=candidates,source=source,
                      note='检索成功不代表主体已匹配、关系已核验或用户链路已完成。')
    except SourceError as exc:
        result.update(status='SOURCE_CHECK_FAILED',code=exc.code,retryable=exc.retryable,
                      note='未取得本次真实来源结果；没有用夹具或网页摘要冒充接口成功。')
    result['requests']=client.calls
    out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if result['status']=='SOURCE_CHECK_FAILED':raise SystemExit(2)
if __name__=='__main__':main()
