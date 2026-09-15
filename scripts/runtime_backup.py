"""Create, verify, restore, and drill local runtime backups.

The backup contains a consistent SQLite snapshot and, when present, the separate
private-evidence Fernet key. Backups are local operational artifacts; this script
does not upload them anywhere and does not make the application production-ready.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken

ROOT = Path(__file__).resolve().parents[1]
FORMAT_VERSION = 1
DB_NAME = 'database.sqlite3'
KEY_NAME = 'database.evidence.key'
MANIFEST_NAME = 'manifest.json'


def iso_now():
    return datetime.now(timezone.utc).isoformat()


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def evidence_key_path(db_path):
    return Path(db_path).with_suffix('.evidence.key')


def open_ro(path):
    return sqlite3.connect('file:' + str(Path(path).resolve()) + '?mode=ro', uri=True)


def sqlite_facts(path):
    c = open_ro(path)
    try:
        quick = c.execute('PRAGMA quick_check').fetchone()[0]
        tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        evidence_count = 0
        if 'evidence' in tables:
            evidence_count = c.execute('SELECT COUNT(*) FROM evidence').fetchone()[0]
        return {'quick_check': quick, 'tables': tables, 'evidence_count': evidence_count}
    finally:
        c.close()


def consistent_sqlite_copy(src, dest):
    src = Path(src)
    dest = Path(dest)
    source = sqlite3.connect(str(src))
    target = sqlite3.connect(str(dest))
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()
    os.chmod(dest, 0o600)


def _write_manifest(stage, source_db, facts, key_present):
    manifest = {
        'format': 'ltp-runtime-backup',
        'format_version': FORMAT_VERSION,
        'created_at': iso_now(),
        'source_database_name': Path(source_db).name,
        'database': {'file': DB_NAME, 'sha256': sha256(stage / DB_NAME), 'quick_check': facts['quick_check']},
        'evidence': {'count': facts['evidence_count'], 'key_present': bool(key_present)},
        'tables': facts['tables'],
    }
    if key_present:
        manifest['evidence']['key_file'] = KEY_NAME
        manifest['evidence']['key_sha256'] = sha256(stage / KEY_NAME)
    out = stage / MANIFEST_NAME
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    os.chmod(out, 0o600)
    return manifest


def create_backup(db_path, out_dir):
    db_path = Path(db_path).expanduser().resolve()
    out_dir = Path(out_dir).expanduser().resolve()
    if not db_path.is_file():
        raise ValueError('数据库不存在：' + str(db_path))
    if out_dir.exists():
        raise ValueError('备份目标已存在；请使用新的目录避免覆盖')
    out_dir.parent.mkdir(parents=True, exist_ok=True)
    stage = out_dir.parent / ('.' + out_dir.name + '.tmp-' + uuid.uuid4().hex[:8])
    stage.mkdir(mode=0o700)
    try:
        consistent_sqlite_copy(db_path, stage / DB_NAME)
        facts = sqlite_facts(stage / DB_NAME)
        if facts['quick_check'] != 'ok':
            raise ValueError('SQLite一致性检查失败：' + str(facts['quick_check']))
        key = evidence_key_path(db_path)
        if facts['evidence_count'] and not key.is_file():
            raise ValueError('备份快照包含私密附件，但附件密钥缺失；拒绝生成不可恢复备份')
        key_present = key.is_file()
        if key_present:
            if key.is_symlink():
                raise ValueError('附件密钥不能是符号链接')
            shutil.copyfile(key, stage / KEY_NAME)
            os.chmod(stage / KEY_NAME, 0o600)
        manifest = _write_manifest(stage, db_path, facts, key_present)
        os.replace(stage, out_dir)
        os.chmod(out_dir, 0o700)
        return manifest
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise


def _safe_backup_file(backup_dir, name):
    backup_dir = Path(backup_dir).expanduser().resolve()
    path = backup_dir / name
    if path.parent != backup_dir or path.is_symlink() or not path.is_file():
        raise ValueError('备份文件缺失或路径不安全：' + name)
    return path


def verify_backup(backup_dir, verify_evidence=True):
    backup_dir = Path(backup_dir).expanduser().resolve()
    manifest_path = _safe_backup_file(backup_dir, MANIFEST_NAME)
    try:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError('备份清单无法解析') from exc
    if manifest.get('format') != 'ltp-runtime-backup' or manifest.get('format_version') != FORMAT_VERSION:
        raise ValueError('备份格式或版本不受支持')
    db_entry = manifest.get('database') or {}
    if db_entry.get('file') != DB_NAME:
        raise ValueError('备份数据库文件名异常')
    db = _safe_backup_file(backup_dir, DB_NAME)
    if not db_entry.get('sha256') or sha256(db) != db_entry['sha256']:
        raise ValueError('数据库哈希不匹配，备份可能损坏或被修改')
    facts = sqlite_facts(db)
    if facts['quick_check'] != 'ok':
        raise ValueError('备份数据库SQLite一致性检查失败')
    if facts['evidence_count'] != int((manifest.get('evidence') or {}).get('count', -1)):
        raise ValueError('私密附件计数与备份清单不一致')
    evidence = manifest.get('evidence') or {}
    key_present = bool(evidence.get('key_present'))
    key = None
    cipher = None
    if key_present:
        if evidence.get('key_file') != KEY_NAME:
            raise ValueError('附件密钥文件名异常')
        key = _safe_backup_file(backup_dir, KEY_NAME)
        if not evidence.get('key_sha256') or sha256(key) != evidence['key_sha256']:
            raise ValueError('附件密钥哈希不匹配，备份可能损坏或被修改')
        try:
            cipher = Fernet(key.read_bytes())
        except (ValueError, TypeError) as exc:
            raise ValueError('附件密钥格式无效') from exc
    elif facts['evidence_count']:
        raise ValueError('备份包含私密附件但没有附件密钥')
    if verify_evidence and facts['evidence_count']:
        if cipher is None:
            raise ValueError('备份包含私密附件但没有可用附件密钥')
        c = open_ro(db)
        try:
            for row in c.execute('SELECT content_hash,ciphertext FROM evidence'):
                try:
                    raw = cipher.decrypt(row[1])
                except InvalidToken as exc:
                    raise ValueError('附件密钥无法解密备份中的私密附件') from exc
                if hashlib.sha256(raw).hexdigest() != row[0]:
                    raise ValueError('私密附件解密后哈希不一致')
        finally:
            c.close()
    return {'status': 'VERIFIED', 'database_sha256': db_entry['sha256'], 'evidence_count': facts['evidence_count'], 'key_present': key_present}


def _install_backup_files(backup_dir, target_db):
    """Install an already-verified backup without creating another safety backup."""
    backup_dir = Path(backup_dir).expanduser().resolve()
    target_db = Path(target_db).expanduser().resolve()
    target_key = evidence_key_path(target_db)
    stage_dir = Path(tempfile.mkdtemp(prefix='.ltp-restore-', dir=str(target_db.parent)))
    try:
        staged_db = stage_dir / target_db.name
        shutil.copyfile(_safe_backup_file(backup_dir, DB_NAME), staged_db)
        os.chmod(staged_db, 0o600)
        manifest = json.loads(_safe_backup_file(backup_dir, MANIFEST_NAME).read_text(encoding='utf-8'))
        staged_key = None
        if (manifest.get('evidence') or {}).get('key_present'):
            staged_key = stage_dir / target_key.name
            shutil.copyfile(_safe_backup_file(backup_dir, KEY_NAME), staged_key)
            os.chmod(staged_key, 0o600)
        os.replace(staged_db, target_db)
        if staged_key is not None:
            os.replace(staged_key, target_key)
        elif target_key.exists() or target_key.is_symlink():
            target_key.unlink()
    finally:
        shutil.rmtree(stage_dir, ignore_errors=True)


def restore_backup(backup_dir, target_db, replace=False, service_stopped=False):
    if not service_stopped:
        raise ValueError('恢复前必须停止使用该数据库的服务，并显式提供 --service-stopped')
    verify_backup(backup_dir, verify_evidence=True)
    backup_dir = Path(backup_dir).expanduser().resolve()
    target_db = Path(target_db).expanduser().resolve()
    if target_db.exists() and not replace:
        raise ValueError('目标数据库已存在；默认拒绝覆盖。需要替换时显式提供 --replace')
    target_db.parent.mkdir(parents=True, exist_ok=True)
    safety = None
    if target_db.exists():
        safety_root = target_db.parent / '.ltp-restore-safety'
        safety_root.mkdir(mode=0o700, exist_ok=True)
        safety = safety_root / ('before-restore-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6])
        create_backup(target_db, safety)
    try:
        _install_backup_files(backup_dir, target_db)
        restored = verify_runtime(target_db)
        return {'status': 'RESTORED', 'target': str(target_db), 'safety_backup': str(safety) if safety else None, **restored}
    except Exception:
        if safety is not None:
            try:
                verify_backup(safety, verify_evidence=True)
                _install_backup_files(safety, target_db)
                verify_runtime(target_db)
            except Exception as rollback_error:
                raise RuntimeError('恢复失败，且自动回滚也失败；请保留安全备份并人工恢复') from rollback_error
        raise


def verify_runtime(db_path):
    db_path = Path(db_path).expanduser().resolve()
    facts = sqlite_facts(db_path)
    if facts['quick_check'] != 'ok':
        raise ValueError('恢复后的SQLite一致性检查失败')
    key = evidence_key_path(db_path)
    cipher = None
    if key.is_file():
        try:
            cipher = Fernet(key.read_bytes())
        except (ValueError, TypeError) as exc:
            raise ValueError('恢复后的附件密钥格式无效') from exc
    if facts['evidence_count']:
        if cipher is None:
            raise ValueError('恢复后的数据库包含私密附件，但附件密钥缺失')
        c = open_ro(db_path)
        try:
            for row in c.execute('SELECT content_hash,ciphertext FROM evidence'):
                raw = cipher.decrypt(row[1])
                if hashlib.sha256(raw).hexdigest() != row[0]:
                    raise ValueError('恢复后的私密附件哈希不一致')
        finally:
            c.close()
    return {'quick_check': facts['quick_check'], 'evidence_count': facts['evidence_count'], 'key_present': key.is_file()}


def drill(db_path):
    db_path = Path(db_path).expanduser().resolve()
    with tempfile.TemporaryDirectory(prefix='ltp-backup-drill-') as td:
        td = Path(td)
        backup = td / 'backup'
        restored = td / 'restored.sqlite3'
        created = create_backup(db_path, backup)
        verified = verify_backup(backup)
        result = restore_backup(backup, restored, service_stopped=True)
        if sha256(backup / DB_NAME) != sha256(restored):
            raise ValueError('演练恢复后的数据库与备份快照哈希不一致')
        return {'status': 'DRILL_PASSED', 'created_at': created['created_at'], 'verified': verified, 'restored': result}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    create = sub.add_parser('create')
    create.add_argument('--db', default=str(ROOT / 'local-data' / 'demo.sqlite3'))
    create.add_argument('--out', required=True)
    verify = sub.add_parser('verify')
    verify.add_argument('--backup', required=True)
    restore = sub.add_parser('restore')
    restore.add_argument('--backup', required=True)
    restore.add_argument('--target-db', required=True)
    restore.add_argument('--replace', action='store_true')
    restore.add_argument('--service-stopped', action='store_true')
    drill_p = sub.add_parser('drill')
    drill_p.add_argument('--db', default=str(ROOT / 'local-data' / 'demo.sqlite3'))
    args = p.parse_args()
    if args.command == 'create':
        result = create_backup(args.db, args.out)
        result = {'status': 'CREATED', 'backup': str(Path(args.out).expanduser().resolve()), **result}
    elif args.command == 'verify':
        result = verify_backup(args.backup)
    elif args.command == 'restore':
        result = restore_backup(args.backup, args.target_db, args.replace, args.service_stopped)
    else:
        result = drill(args.db)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
