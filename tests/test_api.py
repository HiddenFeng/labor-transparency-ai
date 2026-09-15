import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.server import create_app

class APITests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.app=create_app(Path(self.tmp.name)/'api.sqlite3')
        self.a=TestClient(self.app);self.b=TestClient(self.app)
        self.a.get('/api/config');self.b.get('/api/config')
        self.headers={'x-ltp-client':'local-demo','idempotency-key':'test-request-001'}
        self.data={'name':'API验证公司（虚构）','region':'示例地区','needs':['help'],
                   'consent':True,'public':False,'synthetic':True}
    def tearDown(self):self.a.close();self.b.close();self.tmp.cleanup()
    def test_session_isolation(self):
        r=self.a.post('/api/requests',json=self.data,headers=self.headers)
        self.assertEqual(r.status_code,200,r.text)
        cid=r.json()['company_id']
        self.assertEqual(self.b.get('/api/companies/'+cid).status_code,404)
        self.assertEqual(self.b.get('/api/me').json()['requests'],[])
        self.assertEqual(len(self.a.get('/api/me').json()['requests']),1)
    def test_no_arbitrary_origin(self):
        h=dict(self.headers,origin='https://unrelated.invalid')
        self.assertEqual(self.a.post('/api/requests',json=self.data,headers=h).status_code,403)
    def test_client_marker_required(self):
        self.assertEqual(self.a.post('/api/requests',json=self.data).status_code,403)
    def test_no_public_remote_host(self):
        self.assertEqual(self.a.get('/api/config',headers={'host':'public.invalid'}).status_code,403)
    def test_demo_does_not_take_real_mode(self):
        self.assertEqual(self.a.post('/api/requests',json=dict(self.data,synthetic=False),headers=self.headers).status_code,400)
    def test_no_unlisted_field(self):
        self.assertEqual(self.a.post('/api/requests',json=dict(self.data,identity_card='unwanted'),headers=self.headers).status_code,422)
    def test_error_no_private_body(self):
        r=self.a.post('/api/requests',json=dict(self.data,website='not-url'),headers=self.headers)
        self.assertEqual(r.status_code,400)
        self.assertNotIn('API验证公司',r.text)
    def test_no_background_research_claim(self):
        r=self.a.get('/api/config').json()
        self.assertFalse(r['network_research']);self.assertFalse(r['scheduler_installed'])
    def test_landing_page_served(self):
        r=self.a.get('/')
        self.assertEqual(r.status_code,200)
        self.assertIn('劳动透明计划',r.text)

if __name__=='__main__':unittest.main()
