"""Refresh v0.6 new-file hashes while preserving previously verified baseline hashes.

Use this only after the original v0.2-v0.5 baseline manifest has already been built
from release archives. New files receive a None baseline for every prior version.
"""
import hashlib
import json
from pathlib import Path
from release_files import release_files

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'qa' / 'v0_6' / 'update_manifest.json'
VERSIONS = ('v0.2', 'v0.3', 'v0.4', 'v0.5')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def refresh():
    current = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if current.get('version') != '0.6' or current.get('status') != 'HASH_CHECKS_NOT_A_SIGNATURE':
        raise ValueError('现有升级清单不是已识别的v0.6基线清单')
    old = current.get('files') or {}
    files = {}
    for path in release_files(ROOT):
        rel = str(path.relative_to(ROOT))
        if rel == 'qa/v0_6/update_manifest.json':
            continue
        previous = old.get(rel, {}).get('base_sha256')
        if previous is None:
            previous = {v: None for v in VERSIONS}
        if set(previous) != set(VERSIONS):
            raise ValueError('基线版本集合异常：' + rel)
        files[rel] = {'new_sha256': sha(path), 'base_sha256': {v: previous[v] for v in VERSIONS}}
    next_manifest = {
        'version': '0.6',
        'status': 'HASH_CHECKS_NOT_A_SIGNATURE',
        'base_hashes_source': 'preserved_from_previous_archive_verified_manifest',
        'files': files,
    }
    tmp = MANIFEST.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(next_manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(MANIFEST)
    return {'files': len(files), 'added_since_previous': sorted(set(files) - set(old)), 'removed_since_previous': sorted(set(old) - set(files))}


if __name__ == '__main__':
    print(json.dumps(refresh(), ensure_ascii=False, indent=2))
