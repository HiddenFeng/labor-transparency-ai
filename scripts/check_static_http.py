"""Test the read-only public artifact server via actual local HTTP; no browser."""
import json,os,subprocess,sys,tempfile,socket,time,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    checks=[]
    def check(name,value):
        checks.append({'name':name,'passed':bool(value)})
        if not value:raise AssertionError(name)
    with tempfile.TemporaryDirectory() as td:
        out=Path(td)/'site';subprocess.run([sys.executable,str(ROOT/'scripts/build_public_site.py'),'--out',str(out)],cwd=ROOT,check=True,capture_output=True)
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        env=dict(os.environ,SITE_DIR=str(out),PORT=str(port),HOST='127.0.0.1')
        p=subprocess.Popen(['node',str(ROOT/'deploy/static_server.mjs')],env=env,stdout=subprocess.DEVNULL)
        base=f'http://127.0.0.1:{port}'
        def request(path,method='GET'):
            try:
                with urllib.request.urlopen(urllib.request.Request(base+path,method=method),timeout=3) as r:return r.status,r.read(),r.headers
            except urllib.error.HTTPError as e:return e.code,e.read(),e.headers
        try:
            for _ in range(50):
                try:request('/');break
                except OSError:time.sleep(.1)
            r=request('/');check('homepage served',r[0]==200 and '只读'.encode() in r[1]);check('security headers',r[2].get('X-Content-Type-Options')=='nosniff' and 'frame-ancestors' in r[2].get('Content-Security-Policy',''))
            check('CSS served',request('/styles.css')[0]==200);check('JS served',request('/site.js')[0]==200)
            check('full whitepaper',request('/whitepaper.html')[0]==200)
            check('zero real data default',json.loads(request('/data/dataset.json')[1])['record_count']==0)
            check('private database not accessible',request('/local-data/demo.sqlite3')[0]==404)
            check('mutation is unavailable',request('/api/contributions','POST')[0]==405)
            check('HEAD no body',request('/','HEAD')[1]==b'')
            check('private files not served',request('/LICENSE-DATA.md')[0]==200 and request('/.env')[0]==404)
            print(json.dumps({'status':'PASSED','passed':len(checks),'checks':checks,'scope':'read-only artifact via HTTP; not browser'},ensure_ascii=False,indent=2))
        finally:
            p.terminate()
            try:p.wait(timeout=5)
            except subprocess.TimeoutExpired:p.kill();p.wait()
if __name__=='__main__':main()
