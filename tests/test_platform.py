import base64
import io
import json
import tempfile
import unittest
import zipfile
from datetime import timedelta
from pathlib import Path
from fastapi.testclient import TestClient
from app.server import create_app
from app.platform import Store
from app.core import utcnow, iso
from app.cli import demonstration_packet

ADMIN='test-admin-token-32-characters-long-only'
HEAD={'X-Ltp-Client':'local-demo'}
class PlatformTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'data.sqlite3'
        self.app=create_app(self.path,admin_token=ADMIN);self.store=self.app.state.store
        self.store.set_phase('assistance')
        self.a=TestClient(self.app);self.b=TestClient(self.app)
        self.a.get('/api/config');self.b.get('/api/config')
        self.n=0;self.cid=self.company()
    def tearDown(self):self.a.close();self.b.close();self.tmp.cleanup()
    def post(self,url,data,client=None):return (client or self.a).post('/api'+url,json=data,headers=HEAD)
    def get(self,url,client=None):return (client or self.a).get('/api'+url)
    def company(self,public=True):
        self.n+=1
        r=self.a.post('/api/requests',json={'name':'测试厂区（虚构）'+str(self.n),'region':'示例地区','needs':['company','help'],'public':public,'consent':True,'synthetic':True},headers={**HEAD,'Idempotency-Key':'platform-request-'+str(self.n)})
        self.assertEqual(r.status_code,200,r.text);return r.json()['company_id']
    def make_post(self,**kwargs):
        r=self.post('/companies/'+self.cid+'/posts',{'title':'周末休息的真实经历','body':'这是没有附件的测试陈述',**kwargs})
        self.assertEqual(r.status_code,200,r.text);return r.json()['id']
    def make_case(self,cid=None):
        r=self.post('/companies/'+(cid or self.cid)+'/cases',{'title':'工资核对测试','facts':'仅自己可见的私密事实ABC','goal':'请帮助核对我记录的差额'})
        self.assertEqual(r.status_code,200,r.text);return r.json()['id']
    def evidence(self,kid,content=b'test private content',filename='note.txt'):
        return self.post('/cases/'+kid+'/evidence',{'claim':'拟支持本人记录的事实','filename':filename,'content_b64':base64.b64encode(content).decode()})
    def admin(self,url,data):
        return self.a.post('/api/admin'+url,json=data,headers={**HEAD,'Authorization':'Bearer '+ADMIN})
    def signup(self):
        r=self.post('/account/signup',{'username':'测试成员','password':'test-only-strong-password'})
        self.assertEqual(r.status_code,200,r.text)

    def test_stage_plan_rejects_closed_write_and_read_apis(self):
        self.store.set_phase('plan')
        self.assertEqual(self.post('/companies/'+self.cid+'/posts',{'title':'无附件测试','body':'没有附件'}).status_code,403)
        self.assertEqual(self.get('/feed').status_code,403)
        self.assertEqual(self.get('/rankings').status_code,403)
        self.assertEqual(self.get('/companies/'+self.cid+'/conditions').status_code,403)
        self.assertEqual(self.post('/companies/'+self.cid+'/cases',{'title':'测试事项','facts':'测试事实','goal':'测试请求'}).status_code,403)
    def test_community_does_not_open_private_assistance(self):
        self.store.set_phase('community');self.make_post()
        self.assertEqual(self.post('/companies/'+self.cid+'/cases',{'title':'测试事项','facts':'测试事实','goal':'测试请求'}).status_code,403)
    def test_stage_downgrade_keeps_case_read_and_export(self):
        kid=self.make_case();self.store.set_phase('plan')
        self.assertEqual(self.get('/cases/'+kid).status_code,200)
        self.assertEqual(self.get('/cases/'+kid+'/export').status_code,200)
        self.assertEqual(self.post('/cases/'+kid+'/events',{'status':'DRAFT','note':'新记录测试'}).status_code,403)
    def test_stage_invalid_fails(self):self.assertEqual(self.admin('/phase',{'phase':'whatever'}).status_code,400)
    def test_admin_requires_credential(self):
        self.assertEqual(self.get('/admin').status_code,403)
        self.assertEqual(self.post('/admin/phase',{'phase':'assistance'}).status_code,403)
    def test_admin_valid_phase_updates_api(self):
        self.assertEqual(self.admin('/phase',{'phase':'community'}).status_code,200)
        self.assertEqual(self.get('/config').json()['phase'],'community')
    def test_e0_without_attachments_can_be_published(self):
        pid=self.make_post();p=self.get('/posts/'+pid).json();self.assertEqual(p['evidence'],'E0')
    def test_empty_company_does_not_block_forum(self):
        self.assertEqual(self.get('/companies/'+self.cid).json()['snapshots'],[]);self.make_post()
    def test_private_company_cannot_receive_public_post(self):
        cid=self.company(False)
        self.assertEqual(self.post('/companies/'+cid+'/posts',{'title':'发帖测试','body':'不能公开到私密公司'}).status_code,400)
    def test_public_feed_does_not_expose_owner(self):
        self.make_post();self.assertNotIn('owner',self.get('/feed',self.b).json()[0])
    def test_comments_persist_and_are_public(self):
        pid=self.make_post();r=self.post('/posts/'+pid+'/comments',{'body':'我有补充的经历'},self.b)
        self.assertEqual(r.status_code,200);self.assertEqual(len(self.get('/posts/'+pid).json()['replies']),1)
    def test_duplicate_post_vote_does_not_inflate(self):
        pid=self.make_post()
        for _ in range(3):self.assertEqual(self.post('/posts/'+pid+'/vote',{}).status_code,200)
        self.assertEqual(self.get('/posts/'+pid).json()['votes'],1)
    def test_company_ballot_switch_and_revoke(self):
        self.post('/companies/'+self.cid+'/ballot',{'direction':'positive'})
        self.post('/companies/'+self.cid+'/ballot',{'direction':'negative'})
        c=self.get('/rankings').json()[0];self.assertEqual((c['positive'],c['negative']),(0,1))
        self.post('/companies/'+self.cid+'/ballot',{'direction':'clear'})
        self.assertEqual(self.get('/rankings').json()[0]['negative'],0)
    def test_heat_counts_distinct_accounts_not_actions(self):
        pid=self.make_post();self.post('/posts/'+pid+'/vote',{});self.post('/posts/'+pid+'/comments',{'body':'补充评论'})
        self.post('/companies/'+self.cid+'/ballot',{'direction':'negative'})
        self.assertEqual(self.get('/rankings').json()[0]['heat'],1)
    def test_heat_does_not_depend_on_evidence_label(self):
        pid=self.make_post();before=self.get('/rankings').json()[0]['heat']
        with self.store.db() as c:c.execute("UPDATE posts SET evidence='E5' WHERE id=?",(pid,))
        self.assertEqual(self.get('/rankings').json()[0]['heat'],before)
    def test_old_participation_excluded_from_weekly_heat(self):
        pid=self.make_post()
        with self.store.db() as c:c.execute('UPDATE posts SET created_at=? WHERE id=?',(iso(utcnow()-timedelta(days=8)),pid))
        self.assertEqual(self.get('/rankings').json()[0]['heat'],0)
    def test_emergency_is_self_report_not_evidence_upgrade(self):
        pid=self.make_post(urgent=True);p=self.get('/posts/'+pid).json()
        self.assertTrue(p['urgent']);self.assertEqual(p['evidence'],'E0')
        self.assertEqual(self.get('/rankings').json()[0]['heat'],1)
    def test_wrong_owner_cannot_withdraw(self):
        pid=self.make_post();self.assertEqual(self.post('/posts/'+pid+'/withdraw',{},self.b).status_code,403)
    def test_withdrawn_post_is_not_in_feed_or_heat(self):
        pid=self.make_post();self.post('/posts/'+pid+'/withdraw',{})
        self.assertEqual(self.get('/feed').json(),[]);self.assertEqual(self.get('/rankings').json()[0]['heat'],0)
    def test_privacy_preflight_does_not_demand_evidence(self):
        self.assertEqual(self.post('/companies/'+self.cid+'/posts',{'title':'含号码的公开文本','body':'联系13812345678'}).status_code,400)
        self.make_post()
    def test_private_cases_isolated_between_accounts(self):
        kid=self.make_case();self.assertEqual(self.get('/cases/'+kid,self.b).status_code,404)
        self.assertEqual(self.get('/cases',self.b).json(),[])
    def test_private_case_facts_not_in_public_company(self):
        self.make_case();r=self.get('/companies/'+self.cid,self.b)
        self.assertNotIn('ABC',r.text);self.assertNotIn('cases',r.json())
    def test_material_without_evidence_does_not_invent_attachment(self):
        kid=self.make_case();r=self.get('/cases/'+kid+'/material')
        self.assertEqual(r.status_code,200);self.assertIn('目前未提供附件',r.text);self.assertNotIn('附件1工资流水',r.text)
    def test_evidence_received_not_verified(self):
        kid=self.make_case();r=self.evidence(kid)
        self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['evidence'],'E2');self.assertIn('尚未核实',r.json()['verification'])
    def test_evidence_encrypted_at_rest(self):
        kid=self.make_case();r=self.evidence(kid);eid=r.json()['id']
        with self.store.db() as c:blob=c.execute('SELECT ciphertext FROM evidence WHERE id=?',(eid,)).fetchone()[0]
        self.assertNotIn(b'test private content',blob)
        self.assertEqual(self.get('/evidence/'+eid+'/download').content,b'test private content')
        self.assertEqual(self.path.with_suffix('.evidence.key').stat().st_mode&0o777,0o600)
    def test_evidence_cannot_be_downloaded_by_other_user(self):
        eid=self.evidence(self.make_case()).json()['id']
        self.assertEqual(self.get('/evidence/'+eid+'/download',self.b).status_code,404)
    def test_evidence_file_extension_and_header_enforced(self):
        kid=self.make_case()
        self.assertEqual(self.evidence(kid,b'not png','fake.png').status_code,400)
        self.assertEqual(self.evidence(kid,b'raw','file.exe').status_code,400)
    def test_evidence_path_is_rejected(self):
        self.assertEqual(self.evidence(self.make_case(),b'raw','../note.txt').status_code,400)
    def test_evidence_can_be_deleted_by_owner(self):
        eid=self.evidence(self.make_case()).json()['id']
        self.assertEqual(self.post('/evidence/'+eid+'/delete',{}).status_code,200)
        self.assertEqual(self.get('/evidence/'+eid+'/download').status_code,404)
    def test_evidence_delete_denied_to_other_owner(self):
        eid=self.evidence(self.make_case()).json()['id']
        self.assertEqual(self.post('/evidence/'+eid+'/delete',{},self.b).status_code,404)
    def test_public_summary_requires_explicit_consent(self):
        kid=self.make_case();self.assertEqual(self.post('/cases/'+kid+'/public-summary',{'summary':'公开摘要'}).status_code,400)
    def test_summary_projection_does_not_include_private_case_fields(self):
        kid=self.make_case();self.post('/cases/'+kid+'/public-summary',{'summary':'我希望核对一次薪资差额。','consent':True})
        r=self.get('/companies/'+self.cid+'/public-summaries',self.b)
        self.assertEqual(len(r.json()),1)
        for word in ['ABC','case_id','owner','facts','goal','status']:self.assertNotIn(word,r.text)
    def test_summary_can_be_revoked_without_deleting_case(self):
        kid=self.make_case();self.post('/cases/'+kid+'/public-summary',{'summary':'可公开摘要测试','consent':True})
        self.post('/cases/'+kid+'/revoke-summary',{})
        self.assertEqual(self.get('/companies/'+self.cid+'/public-summaries').json(),[])
        self.assertEqual(self.get('/cases/'+kid).status_code,200)
    def test_status_cannot_claim_official_guilt(self):
        kid=self.make_case();self.assertEqual(self.post('/cases/'+kid+'/events',{'status':'GUILTY','note':'不能将用户记录变成认定'}).status_code,400)
    def test_user_reported_receipt_is_labeled(self):
        kid=self.make_case();r=self.post('/cases/'+kid+'/events',{'status':'USER_REPORTED_RECEIVED','note':'本人记录收到了回执'})
        self.assertIn('平台未核验',r.json()['label'])
    def test_export_contains_real_private_attachment(self):
        kid=self.make_case();self.evidence(kid);r=self.get('/cases/'+kid+'/export')
        z=zipfile.ZipFile(io.BytesIO(r.content));self.assertIn('statement.txt',z.namelist())
        file=next(n for n in z.namelist() if n.endswith('note.txt'));self.assertEqual(z.read(file),b'test private content')
    def test_export_denied_to_other_user(self):
        kid=self.make_case();self.assertEqual(self.get('/cases/'+kid+'/export',self.b).status_code,404)
    def test_report_is_private(self):
        pid=self.make_post();r=self.post('/posts/'+pid+'/report',{'reason':'inaccuracy','detail':'私密事实反馈XYZ'})
        self.assertEqual(r.status_code,200);self.assertNotIn('XYZ',self.get('/posts/'+pid,self.b).text)
    def test_moderation_records_reason_and_hides_then_restores(self):
        pid=self.make_post();rid=self.post('/posts/'+pid+'/report',{'reason':'privacy','detail':'某些内容可能识别个人'}).json()['id']
        self.admin('/reports/'+rid,{'action':'hide','reason':'先撤下具体隐私内容等待复核'})
        self.assertEqual(self.get('/posts/'+pid).status_code,404)
        self.admin('/reports/'+rid,{'action':'restore','reason':'经重新核对后恢复可公开内容'})
        self.assertEqual(self.get('/posts/'+pid).status_code,200)
    def test_regular_user_cannot_moderate(self):
        pid=self.make_post();rid=self.post('/posts/'+pid+'/report',{'reason':'other','detail':'一般测试反馈内容'}).json()['id']
        self.assertEqual(self.post('/admin/reports/'+rid,{'action':'hide','reason':'普通用户不能审批其他内容'}).status_code,403)
    def test_response_requires_verified_representation(self):
        self.assertEqual(self.post('/companies/'+self.cid+'/responses',{'body':'未经核验的官方回应'}).status_code,403)
    def test_approved_representative_can_reply_but_cannot_read_cases(self):
        kid=self.make_case()
        rid=self.post('/companies/'+self.cid+'/representation',{'explanation':'本测试代表申请，待运营核验'},self.b).json()['id']
        self.admin('/representations/'+rid,{'reason':'测试夹具模拟人工核验完成，不是真实企业'})
        self.assertEqual(self.post('/companies/'+self.cid+'/responses',{'body':'企业代表的测试回应'},self.b).status_code,200)
        self.assertEqual(self.get('/cases/'+kid,self.b).status_code,404)
    def test_signup_preserves_visitor_work_and_rotates_cookie(self):
        kid=self.make_case();old=self.a.cookies.get('ltp_demo_session');self.signup()
        self.assertNotEqual(old,self.a.cookies.get('ltp_demo_session'))
        self.assertEqual(self.get('/cases/'+kid).status_code,200)
        self.assertEqual(len(self.get('/dashboard').json()['requests']),1)
    def test_registered_login_can_continue_from_other_session(self):
        kid=self.make_case();self.signup()
        self.assertEqual(self.post('/account/login',{'username':'测试成员','password':'test-only-strong-password'},self.b).status_code,200)
        self.assertEqual(self.get('/cases/'+kid,self.b).status_code,200)
    def test_login_also_preserves_new_visitor_work(self):
        self.signup();self.post('/account/logout',{})
        kid=self.make_case();self.post('/account/login',{'username':'测试成员','password':'test-only-strong-password'})
        self.assertEqual(self.get('/cases/'+kid).status_code,200)
    def test_logout_revokes_access(self):
        kid=self.make_case();self.signup();self.post('/account/logout',{})
        self.assertEqual(self.get('/cases/'+kid).status_code,404)
    def test_password_wrong_does_not_authenticate(self):
        self.signup();r=self.post('/account/login',{'username':'测试成员','password':'wrong-password'},self.b)
        self.assertEqual(r.status_code,400);self.assertFalse(self.get('/account',self.b).json()['signed_in'])
    def test_password_not_stored_as_plaintext(self):
        self.signup()
        with self.store.db() as c:stored=c.execute('SELECT password_hash FROM accounts').fetchone()[0]
        self.assertNotIn('test-only-strong-password',stored)
    def test_bad_cookie_does_not_create_chosen_identity(self):
        kid=self.make_case();self.b.cookies.set('ltp_demo_session','a'*43)
        self.assertEqual(self.get('/cases/'+kid,self.b).status_code,404)
    def test_delete_requires_confirmation(self):self.assertEqual(self.post('/account/delete',{'confirm':False}).status_code,400)
    def test_delete_removes_private_case_and_revokes_sessions(self):
        kid=self.make_case();eid=self.evidence(kid).json()['id'];self.signup()
        self.post('/account/login',{'username':'测试成员','password':'test-only-strong-password'},self.b)
        self.assertEqual(self.post('/account/delete',{'confirm':True}).status_code,200)
        self.assertEqual(self.get('/cases/'+kid,self.b).status_code,404)
        with self.store.db() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM evidence').fetchone()[0],0)
    def test_delete_also_handles_private_company(self):
        cid=self.company(False);self.make_case(cid)
        self.assertEqual(self.post('/account/delete',{'confirm':True}).status_code,200)
    def test_full_data_export_not_cross_user(self):
        self.make_case();z=zipfile.ZipFile(io.BytesIO(self.get('/account/export',self.b).content))
        self.assertNotIn('ABC',z.read('my-data.json').decode())
    def test_scarce_conditions_do_not_publish_precise_statistics(self):
        payload={'period':'2026H1','advertised_pay':15000,'actual_pay':10000,'advertised_basis':'gross_month','actual_basis':'net_month'}
        self.assertEqual(self.post('/companies/'+self.cid+'/conditions',payload).status_code,200)
        r=self.get('/companies/'+self.cid+'/conditions',self.b).json();self.assertIsNone(r['own']);self.assertEqual(r['groups'],[])
    def test_salary_basis_mismatch_never_computes_difference(self):
        for i in range(5):self.store.save_condition(self.cid,'sample-'+str(i),{'period':'2026H1','advertised_pay':15000,'actual_pay':10000,'advertised_basis':'gross_month','actual_basis':'net_month'})
        r=self.get('/companies/'+self.cid+'/conditions').json()['groups'][0]
        self.assertFalse(r['comparable']);self.assertIsNone(r['median_difference'])
    def test_same_basis_salary_difference_is_computed(self):
        for i in range(5):self.store.save_condition(self.cid,'sample-'+str(i),{'period':'2026H1','advertised_pay':15000,'actual_pay':10000,'advertised_basis':'gross_month','actual_basis':'gross_month'})
        r=self.get('/companies/'+self.cid+'/conditions').json()['groups'][0]
        self.assertTrue(r['comparable']);self.assertEqual(r['median_difference'],-5000)
    def test_condition_same_owner_upserts(self):
        for rest in ['two','one']:self.post('/companies/'+self.cid+'/conditions',{'period':'2026H1','rest':rest})
        r=self.get('/companies/'+self.cid+'/conditions').json();self.assertEqual(r['count'],1);self.assertEqual(r['own']['rest'],'one')
    def test_invalid_hours_rejected(self):
        self.assertEqual(self.post('/companies/'+self.cid+'/conditions',{'period':'2026H1','weekly_hours':200}).status_code,400)
    def test_release_generates_one_notice_not_every_repeat(self):
        with self.store.db() as c:
            c.execute('UPDATE jobs SET due_at=? WHERE company_id=?',(iso(utcnow()-timedelta(seconds=1)),self.cid))
        first=self.store.release();self.store.release();d=self.get('/dashboard').json()
        self.assertEqual(len(first),1);self.assertEqual(len(d['notices']),1)
    def test_data_persists_across_store_restart(self):
        kid=self.make_case();store2=Store(self.path)
        with store2.db() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM cases WHERE id=?',(kid,)).fetchone()[0],1)
    def test_real_external_services_not_faked_in_config(self):
        r=self.get('/config').json();self.assertFalse(r['network_research']);self.assertFalse(r['scheduler_installed'])
    def test_frontend_code_and_assets_served(self):
        self.assertEqual(self.a.get('/').status_code,200)
        for name in ['app.js','styles.css','workers.jpg','whitepaper.html']:
            self.assertEqual(self.a.get('/assets/'+name).status_code,200)
    def test_body_length_errors_are_controlled(self):
        r=self.a.post('/api/features',content='{}',headers={**HEAD,'Content-Length':'nonsense','Content-Type':'application/json'})
        self.assertEqual(r.status_code,400)
    def test_old_v02_database_migrates_without_loss(self):
        from app.core import Store as Original
        path=Path(self.tmp.name)/'old.sqlite3';old=Original(path)
        receipt=old.register('original-owner',{'name':'老版本公司（虚构）','region':'示例','needs':['company'],'public':True,'synthetic':True,'consent':True},'old-request-001')
        extended=Store(path);self.assertEqual(extended.company(receipt['company_id'],'original-owner')['name'],'老版本公司（虚构）')
        with extended.db() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM requests').fetchone()[0],1)

if __name__=='__main__':unittest.main()
