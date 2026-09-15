"""Real loopback HTTP workflow with injected, labelled provider fixtures.
This proves local API integration only, NOT remote GLEIF connectivity or browser UI.
"""
import argparse,json,os,socket,subprocess,sys,tempfile,time
from pathlib import Path
from datetime import timedelta
ROOT=Path(__file__).resolve().parents[1];sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
import httpx
from test_research import factory,LEI,CHECKS
from app.core import iso,utcnow
from app.research import Store

def main():
 p=argparse.ArgumentParser();p.add_argument('--out',default='qa/v0_5/research-http.json');a=p.parse_args();checks=[]
 def check(name,condition):
  checks.append({'name':name,'passed':bool(condition)})
  if not condition:raise AssertionError(name)
 with tempfile.TemporaryDirectory(prefix='ltp-research-http-') as td:
  db=Path(td)/'test.sqlite3';key='temporary-http-fixture-not-a-production-credential'
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  code="import sys;sys.path.insert(0,'tests');from test_research import factory;from app.server import create_app;import uvicorn;uvicorn.run(create_app(sys.argv[1],admin_token=sys.argv[2],public_research=True,research_network=True,research_client_factory=factory),host='127.0.0.1',port=int(sys.argv[3]),access_log=False,log_level='error')"
  proc=subprocess.Popen([sys.executable,'-c',code,str(db),key,str(port)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  try:
   url=f'http://127.0.0.1:{port}'
   for _ in range(70):
    try:
     with socket.create_connection(('127.0.0.1',port),timeout=.2):break
    except OSError:time.sleep(.1)
   with httpx.Client(base_url=url,timeout=15) as client:
    h={'x-ltp-client':'local-demo'};admin=dict(h,authorization='Bearer '+key)
    conf=client.get('/api/config').json();check('app version',conf['version']=='0.6');check('scheduler not claimed',not conf['scheduler_installed'])
    check('research page script served',client.get('/assets/research.js').status_code==200)
    check('private admin queue',client.get('/api/admin/research').status_code==403)
    payload={'name':'Alpha Fixture Ltd','region':'GB','registry_id':'LEI:'+LEI,'public':True,'synthetic':False,'consent':True,'needs':['company','help']}
    response=client.post('/api/requests',json=payload,headers=dict(h,**{'idempotency-key':'research-http-request'}));check('register',response.status_code==200)
    rec=response.json();cid=rec['company_id'];check('immediate pending receipt',rec['status']=='RESEARCH_PENDING')
    co=client.get('/api/companies/'+cid).json();check('empty space available',co['snapshots']==[]);check('progress visible',co['research_progress']['state']=='QUEUED');check('requester needs absent','needs' not in co)
    check('explicit query consent',client.post('/api/admin/research/run',json={'allow_network':False},headers=admin).status_code==403)
    result=client.post('/api/admin/research/run',json={'allow_network':True,'include_current':True},headers=admin)
    check('query accepted',result.status_code==200);check('draft not publication',result.json()['runs'][0]['state']=='DRAFT_READY');check('test transport labelled',result.json()['runs'][0]['mode']=='INJECTED_TEST_TRANSPORT')
    task=client.get('/api/admin/research',headers=admin).json()['tasks'][0];run=task['run']
    co=client.get('/api/companies/'+cid).json();check('draft not public',co['snapshots']==[])
    check('arbitrary prepared real package denied',client.post('/api/admin/prepare',json={'company_id':cid,'batch_day':rec['batch_day'],'packet':run['packet']},headers=admin).status_code==400)
    body={'expected_hash':'0'*64,'reason':'HTTP核对合成来源的支持范围','checks':CHECKS}
    check('stale revision denied',client.post('/api/admin/research/runs/'+run['id']+'/approve',json=body,headers=admin).status_code==400)
    body['expected_hash']=run['packet_hash'];check('review frozen draft',client.post('/api/admin/research/runs/'+run['id']+'/approve',json=body,headers=admin).status_code==200)
    early=client.post('/api/admin/release',json={},headers=admin);check('no early release',early.json()['released']==[])
    # Advance only this test database deadline. No clock spoof in production API.
    store=Store(db)
    with store.db() as c:c.execute('UPDATE jobs SET due_at=? WHERE company_id=?',(iso(utcnow()-timedelta(seconds=1)),cid))
    pub=client.post('/api/admin/release',json={},headers=admin).json();check('due publication',len(pub['released'])==1)
    co=client.get('/api/companies/'+cid).json();packet=co['snapshots'][0]['packet']
    check('identity visible',len(packet['sections']['identity']['items'])==6)
    check('products not invented',not packet['sections']['business']['items'])
    check('upstream CC0 retained',packet['sources'][0]['reuse_status']=='CC0-1.0')
    check('source fingerprint',len(packet['sources'][0]['content_sha256'])==64)
    check('no raw addresses', 'NOT_PROJECTED_PRIVATE_LINE' not in json.dumps(co))
    check('idempotent release',client.post('/api/admin/release',json={},headers=admin).json()['released']==[])
    check('phase can be independently opened',client.post('/api/admin/phase',json={'phase':'community'},headers=admin).status_code==200)
    post=client.post('/api/companies/'+cid+'/posts',json={'title':'测试的E0经历','body':'此内容为合成测试，不是关于真实企业的指控。'},headers=h)
    check('E0 stays independent',post.status_code==200 and post.json()['evidence']=='E0')
  finally:
   proc.terminate()
   try:proc.wait(timeout=5)
   except subprocess.TimeoutExpired:proc.kill();proc.wait()
 out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
 result={'status':'PASS','passed':len(checks),'checks':checks,'provider':'MOCK_TRANSPORT','http':'REAL_LOOPBACK',
  'clock':'test-only due_at advanced in isolated database','live_source_verified':False,'process_stopped':True}
 out.write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
