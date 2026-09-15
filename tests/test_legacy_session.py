import tempfile,unittest,secrets
from pathlib import Path
from fastapi.testclient import TestClient
from app.core import Store as OldStore
from app.server import create_app

class LegacySessionTests(unittest.TestCase):
 def test_existing_v02_cookie_restores_and_rotates_records(self):
  with tempfile.TemporaryDirectory() as td:
   path=Path(td)/'old.sqlite3';old=OldStore(path);token=secrets.token_urlsafe(32)
   r=old.register(token,{'name':'旧版私密公司（虚构）','region':'示例','needs':['help'],'public':False,'consent':True,'synthetic':True},'old-cookie-001')
   app=create_app(path)
   with TestClient(app) as a:
    a.cookies.set('ltp_demo_session',token)
    response=a.get('/api/companies/'+r['company_id']);self.assertEqual(response.status_code,200)
    self.assertIn('ltp_demo_session=',response.headers['set-cookie']);self.assertNotIn(token,response.headers['set-cookie'])
   with TestClient(app) as b:
    b.cookies.set('ltp_demo_session',token)
    self.assertEqual(b.get('/api/companies/'+r['company_id']).status_code,404)
 def test_fresh_unknown_cookie_not_treated_as_legacy(self):
  with tempfile.TemporaryDirectory() as td:
   with TestClient(create_app(Path(td)/'new.sqlite3')) as a:
    token=secrets.token_urlsafe(32);a.cookies.set('ltp_demo_session',token)
    response=a.get('/api/config');self.assertNotIn(token,response.headers['set-cookie'])
if __name__=='__main__':unittest.main()
