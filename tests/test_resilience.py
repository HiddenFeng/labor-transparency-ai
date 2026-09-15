import tempfile,unittest,base64
from pathlib import Path
from fastapi.testclient import TestClient
from app.server import create_app

class ResilienceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'x.sqlite3';self.app=create_app(self.path);self.app.state.store.set_phase('assistance');self.client=TestClient(self.app);self.client.get('/api/config');self.h={'X-Ltp-Client':'local-demo','Idempotency-Key':'resilience-test-01'}
  self.cid=self.client.post('/api/requests',headers=self.h,json={'name':'恢复测试公司（虚构）','region':'示例地区','needs':['company'],'public':True,'consent':True,'synthetic':True}).json()['company_id']
 def tearDown(self):self.client.close();self.tmp.cleanup()
 def test_follow_state_survives_reload_and_can_be_removed(self):
  route='/api/companies/'+self.cid
  self.client.post(route+'/follow',json={'active':True},headers=self.h)
  self.assertTrue(self.client.get(route).json()['following'])
  self.client.post(route+'/follow',json={'active':False},headers=self.h)
  self.assertFalse(self.client.get(route).json()['following'])
 def test_missing_key_never_silently_replaced(self):
  kid=self.client.post('/api/companies/'+self.cid+'/cases',headers=self.h,json={'title':'测试事项','facts':'私密测试内容','goal':'材料整理'}).json()['id']
  response=self.client.post('/api/cases/'+kid+'/evidence',headers=self.h,json={'filename':'note.txt','claim':'用于测试密钥恢复','content_b64':base64.b64encode(b'private fixture').decode()})
  eid=response.json()['id'];key=self.path.with_suffix('.evidence.key');original=key.read_bytes();key.unlink()
  response=self.client.get('/api/evidence/'+eid+'/download')
  self.assertEqual(response.status_code,400);self.assertFalse(key.exists())
  key.write_bytes(original)
  self.assertEqual(self.client.get('/api/evidence/'+eid+'/download').content,b'private fixture')
 def test_deleted_author_does_not_leave_private_text_in_database(self):
  pid=self.client.post('/api/companies/'+self.cid+'/posts',headers=self.h,json={'title':'撤回测试内容','body':'正文将被删除XYZ'}).json()['id']
  self.client.post('/api/account/delete',headers=self.h,json={'confirm':True})
  with self.app.state.store.db() as c:row=c.execute('SELECT title,body,hidden FROM posts WHERE id=?',(pid,)).fetchone()
  self.assertEqual(row['body'],'');self.assertTrue(row['hidden'])
if __name__=='__main__':unittest.main()
