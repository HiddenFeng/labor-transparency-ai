# -*- coding: utf-8 -*-
"""Build the source-only v0.8.1 RC2 public-deployment + EdgeOne follow-up candidate."""
from __future__ import annotations
import argparse, hashlib, json, zipfile
from pathlib import Path
from release_files import release_files
ROOT=Path(__file__).resolve().parents[1]
PREFIX=Path('labor-transparency-v0.8.1-deployment-rc2')


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',default='/tmp/labor-transparency-v0.8.1-deployment-rc2.zip');args=ap.parse_args()
    out=Path(args.out).expanduser().resolve();out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists():out.unlink()
    files=release_files(ROOT)
    manifest={
        'version':'0.8.1-rc.2',
        'purpose':'global public Vercel + Cloudflare deployment, bounded multi-source company research, and EdgeOne Mainland relay candidate',
        'status':'PUBLIC_GLOBAL_DEPLOYMENT_LIVE_MAINLAND_STABLE_DOMAIN_PENDING',
        'files':{}
    }
    for src in files:
        rel=src.relative_to(ROOT);manifest['files'][str(rel)]=hashlib.sha256(src.read_bytes()).hexdigest()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for src in files:z.write(src,PREFIX/src.relative_to(ROOT))
        z.writestr(str(PREFIX/'SOURCE_MANIFEST.json'),json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':manifest['status'],'path':str(out),'files':len(files),'zip_entries':len(files)+1,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()},ensure_ascii=False))

if __name__=='__main__':main()
