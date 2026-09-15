# -*- coding: utf-8 -*-
"""Build a self-contained ChatGPT Sites v0.7 handoff zip from explicit allowlists."""
from __future__ import annotations
import argparse, hashlib, json, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITES = ROOT / 'sites-app'
EXCLUDE_PARTS = {'.local', 'dist', 'node_modules', '__pycache__'}
EXCLUDE_EXT = {'.zip', '.pyc', '.db', '.sqlite', '.sqlite3', '.key', '.pem', '.p12', '.pfx'}
EXTRA = [
    ROOT/'LICENSE', ROOT/'LICENSE-DATA.md', ROOT/'AGENTS.md',
    ROOT/'agents'/'PROJECT_MANAGER_AGENT.md', ROOT/'agents'/'SOCIAL_ANNOUNCEMENT_AGENT.md',
    ROOT/'docs'/'v0_7'/'SITES交互版设计与边界.md', ROOT/'docs'/'v0_7'/'交付与验收.md',
    ROOT/'qa'/'v0_7'/'verification.json', ROOT/'qa'/'v0_7'/'sites-browser.json',
]

def collect():
    files=[]
    for p in sorted(SITES.rglob('*')):
        rel=p.relative_to(SITES)
        if any(part in EXCLUDE_PARTS for part in rel.parts): continue
        if not p.is_file() or p.is_symlink(): continue
        if p.suffix.lower() in EXCLUDE_EXT or p.name.startswith('.env'): continue
        files.append((p, Path('sites-app')/rel))
    for p in EXTRA:
        if p.is_file(): files.append((p,p.relative_to(ROOT)))
    return files

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/labor-transparency-v0.7.0-sites-rc1.zip')
    args=ap.parse_args()
    out=Path(args.out).expanduser().resolve(); out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists(): out.unlink()
    files=collect(); manifest={'version':'0.7.0-rc.1','purpose':'ChatGPT Sites handoff candidate','files':{}}
    for src,rel in files:
        raw=src.read_bytes(); manifest['files'][str(rel)]=hashlib.sha256(raw).hexdigest()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for src,rel in files: z.write(src,Path('labor-transparency-v0.7-sites-rc1')/rel)
        z.writestr('labor-transparency-v0.7-sites-rc1/SITES_PACKAGE_MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    sha=hashlib.sha256(out.read_bytes()).hexdigest()
    print(json.dumps({'status':'PACKAGED_NOT_SITES_DEPLOYED','path':str(out),'files':len(files),'zip_entries':len(files)+1,'sha256':sha},ensure_ascii=False))

if __name__=='__main__': main()
