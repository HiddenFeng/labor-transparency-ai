"""Synthetic end-to-end HTTP test. Starts and stops its own loopback service.
No browser, external submission, hosting, scheduler, or real user input.
"""
import argparse,os,json,socket,subprocess,sys,tempfile,time
from pathlib import Path
import httpx
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from app.publication import validate_dataset,write_snapshot

def main():
 p=argparse.ArgumentParser();p.add_argument('--out',default='qa/v0_4/http-tests.json');a=p.parse_args()
 result={'status':'RUNNING','scope':'real loopback HTTP with synthetic records, not browser interaction','checks':[]}
 def check(name,condition):
  result['checks'].append({'name':name,'passed':bool(condition)})
  if not condition:raise AssertionError(name)
 with tempfile.TemporaryDirectory(prefix='ltp-http-') as td:
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  token='synthetic-bounded-test-admin';env=dict(os.environ,LTP_DB=str(Path(td)/'data.sqlite3'),LTP_ADMIN_TOKEN=token)
  command=f"from app.server import app;import uvicorn;app.state.store.set_phase('assistance');uvicorn.run(app,host='127.0.0.1',port={port},access_log=False)"
  with (Path(td)/'server.log').open('w') as log:
   server=subprocess.Popen([sys.executable,'-c',command],cwd=ROOT,env=env,stdout=log,stderr=log)
   clients=[httpx.Client(base_url=f'http://127.0.0.1:{port}',headers={'X-Ltp-Client':'local-demo'},timeout=10) for _ in range(4)]
   author,reviewer,privacy,stranger=clients
   def get(path,c=author):
    r=c.get('/api'+path);check('GET '+path,r.status_code==200);return r.json()
   def post(path,data,c=author,admin=False):
    r=c.post('/api'+path,json=data,headers={'Authorization':'Bearer '+token} if admin else {});check('POST '+path,r.status_code==200);return r.json()
   try:
    for _ in range(100):
     if server.poll() is not None:raise RuntimeError('test server failed to start')
     try:author.get('/api/config');break
     except httpx.ConnectError:time.sleep(.1)
    for c in clients:get('/config',c)
    for c,name in [(reviewer,'合成事实核验'),(privacy,'合成安全复核')]:
     post('/account/signup',{'username':name,'password':'Isolated-synthetic-test-password'},c)
     post('/admin/reviewers',{'username':name,'active':True},admin=True)
    r=author.post('/api/requests',headers={'Idempotency-Key':'bounded-http-company'},json={'name':'仅测试的虚构公司','region':'虚构地区','needs':['company'],'public':True,'consent':True,'synthetic':True})
    check('register company over HTTP',r.status_code==200);cid=r.json()['company_id']
    data={'company_id':cid,'kind':'product','title':'虚构折叠工作台','description':'这是一条没有来源的产品线索。','public':True,'consent':True,'rights':'reference_only','sources':[]}
    pid=post('/contributions',data)['id'];check('E0 is public',get('/contributions/'+pid,stranger)['evidence']=='E0')
    post('/companies/'+cid+'/ballot',{'direction':'positive'})
    showcase=get('/showcase');check('product attached without evidence gate',showcase['items'][0]['products'][0]['id']==pid)
    heat=showcase['items'][0]['participants']
    data.update(kind='labour_claim',title='虚构厂区休息实践',description='仅用于测试的特定厂区期间内正向实践。',dimension='rest',direction='positive',scope='虚构一号厂区',period_start='2026-01-01',period_end='2099-12-31',rights='own_summary',share_consent=True,sources=[{'url':'https://example.org/synthetic','title':'虚构公开资料','type':'company_disclosure','supports':'仅用于测试，未进行真实来源核验'}])
    rid=post('/contributions',data)['id']
    review={'version':1,'decision':'approve','evidence':'E3','rationale':'本记录仅验证软件流程，不代表真实事实核验。','checks':{'scope_checked':True,'authenticity_checked':True,'source_ids':['S1']}}
    check('unprivileged review denied',author.post('/api/contributions/'+rid+'/review',json=review).status_code==403)
    post('/contributions/'+rid+'/review',review,reviewer)
    check('high evidence specific positive practice',len(get('/showcase?lane=evidence_positive')['items'])==1)
    check('same heat after grade update',get('/showcase')['items'][0]['participants']==heat)
    check('proof alone does not grant export',get('/public-data')['record_count']==0)
    approval={'version':1,'privacy_checked':True,'rights_checked':True,'reason':'合成数据的独立隐私与版权流程验收。'}
    check('same reviewer cannot export approve',reviewer.post('/api/contributions/'+rid+'/approve-export',json=approval).status_code==403)
    post('/contributions/'+rid+'/approve-export',approval,privacy)
    dataset=get('/public-data');validate_dataset(dataset);check('safe dataset count',dataset['record_count']==1)
    artifact=write_snapshot(dataset,Path(td)/'safe');check('categorized export files',artifact['files']==15)
    private=dict(data,title='私密测试内容',public=False,share_consent=False)
    priv=post('/contributions',private)['id'];check('private record invisible',stranger.get('/api/contributions/'+priv).status_code==404)
    check('private not in export','私密测试内容' not in json.dumps(get('/public-data'),ensure_ascii=False))
    post('/contributions/'+rid+'/withdraw',{})
    check('withdraw excludes next snapshot',get('/public-data')['record_count']==0)
    post('/admin/phase',{'phase':'plan'},admin=True)
    check('server-side showcase phase gate',author.get('/api/showcase').status_code==403)
    check('existing private record available',get('/contributions/'+priv)['is_mine'])
    post('/contributions',dict(private,title='阶段关闭仍可登记资料'))
    check('static UI script served',author.get('/assets/community.js').status_code==200)
    check('license served',author.get('/assets/public-interest-license.txt').status_code==200)
    result['status']='PASSED'
   except Exception as exc:result.update(status='FAILED',error=str(exc))
   finally:
    for c in clients:c.close()
    server.terminate()
    try:server.wait(timeout=5)
    except subprocess.TimeoutExpired:server.kill();server.wait()
 Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(json.dumps({'status':result['status'],'passed':sum(x['passed'] for x in result['checks']),'error':result.get('error')},ensure_ascii=False))
 if result['status']!='PASSED':raise SystemExit(1)
if __name__=='__main__':main()
