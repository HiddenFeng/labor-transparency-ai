"""Create synthetic API fixtures for JS rendering-unit tests, not browser screenshots."""
import json,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from fastapi.testclient import TestClient
from app.server import create_app
from app.cli import demonstration_packet
from app.core import utcnow,iso
from datetime import timedelta

def main():
 with tempfile.TemporaryDirectory() as td:
  app=create_app(Path(td)/'fixture.sqlite3',admin_token='fixture-admin-token')
  s=app.state.store;s.set_phase('assistance');a=TestClient(app)
  H={'X-Ltp-Client':'local-demo','Idempotency-Key':'renderer-fixture-001'}
  a.get('/api/config')
  co=a.post('/api/requests',headers=H,json={'name':'青禾精密制造（虚构）','region':'示例地区','needs':['company'],'public':True,'consent':True,'synthetic':True}).json();cid=co['company_id']
  company=a.get('/api/companies/'+cid).json()
  s.prepare(cid,co['batch_day'],demonstration_packet(company,utcnow()))
  s.release(utcnow()+timedelta(days=2))
  post=a.post('/api/companies/'+cid+'/posts',headers=H,json={'title':'周末真实休息安排','body':'测试文本 <script>alert(1)</script> 应作为文字展示','tone':'negative','urgent':True}).json();pid=post['id']
  a.post('/api/posts/'+pid+'/comments',headers=H,json={'body':'这是一条正常补充'})
  k=a.post('/api/companies/'+cid+'/cases',headers=H,json={'title':'测试工资核对','facts':'只向本人展示的事实','goal':'希望整理材料'}).json();kid=k['id']
  endpoints=['/config','/account','/companies','/companies/'+cid,'/companies/'+cid+'/posts','/companies/'+cid+'/conditions','/companies/'+cid+'/responses','/companies/'+cid+'/public-summaries','/posts/'+pid,'/cases/'+kid,'/cases','/dashboard','/feed','/rankings','/admin']
  fixtures={}
  for path in endpoints:
   r=a.get('/api'+path,headers={'Authorization':'Bearer fixture-admin-token'})
   assert r.status_code==200,(path,r.text)
   fixtures[path]=r.json()
  fixtures['_ids']={'cid':cid,'pid':pid,'kid':kid}
  Path(sys.argv[1]).write_text(json.dumps(fixtures,ensure_ascii=False,indent=2))
  a.close()
if __name__=='__main__':main()
