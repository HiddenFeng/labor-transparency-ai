"""Live loopback HTTP smoke test. Synthetic data only; not a browser interaction test."""
import argparse,base64,json,sys,uuid
from pathlib import Path
import httpx

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--base',default='http://127.0.0.1:8765');parser.add_argument('--admin-token',required=True);parser.add_argument('--out',required=True);args=parser.parse_args()
 if not args.base.startswith(('http://127.0.0.1:','http://localhost:')):raise SystemExit('只允许本地回环测试')
 checks=[]
 with httpx.Client(base_url=args.base,timeout=10,headers={'X-Ltp-Client':'local-demo'}) as a, httpx.Client(base_url=args.base,timeout=10,headers={'X-Ltp-Client':'local-demo'}) as b:
  def check(name,condition):
   checks.append({'name':name,'passed':bool(condition)})
   if not condition:raise AssertionError(name)
  def post(path,data):
   r=a.post('/api'+path,json=data);check('HTTP '+path,r.status_code==200);return r
  a.get('/api/config');b.get('/api/config')
  r=a.post('/api/admin/phase',json={'phase':'assistance'},headers={'Authorization':'Bearer '+args.admin_token});check('operator phase change',r.status_code==200)
  r=a.get('/');check('homepage served',r.status_code==200 and '劳动透明计划' in r.text)
  for asset in ['app.js','styles.css','workers.jpg','whitepaper.html']:check('asset '+asset,a.get('/assets/'+asset).status_code==200)
  r=a.post('/api/requests',headers={'Idempotency-Key':str(uuid.uuid4())},json={'name':'HTTP连续链路测试（虚构）','region':'示例地区','public':True,'synthetic':True,'consent':True,'needs':['company','discussion','help']})
  check('company registration',r.status_code==200);cid=r.json()['company_id']
  check('space exists without research',a.get('/api/companies/'+cid).json()['snapshots']==[])
  pid=post('/companies/'+cid+'/posts',{'title':'没有附件也能分享','body':'这是网络接口联调中的虚构工作经历','tone':'negative'}).json()['id']
  post('/posts/'+pid+'/comments',{'body':'来自本地联调的补充回复'})
  post('/posts/'+pid+'/vote',{})
  post('/companies/'+cid+'/ballot',{'direction':'negative'})
  check('forum detail joined',len(a.get('/api/posts/'+pid).json()['replies'])==1)
  kid=post('/companies/'+cid+'/cases',{'title':'私密工资核对示例','facts':'private-smoke-only-secret','goal':'整理材料'}).json()['id']
  check('private case protected',b.get('/api/cases/'+kid).status_code==404)
  eid=post('/cases/'+kid+'/evidence',{'filename':'test.txt','claim':'这是一份测试材料','content_b64':base64.b64encode(b'synthetic evidence').decode()}).json()['id']
  check('private attachment roundtrip',a.get('/api/evidence/'+eid+'/download').content==b'synthetic evidence')
  check('private attachment protected',b.get('/api/evidence/'+eid+'/download').status_code==404)
  check('case zip export',a.get('/api/cases/'+kid+'/export').headers.get('content-type')=='application/zip')
  post('/cases/'+kid+'/public-summary',{'summary':'我自愿公开这一段测试摘要。','consent':True})
  public=b.get('/api/companies/'+cid+'/public-summaries').text
  check('only explicit summary public','测试摘要' in public and 'private-smoke-only-secret' not in public)
  post('/cases/'+kid+'/revoke-summary',{})
  check('summary withdrawn',b.get('/api/companies/'+cid+'/public-summaries').json()==[])
  r=a.post('/api/admin/phase',json={'phase':'plan'},headers={'Authorization':'Bearer '+args.admin_token});check('stage closed',r.status_code==200)
  check('direct forum API blocked',a.get('/api/feed').status_code==403)
  check('private export survives closure',a.get('/api/cases/'+kid+'/material').status_code==200)
 Path(args.out).write_text(json.dumps({'scope':'LIVE_LOOPBACK_HTTP_NOT_BROWSER','checks':checks,'passed':sum(x['passed'] for x in checks)},ensure_ascii=False,indent=2))
 print(json.dumps({'passed':len(checks),'scope':'loopback HTTP only'}))
if __name__=='__main__':main()
