"""Offline public-data packaging; does not upload, fetch or open a database."""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.publication import write_snapshot

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',required=True,help='经授权从/api/public-data下载的JSON')
    p.add_argument('--previous',help='可选：上一个安全快照dataset.json，仅用于变更ID对照')
    p.add_argument('--out',required=True,help='新的空输出目录')
    a=p.parse_args()
    for path in [a.input,a.previous]:
        if path and Path(path).stat().st_size>20_000_000:raise SystemExit('输入超过20MB，本版本需先分批处理')
    data=json.loads(Path(a.input).read_text())
    prev=json.loads(Path(a.previous).read_text()) if a.previous else None
    print(json.dumps(write_snapshot(data,a.out,prev),ensure_ascii=False))
if __name__=='__main__':main()
