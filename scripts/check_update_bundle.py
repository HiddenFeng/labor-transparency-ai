"""Verify update safety only in temporary extracted test directories; never the user's Mac."""
import argparse,hashlib,json,sqlite3,subprocess,sys,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def snapshot(root):
    return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}

def verify(archives):
    checks=[]
    def check(name,ok):
        if not ok:raise AssertionError(name)
        checks.append({'name':name,'status':'PASS'})
    for version,archive,prefix in archives:
        with tempfile.TemporaryDirectory(prefix='ltp-update-check-') as tmp:
            base=Path(tmp)
            with zipfile.ZipFile(archive) as z:
                for member in z.infolist():
                    if member.is_dir():continue
                    out=base/member.filename
                    if not out.resolve().is_relative_to(base.resolve()):raise ValueError('Unsafe archive path')
                    if (member.external_attr>>16)&0o170000==0o120000:raise ValueError('Symlink archive entry')
                    out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(z.read(member))
            target=base/prefix
            def run(*extra):
                return subprocess.run([sys.executable,str(ROOT/'scripts/apply_to_local.py'),str(target),'--from-version',version,*extra],text=True,capture_output=True,timeout=30)
            before=snapshot(target);r=run()
            check(version+' dry-run succeeds',r.returncode==0)
            check(version+' dry-run leaves all files unchanged',before==snapshot(target))
            old=(target/'README.md').read_bytes();(target/'README.md').write_bytes(old+b'\nLOCAL CHANGE\n');changed=snapshot(target);r=run('--apply','--service-stopped')
            check(version+' local conflict is rejected',r.returncode==2 and 'README.md' in r.stdout)
            check(version+' conflict leaves all files unchanged',changed==snapshot(target))
            (target/'README.md').write_bytes(old);before=snapshot(target);r=run('--apply')
            check(version+' running-service uncertainty blocks apply',r.returncode!=0 and before==snapshot(target))
            data=target/'local-data';data.mkdir(exist_ok=True)
            db=data/'upgrade-check.sqlite3';key=data/'upgrade-check.evidence.key'
            c=sqlite3.connect(db);c.execute('CREATE TABLE sentinel (value TEXT)');c.execute('INSERT INTO sentinel VALUES (?)',('SYNTHETIC_PRESERVE_ME',));c.commit();c.close();key.write_bytes(b'SYNTHETIC_TEST_KEY_NOT_A_REAL_SECRET')
            originals={db.name:db.read_bytes(),key.name:key.read_bytes()}
            r=run('--apply','--service-stopped');check(version+' apply succeeds',r.returncode==0)
            check(version+' original runtime files preserved',all((data/n).read_bytes()==b for n,b in originals.items()))
            backup=next((target/'.ltp-backups').iterdir())
            c=sqlite3.connect(backup/'local-data'/db.name);value=c.execute('SELECT value FROM sentinel').fetchone()[0];c.close()
            check(version+' database consistent backup',value=='SYNTHETIC_PRESERVE_ME')
            check(version+' key separate backup',(backup/'local-data'/key.name).read_bytes()==originals[key.name])
            manifest=json.loads((ROOT/'qa/v0_6/update_manifest.json').read_text())['files']
            check(version+' every updated source hash matches',all(hashlib.sha256((target/rel).read_bytes()).hexdigest()==v['new_sha256'] for rel,v in manifest.items()))
            check(version+' manifest copied without circular hash',(target/'qa/v0_6/update_manifest.json').read_bytes()==(ROOT/'qa/v0_6/update_manifest.json').read_bytes())
            before=snapshot(target);r=run('--apply','--service-stopped')
            check(version+' repeat apply is idempotent',r.returncode==0 and before==snapshot(target))
    return {'scope':'TEMPORARY_EXTRACTED_BASELINES_ONLY','passed':len(checks),'checks':checks,'mac_updated':False}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--v02-zip',required=True);p.add_argument('--v03-zip',required=True);p.add_argument('--v04-zip',required=True);p.add_argument('--v05-zip',required=True);p.add_argument('--out');a=p.parse_args()
    result=verify([('v0.2',a.v02_zip,'labor_transparency_v0_2'),('v0.3',a.v03_zip,'labor_transparency_v0_3'),('v0.4',a.v04_zip,'labor_transparency_v0_4'),('v0.5',a.v05_zip,'labor_transparency_v0_5')])
    text=json.dumps(result,ensure_ascii=False,indent=2)
    if a.out:Path(a.out).write_text(text)
    print(text)
