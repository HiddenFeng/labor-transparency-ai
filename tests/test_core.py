import copy
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from app.core import Store, SECTIONS, empty_packet, digest
from app.cli import demonstration_packet

AT = datetime(2026, 9, 14, 4, 0, tzinfo=timezone.utc)
P = {'name':'验证制造（虚构）','region':'示例城市','needs':['company','help'],
     'public':True,'consent':True,'synthetic':True}

class CoreTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.temp.name)/'test.sqlite3')
    def tearDown(self): self.temp.cleanup()
    def register(self, owner='u1', extra=None, idem='request-0001', at=AT):
        return self.store.register(owner,dict(P,**(extra or {})),idem,at)
    def packet(self, receipt):
        co=self.store.company(receipt['company_id'],'u1')
        return demonstration_packet(co,AT)
    def test_immediate_space_no_material(self):
        r=self.register(); c=self.store.company(r['company_id'],'u1')
        self.assertEqual(c['status'],'QUEUED');self.assertEqual(c['snapshots'],[])
    def test_private_company_not_public(self):
        r=self.register(extra={'public':False})
        self.assertEqual(self.store.list_companies(),[])
        with self.assertRaises(LookupError): self.store.company(r['company_id'],'u2')
    def test_public_projection_does_not_leak_intent(self):
        r=self.register(); c=self.store.company(r['company_id'],'u2')
        self.assertNotIn('needs',c);self.assertNotIn('owner',c)
        self.assertEqual(self.store.mine('u2')['requests'],[])
    def test_idempotent_same_request(self):
        self.assertEqual(self.register(),self.register())
        self.assertEqual(len(self.store.mine('u1')['requests']),1)
    def test_changed_payload_same_key_rejected(self):
        self.register()
        with self.assertRaises(ValueError):self.register(extra={'needs':['discussion']})
    def test_same_name_not_merged(self):
        a=self.register();b=self.register('u2')
        self.assertNotEqual(a['company_id'],b['company_id'])
    def test_explicit_existing_space_one_job(self):
        a=self.register();b=self.register('u2',extra={'company_id':a['company_id']})
        self.assertEqual(a['company_id'],b['company_id'])
        with self.store.db() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM jobs').fetchone()[0],1)
    def test_no_public_takeover_private_space(self):
        a=self.register(extra={'public':False})
        with self.assertRaises(LookupError):self.register('u2',extra={'company_id':a['company_id']})
    def test_calendar_boundary_no_omission(self):
        before=datetime.fromisoformat('2026-09-14T23:59:59+09:00')
        after=datetime.fromisoformat('2026-09-15T00:00:00+09:00')
        self.assertEqual(self.store.cohort(before)[0],'2026-09-14')
        self.assertEqual(self.store.cohort(after)[0],'2026-09-15')
    def test_next_day_does_not_mean_within_24h(self):
        before=datetime.fromisoformat('2026-09-14T00:01:00+09:00')
        _,due=self.store.cohort(before)
        self.assertGreater(datetime.fromisoformat(due)-before,timedelta(hours=24))
    def test_never_publish_before_due(self):
        r=self.register();self.store.prepare(r['company_id'],r['batch_day'],self.packet(r))
        self.assertEqual(self.store.release(AT),[])
    def test_sources_and_gaps_release(self):
        r=self.register();p=self.packet(r);self.store.prepare(r['company_id'],r['batch_day'],p)
        result=self.store.release(AT+timedelta(days=1))
        self.assertEqual(result[0]['covered_sections'],5)
        self.assertEqual(result[0]['status'],'PUBLISHED_PARTIAL')
        snap=self.store.company(r['company_id'],'u1')['snapshots'][0]
        self.assertEqual(snap['digest'],digest(p))
    def test_missing_sources_release_unknown(self):
        r=self.register();result=self.store.release(AT+timedelta(days=1))
        self.assertEqual(result[0]['status'],'SOURCE_UNAVAILABLE')
        self.assertEqual(len(self.store.company(r['company_id'],'u1')['snapshots']),1)
    def test_release_idempotent(self):
        self.register();self.store.release(AT+timedelta(days=1))
        self.assertEqual(self.store.release(AT+timedelta(days=1)),[])
    def test_overdue_backlog_not_dropped(self):
        self.register();self.register('u2',at=AT+timedelta(days=2))
        self.assertEqual(len(self.store.release(AT+timedelta(days=5))),2)
    def test_source_reference_required(self):
        r=self.register();p=self.packet(r);p['sections']['business']['items'][0]['source_ids']=[]
        with self.assertRaises(ValueError):self.store.prepare(r['company_id'],r['batch_day'],p)
    def test_identity_mismatch_rejected(self):
        r=self.register();p=self.packet(r);p['company_id']='different'
        with self.assertRaises(ValueError):self.store.prepare(r['company_id'],r['batch_day'],p)
    def test_unknown_identity_cannot_publish_relationship(self):
        r=self.register();p=self.packet(r);p['identity_status']='UNRESOLVED'
        with self.assertRaises(ValueError):self.store.prepare(r['company_id'],r['batch_day'],p)
    def test_review_record_required(self):
        r=self.register();p=self.packet(r);p['review']['status']='DRAFT'
        with self.assertRaises(ValueError):self.store.prepare(r['company_id'],r['batch_day'],p)
    def test_no_mix_real_and_synthetic(self):
        r=self.register();p=self.packet(r);p['synthetic']=False
        with self.assertRaises(ValueError):self.store.prepare(r['company_id'],r['batch_day'],p)
    def test_historical_relation_time_preserved(self):
        r=self.register();p=self.packet(r);self.store.prepare(r['company_id'],r['batch_day'],p)
        self.store.release(AT+timedelta(days=1))
        item=self.store.company(r['company_id'],'u1')['snapshots'][0]['packet']['sections']['supply_chain']['items'][0]
        self.assertIn('2025',item['as_of']);self.assertIn('当前关系未知',item['text'])
    def test_forum_closed_independent_of_dossier(self):
        r=self.register()
        with self.assertRaises(ValueError):self.store.post(r['company_id'],'u1','测试讨论','没有附件也希望讨论')
    def test_forum_open_e0_without_dossier(self):
        r=self.register();self.store.set_forum(True)
        p=self.store.post(r['company_id'],'u1','测试讨论','没有附件也可以发帖')
        self.assertEqual(p['evidence'],'E0')
        self.assertEqual(self.store.company(r['company_id'],'u1')['snapshots'],[])
    def test_vote_deduplicates(self):
        r=self.register();self.store.set_forum(True)
        p=self.store.post(r['company_id'],'u1','测试讨论','没有附件也可以发帖')
        self.store.vote(p['id'],'u2');self.store.vote(p['id'],'u2')
        self.assertEqual(self.store.posts(r['company_id'],'u1')[0]['votes'],1)
    def test_feature_private(self):
        self.store.features('u1','工资口径','需要税前税后的区分')
        self.assertEqual(len(self.store.mine('u1')['features']),1)
        self.assertEqual(self.store.mine('u2')['features'],[])
    def test_reopen_db_persists(self):
        r=self.register();other=Store(self.store.path)
        self.assertEqual(other.mine('u1')['requests'][0]['id'],r['id'])
    def test_missing_consent_rejected(self):
        with self.assertRaises(ValueError):self.register(extra={'consent':False})
    def test_invalid_url_rejected(self):
        with self.assertRaises(ValueError):self.register(extra={'website':'javascript:alert(1)'})
    def test_real_data_not_needed_for_proto(self):
        r=self.register();self.assertEqual(set(self.packet(r)['sections']),set(SECTIONS))

if __name__=='__main__':unittest.main()
