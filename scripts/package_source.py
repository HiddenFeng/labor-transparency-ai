"""Package a clean GitHub source candidate. Never creates a repository or pushes."""
import argparse,hashlib,json,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'scripts'))
from release_files import release_files
from app.publication import validate_dataset

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',required=True);a=p.parse_args();out=Path(a.out)
    if out.exists():raise SystemExit('候选包已存在，请使用新文件名避免覆盖')
    validate_dataset(json.loads((ROOT/'public-site/data/dataset.json').read_text()))
    files=release_files(ROOT);manifest={str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
    forbidden=[name for name in manifest if name.startswith(('local-data/','private/','uploads/'))]
    if forbidden:raise SystemExit('拒绝包含运行数据')
    out.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for file in files:z.write(file,'labor-transparency-v0.6/'+str(file.relative_to(ROOT)))
        z.writestr('labor-transparency-v0.6/SOURCE_MANIFEST.json',json.dumps({'status':'CANDIDATE_NOT_PUBLISHED','files':manifest},ensure_ascii=False,indent=2))
    print(json.dumps({'status':'PACKAGED_NOT_PUSHED','file':str(out),'source_files':len(files),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()},ensure_ascii=False))
if __name__=='__main__':main()
