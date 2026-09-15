"""Build a conflict-check inventory against the actual prior release archives."""
import argparse,hashlib,json,zipfile
from pathlib import Path
from release_files import release_files
ROOT=Path(__file__).resolve().parents[1]

def build(v02,v03,v04,v05):
    archives={'v0.2':(v02,'labor_transparency_v0_2/'),'v0.3':(v03,'labor_transparency_v0_3/'),'v0.4':(v04,'labor_transparency_v0_4/'),'v0.5':(v05,'labor_transparency_v0_5/')}
    baselines={}
    for version,(path,prefix) in archives.items():
        with zipfile.ZipFile(path) as z:
            baselines[version]={n[len(prefix):]:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith(prefix) and not n.endswith('/')}
        if 'app/server.py' not in baselines[version]:raise ValueError('未识别的基线结构：'+version)
    files={}
    for path in release_files(ROOT):
        rel=str(path.relative_to(ROOT))
        if rel=='qa/v0_6/update_manifest.json':continue
        files[rel]={'new_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'base_sha256':{v:b.get(rel) for v,b in baselines.items()}}
    output=ROOT/'qa/v0_6/update_manifest.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({'version':'0.6','status':'HASH_CHECKS_NOT_A_SIGNATURE','files':files},ensure_ascii=False,indent=2))
    return len(files)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--v02-zip',required=True);p.add_argument('--v03-zip',required=True);p.add_argument('--v04-zip',required=True);p.add_argument('--v05-zip',required=True);a=p.parse_args()
    print(json.dumps({'files':build(a.v02_zip,a.v03_zip,a.v04_zip,a.v05_zip)},ensure_ascii=False))
