# -*- coding: utf-8 -*-
"""Build a source-only v0.8 independent-deployment release candidate."""
from __future__ import annotations
import argparse, hashlib, json, zipfile
from pathlib import Path
from release_files import release_files
ROOT=Path(__file__).resolve().parents[1]
PREFIX=Path('labor-transparency-v0.8.0-independent-rc1')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',default='/tmp/labor-transparency-v0.8.0-independent-rc1.zip');args=ap.parse_args()
    out=Path(args.out).expanduser().resolve();out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists():out.unlink()
    files=release_files(ROOT)
    manifest={'version':'0.8.0-rc.1','purpose':'independent frontend + Cloudflare Worker/D1 deployment candidate','status':'NOT_PUBLICLY_DEPLOYED','files':{}}
    for src in files:
        rel=src.relative_to(ROOT);manifest['files'][str(rel)]=hashlib.sha256(src.read_bytes()).hexdigest()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for src in files:z.write(src,PREFIX/src.relative_to(ROOT))
        z.writestr(str(PREFIX/'SOURCE_MANIFEST.json'),json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':'PACKAGED_NOT_PUBLICLY_DEPLOYED','path':str(out),'files':len(files),'zip_entries':len(files)+1,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()},ensure_ascii=False))
if __name__=='__main__':main()
