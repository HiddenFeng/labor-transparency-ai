"""Generate synthetic API fixtures for renderer tests, NOT visual or real-evidence proof."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tests.test_community import CommunityTests

def main():
    t=CommunityTests();t.setUp()
    try:
        t.vote();pid=t.make(t.data(kind='product',title='虚构产品 <script>alert(1)</script>',description='这只是合成产品记录。',direction='neutral',sources=[]))
        cid=t.make();t.ok(t.rev(cid));t.ok(t.export(cid))
        paths=['/config','/companies','/companies/'+t.cid,'/contributions?mine=true','/contributions?company_id='+t.cid,'/contributions/'+cid,'/contributions/'+pid,'/public-data']
        f={p:t.ok(t.get(p)) for p in paths}
        for lane in ['community_positive','community_negative','evidence_positive']:
            p='/showcase?lane='+lane+'&q=&days=7';f[p]=t.ok(t.get(p))
        t.ok(t.post('/contributions/'+pid+'/flag',{'reason':'仅供核验员的私密纠错测试'},t.d))
        for p in ['/review-role','/review-queue']:f[p]=t.ok(t.get(p,t.b))
        f['_ids']={'company':t.cid,'contribution':cid,'product':pid}
        Path(sys.argv[1]).write_text(json.dumps(f,ensure_ascii=False,indent=2))
    finally:t.tearDown()
if __name__=='__main__':main()
