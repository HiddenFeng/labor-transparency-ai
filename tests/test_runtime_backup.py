import base64
import json
import os
import tempfile
import unittest
from pathlib import Path

from app.platform import Store
from scripts.runtime_backup import create_backup, drill, evidence_key_path, restore_backup, verify_backup


class RuntimeBackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.db = self.root / 'runtime.sqlite3'
        self.owner = 'backup-test-owner'
        self.store = Store(self.db)
        self.store.set_phase('assistance')
        receipt = self.store.register(
            self.owner,
            {'name': '备份演练公司（虚构）', 'region': '示例地区', 'needs': ['company', 'help'],
             'public': True, 'consent': True, 'synthetic': True},
            'runtime-backup-company-1',
        )
        self.cid = receipt['company_id']
        self.kid = self.store.create_case(self.cid, self.owner, '备份恢复测试', '仅供测试的私密事实', '验证恢复链') ['id']
        response = self.store.add_evidence(
            self.kid, self.owner, '支持测试事实', 'note.txt', base64.b64encode(b'private backup fixture').decode()
        )
        self.eid = response['id']

    def tearDown(self):
        self.tmp.cleanup()

    def test_create_and_verify_include_consistent_database_and_key(self):
        out = self.root / 'backup'
        manifest = create_backup(self.db, out)
        result = verify_backup(out)
        self.assertEqual(result['status'], 'VERIFIED')
        self.assertEqual(result['evidence_count'], 1)
        self.assertTrue(result['key_present'])
        self.assertEqual(manifest['database']['quick_check'], 'ok')
        self.assertEqual(os.stat(out).st_mode & 0o777, 0o700)
        self.assertEqual(os.stat(out / 'database.sqlite3').st_mode & 0o777, 0o600)
        self.assertEqual(os.stat(out / 'database.evidence.key').st_mode & 0o777, 0o600)

    def test_restore_to_fresh_path_preserves_private_evidence(self):
        out = self.root / 'backup'
        create_backup(self.db, out)
        restored = self.root / 'restored.sqlite3'
        result = restore_backup(out, restored, service_stopped=True)
        self.assertEqual(result['status'], 'RESTORED')
        restored_store = Store(restored)
        raw, filename = restored_store.evidence_file(self.eid, self.owner)
        self.assertEqual(filename, 'note.txt')
        self.assertEqual(raw, b'private backup fixture')
        self.assertEqual(restored_store.case(self.kid, self.owner)['facts'], '仅供测试的私密事实')

    def test_restore_requires_explicit_service_stopped(self):
        out = self.root / 'backup'
        create_backup(self.db, out)
        with self.assertRaisesRegex(ValueError, 'service-stopped'):
            restore_backup(out, self.root / 'restored.sqlite3')

    def test_existing_target_is_not_overwritten_without_replace(self):
        out = self.root / 'backup'
        create_backup(self.db, out)
        target = self.root / 'target.sqlite3'
        target.write_bytes(b'do-not-overwrite')
        with self.assertRaisesRegex(ValueError, '拒绝覆盖'):
            restore_backup(out, target, service_stopped=True)
        self.assertEqual(target.read_bytes(), b'do-not-overwrite')

    def test_replace_creates_safety_backup_before_overwrite(self):
        out = self.root / 'backup'
        create_backup(self.db, out)
        target = self.root / 'target.sqlite3'
        other = Store(target)
        other.set_phase('assistance')
        other.register('old-owner', {'name': '旧目标（虚构）', 'region': '示例', 'needs': ['company'],
                                     'public': True, 'consent': True, 'synthetic': True}, 'old-target-1')
        result = restore_backup(out, target, replace=True, service_stopped=True)
        self.assertTrue(result['safety_backup'])
        self.assertTrue(Path(result['safety_backup']).is_dir())
        restored_store = Store(target)
        self.assertEqual(restored_store.evidence_file(self.eid, self.owner)[0], b'private backup fixture')

    def test_tampered_database_is_rejected_before_restore(self):
        out = self.root / 'backup'
        create_backup(self.db, out)
        db = out / 'database.sqlite3'
        with db.open('ab') as f:
            f.write(b'tamper')
        with self.assertRaisesRegex(ValueError, '哈希不匹配'):
            verify_backup(out)

    def test_tampered_key_is_rejected_before_restore(self):
        out = self.root / 'backup'
        create_backup(self.db, out)
        key = out / 'database.evidence.key'
        key.write_bytes(key.read_bytes()[:-1] + b'X')
        with self.assertRaisesRegex(ValueError, '密钥哈希不匹配'):
            verify_backup(out)

    def test_backup_refuses_unrecoverable_evidence_without_key(self):
        evidence_key_path(self.db).unlink()
        with self.assertRaisesRegex(ValueError, '密钥缺失'):
            create_backup(self.db, self.root / 'backup')

    def test_drill_creates_verifies_and_restores_in_isolated_tempdir(self):
        result = drill(self.db)
        self.assertEqual(result['status'], 'DRILL_PASSED')
        self.assertEqual(result['verified']['evidence_count'], 1)
        self.assertEqual(result['restored']['evidence_count'], 1)


if __name__ == '__main__':
    unittest.main()
