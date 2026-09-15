"""Hash-checked update of an existing v0.2, v0.3, v0.4 or v0.5 directory. Dry-run by default.
Never reads another project, starts an agent, commits Git, or overwrites a conflict.
"""
from __future__ import annotations
import argparse,hashlib,json,os,shutil,sqlite3,sys,tempfile,uuid
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def destination(root,rel):
 p=root/rel
 if Path(rel).is_absolute() or not p.resolve().is_relative_to(root):raise ValueError('非法目标路径：'+rel)
 current=p
 while current!=root:
  if current.is_symlink():raise ValueError('拒绝通过符号链接更新：'+rel)
  current=current.parent
 return p

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('target',nargs='?',default=str(Path.home()/'Downloads'/'labor_transparency_v0_5'))
 parser.add_argument('--from-version',choices=['v0.2','v0.3','v0.4','v0.5'],default='v0.5')
 parser.add_argument('--apply',action='store_true');parser.add_argument('--service-stopped',action='store_true')
 args=parser.parse_args();target=Path(args.target).expanduser().resolve()
 if not target.is_dir():raise SystemExit('目标目录不存在；没有创建或写入任何本地项目。')
 if target==ROOT:raise SystemExit('来源与目标为同一目录；请从独立新版包执行预检。')
 manifest_path=ROOT/'qa/v0_6/update_manifest.json'
 manifest=json.loads(manifest_path.read_text())['files']
 # The inventory excludes itself to avoid a circular hash; still copy it as a new file.
 manifest['qa/v0_6/update_manifest.json']={'new_sha256':sha(manifest_path),'base_sha256':{'v0.2':None,'v0.3':None,'v0.4':None,'v0.5':None}}
 changes=[];conflicts=[]
 for rel,entry in manifest.items():
  src=ROOT/rel;dest=destination(target,rel)
  if not src.is_file() or sha(src)!=entry['new_sha256']:raise SystemExit('新版包校验失败：'+rel)
  base=entry['base_sha256'].get(args.from_version)
  existing=sha(dest) if dest.is_file() else None
  if existing==entry['new_sha256']:continue
  if dest.exists() and not dest.is_file():conflicts.append(rel+'（不是普通文件）');continue
  if existing is not None and existing!=base:conflicts.append(rel+'（存在本地改动）');continue
  if base and existing is None:conflicts.append(rel+'（原文件已被移走，需人工核对）');continue
  changes.append((rel,src,dest,existing))
 result={'target':str(target),'mode':'APPLY' if args.apply else 'DRY_RUN','changed_files':len(changes),'conflicts':conflicts,'files':[x[0] for x in changes]}
 print(json.dumps(result,ensure_ascii=False,indent=2))
 if conflicts:raise SystemExit(2)
 if not args.apply:return
 if not args.service_stopped:raise SystemExit('实际应用前须停止旧服务，并显式提供 --service-stopped。')
 if os.getenv('LTP_DB') and not Path(os.environ['LTP_DB']).expanduser().resolve().is_relative_to(target):raise SystemExit('检测到外部自定义数据库，请先单独核对备份；本脚本没有代为备份外部路径。')
 if not changes:return
 backup=target/'.ltp-backups'/('before-v0_6-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6])
 backup.mkdir(parents=True,exist_ok=False)
 # Consistent SQLite backup, plus separate evidence keys. The old service must already be stopped.
 data=target/'local-data'
 if data.exists():
  (backup/'local-data').mkdir()
  for file in data.iterdir():
   if file.is_symlink():raise SystemExit('本地数据目录含符号链接，请人工核对后再更新。')
   if not file.is_file():continue
   if file.suffix in ('.sqlite3','.sqlite','.db'):
    a=sqlite3.connect(str(file));b=sqlite3.connect(str(backup/'local-data'/file.name))
    try:a.backup(b)
    finally:a.close();b.close()
   elif file.name.endswith('.evidence.key'):shutil.copy2(file,backup/'local-data'/file.name)
 for rel,src,dest,existing in changes:
  if existing is not None:
   out=backup/'files'/rel;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,out)
 written=[]
 try:
  for rel,src,dest,existing in changes:
   now=sha(dest) if dest.is_file() else None
   if now!=existing:raise RuntimeError('预检后文件发生变化：'+rel)
   dest.parent.mkdir(parents=True,exist_ok=True)
   fd,name=tempfile.mkstemp(prefix='.ltp-update-',dir=dest.parent)
   try:
    with os.fdopen(fd,'wb') as f:f.write(src.read_bytes())
    os.chmod(name,src.stat().st_mode&0o777);os.replace(name,dest)
   finally:
    if Path(name).exists():Path(name).unlink()
   written.append((rel,dest,existing))
 except Exception:
  for rel,dest,existing in reversed(written):
   if dest.is_file() and sha(dest)==manifest[rel]['new_sha256']:
    if existing is None:dest.unlink()
    else:shutil.copy2(backup/'files'/rel,dest)
  raise
 (backup/'application.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print('更新完成。备份：'+str(backup))
 print('尚未启动服务、迁移运行中的数据库或完成Mac验收。请按README运行测试。')
if __name__=='__main__':main()
