"""Synthetic contract/regression tests; no external requests or real user records."""
import io
import zipfile
import json
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from fastapi.testclient import TestClient
from app.server import create_app
from app.core import utcnow, iso

ADMIN='synthetic-only-reviewer-admin-token-2026'
HEAD={'X-Ltp-Client':'local-demo'}
class CommunityTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.app=create_app(Path(self.temp.name)/'state.sqlite3',admin_token=ADMIN)
        self.s=self.app.state.store;self.s.set_phase('assistance')
        self.clients=[TestClient(self.app) for _ in range(4)]
        self.a,self.b,self.c,self.d=self.clients
        for x in self.clients:x.get('/api/config')
        self.n=0;self.cid=self.company()
        for x,name in [(self.b,'事实核验员'),(self.c,'再分发核验员')]:
            self.ok(self.post('/account/signup',{'username':name,'password':'Synthetic-test-pass-only'},x))
            self.ok(self.post('/admin/reviewers',{'username':name,'active':True},admin=True))
    def tearDown(self):
        for c in self.clients:c.close()
        self.temp.cleanup()
    def post(self,p,data=None,client=None,admin=False):
        h={**HEAD,**({'Authorization':'Bearer '+ADMIN} if admin else {})}
        return (client or self.a).post('/api'+p,json={} if data is None else data,headers=h)
    def get(self,p,client=None):return (client or self.a).get('/api'+p)
    def ok(self,r):self.assertEqual(r.status_code,200,r.text);return r.json()
    def company(self,public=True):
        self.n+=1
        r=self.a.post('/api/requests',json={'name':'共建验收虚构公司'+str(self.n),'region':'虚构地区','needs':['company'],'public':public,'consent':True,'synthetic':True},headers={**HEAD,'Idempotency-Key':'community-fixture-'+str(self.n)})
        return self.ok(r)['company_id']
    def data(self,**kw):
        d={'company_id':self.cid,'kind':'labour_claim','title':'某厂区按约定休息的记录','description':'仅测试：特定厂区该期间的休息安排，不代表其他部门。','direction':'positive','dimension':'rest',
           'scope':'虚构一号厂区','period_start':(utcnow().date()-timedelta(days=30)).isoformat(),'period_end':(utcnow().date()+timedelta(days=30)).isoformat(),
           'sources':[{'title':'虚构测试披露','url':'https://example.org/fixture','type':'company_disclosure','published_at':utcnow().date().isoformat(),'supports':'仅说明一号厂区的休息制度'}],
           'public':True,'consent':True,'share_consent':True,'rights':'own_summary','credit_name':'自愿测试笔名'}
        d.update(kw);return d
    def make(self,data=None,client=None):return self.ok(self.post('/contributions',data or self.data(),client))['id']
    def rev(self,i,client=None,evidence='E3',decision='approve',version=1,checks=None):
        return self.post('/contributions/'+i+'/review',{'version':version,'decision':decision,'evidence':evidence,'rationale':'已针对具体范围核对来源，以上仅为测试核验记录。','checks':checks or {'scope_checked':True,'authenticity_checked':True,'source_ids':['S1']}},client or self.b)
    def export(self,i,client=None,version=1,**kw):
        return self.post('/contributions/'+i+'/approve-export',{'version':version,'privacy_checked':True,'rights_checked':True,'reason':'确认公开摘要的隐私、范围及公益授权。',**kw},client or self.c)
    def lane(self,name='community_positive',**kw):
        return self.ok(self.get('/showcase?lane='+name+''.join('&'+k+'='+str(v) for k,v in kw.items())))['items']
    def vote(self,direction='positive',client=None):return self.ok(self.post('/companies/'+self.cid+'/ballot',{'direction':direction},client))

    def test_e0_without_sources_public(self):
        i=self.make(self.data(sources=[]));r=self.ok(self.get('/contributions/'+i,self.d))
        self.assertEqual(r['evidence'],'E0');self.assertEqual(r['status'],'PENDING')
    def test_many_sources_do_not_promote(self):
        d=self.data();d['sources']*=10;i=self.make(d)
        self.assertEqual(self.ok(self.get('/contributions/'+i))['evidence'],'E0')
    def test_client_cannot_set_evidence_or_state(self):
        self.assertEqual(self.post('/contributions',self.data(evidence='E5')).status_code,422)
        self.assertEqual(self.post('/contributions',self.data(export_approved=True)).status_code,422)
    def test_private_default_does_not_leak(self):
        d=self.data(public=False);i=self.make(d)
        self.assertEqual(self.get('/contributions/'+i,self.d).status_code,404)
        self.assertEqual(self.ok(self.get('/contributions',self.d)),[])
        self.assertEqual(self.ok(self.get('/review-queue',self.b)),[])
    def test_private_company_rejects_public_contribution(self):
        cid=self.company(False)
        self.assertEqual(self.post('/contributions',self.data(company_id=cid)).status_code,400)
        self.make(self.data(company_id=cid,public=False))
    def test_consent_required(self):self.assertEqual(self.post('/contributions',self.data(consent=False)).status_code,400)
    def test_batch_atomic_on_later_bad_item(self):
        r=self.post('/contributions/batch',{'items':[self.data(),self.data(title='包含邮箱a@example.org')]})
        self.assertEqual(r.status_code,400);self.assertEqual(self.ok(self.get('/contributions?mine=true')),[])
    def test_duplicate_idempotent(self):
        i=self.make();r=self.ok(self.post('/contributions',self.data()))
        self.assertEqual(r['id'],i);self.assertTrue(r['duplicate']);self.assertEqual(len(self.ok(self.get('/contributions'))),1)
    def test_batch_size_limit(self):self.assertEqual(self.post('/contributions/batch',{'items':[self.data()]*51}).status_code,422)
    def test_public_projection_excludes_owner_and_rights_notes(self):
        i=self.make(self.data(rights_note='仅复核人员可读的说明'))
        r=self.get('/contributions/'+i,self.d)
        for text in ['owner','share_consent','rights_note','仅复核人员可读的说明']:self.assertNotIn(text,r.text)
    def test_invalid_source_addresses(self):
        for url in ['http://example.org/a','https://localhost/a','https://127.0.0.1/a','https://example.org/a?secret=1','https://someone:pass@example.org/a','https://example.org/a%40example.com','https://example.org/13812345678']:
            d=self.data();d['sources'][0]['url']=url
            self.assertEqual(self.post('/contributions',d).status_code,400,url)
    def test_date_order(self):self.assertEqual(self.post('/contributions',self.data(period_start='2027-01-01',period_end='2026-01-01')).status_code,400)
    def test_permission_without_license_note(self):self.assertEqual(self.post('/contributions',self.data(rights='permission')).status_code,400)
    def test_reference_only_cannot_be_relicensed(self):self.assertEqual(self.post('/contributions',self.data(rights='reference_only')).status_code,400)
    def test_no_share_consent_can_still_publish(self):self.make(self.data(share_consent=False,rights='reference_only'))
    def test_review_role_required(self):
        i=self.make();self.assertEqual(self.rev(i,self.d).status_code,403)
        self.assertEqual(self.get('/review-queue',self.d).status_code,403)
    def test_admin_does_not_impersonate_reviewer(self):
        i=self.make();self.assertEqual(self.rev(i,self.a).status_code,403)
    def test_no_self_review(self):
        i=self.make(client=self.b);self.assertEqual(self.rev(i,self.b).status_code,403)
    def test_e3_requires_supporting_scope(self):
        i=self.make(self.data(scope=''));self.assertEqual(self.rev(i).status_code,400)
    def test_e3_requires_authenticity_and_actual_reference(self):
        i=self.make()
        for chk in [{'scope_checked':True},{'scope_checked':True,'authenticity_checked':True,'source_ids':['missing']}]:self.assertEqual(self.rev(i,checks=chk).status_code,400)
    def test_e2_needs_material(self):
        i=self.make(self.data(sources=[]));self.assertEqual(self.rev(i,evidence='E2').status_code,400)
    def test_e5_not_just_filing(self):
        i=self.make();self.assertEqual(self.rev(i,evidence='E5').status_code,400)
    def test_e5_requires_decision_and_effect(self):
        d=self.data();d['sources'][0]['type']='official_decision';i=self.make(d)
        self.assertEqual(self.rev(i,evidence='E5').status_code,400)
        self.ok(self.rev(i,evidence='E5',checks={'scope_checked':True,'authenticity_checked':True,'source_ids':['S1'],'decision_reference':'虚构决定2026-TEST','effective':True}))
    def test_reviewer_revocation(self):
        i=self.make();self.ok(self.post('/admin/reviewers',{'username':'事实核验员','active':False},admin=True))
        self.assertEqual(self.rev(i).status_code,403)
    def test_grade_approve_not_redistribution(self):
        i=self.make();self.ok(self.rev(i));self.assertEqual(self.ok(self.get('/public-data'))['record_count'],0)
    def test_export_second_person_and_both_checks(self):
        i=self.make();self.ok(self.rev(i))
        self.assertEqual(self.export(i,self.b).status_code,403)
        self.assertEqual(self.export(i,privacy_checked=False).status_code,400)
        self.assertEqual(self.export(i,rights_checked=False).status_code,400)
        self.ok(self.export(i))
    def test_export_needs_independent_license_consent(self):
        i=self.make(self.data(share_consent=False));self.ok(self.rev(i));self.assertEqual(self.export(i).status_code,400)
    def test_e0_can_be_safely_redistributed_without_grade_inflation(self):
        i=self.make(self.data(sources=[],scope='',period_start='',period_end=''))
        self.assertNotEqual(self.export(i).status_code,200)
        reviewed=self.ok(self.rev(i,evidence='E0',checks={'scope_checked':True}))
        self.assertEqual(reviewed['status'],'REVIEWED');self.ok(self.export(i))
        data=self.ok(self.get('/public-data'));self.assertEqual(data['record_count'],1)
        self.assertEqual(data['categories']['labour_claim'][0]['evidence'],'E0')
        from app.publication import validate_dataset
        validate_dataset(data)
        self.assertEqual(len(self.ok(self.get('/showcase?lane=evidence_positive'))['items']),0)
    def test_export_safe_allowlist_and_credit(self):
        i=self.make();self.ok(self.rev(i));self.ok(self.export(i));r=self.ok(self.get('/public-data'))
        self.assertEqual(r['record_count'],1);row=r['categories']['labour_claim'][0]
        self.assertEqual(row['credit'],'自愿测试笔名');self.assertTrue(row['synthetic'])
        for k in ['owner','reviewer','password','email','rights_note','facts','goal']:self.assertNotIn(k,json.dumps(r))
    def test_anonymous_credit_default(self):
        i=self.make(self.data(credit_name=''));self.ok(self.rev(i));self.ok(self.export(i))
        self.assertEqual(self.ok(self.get('/public-data'))['categories']['labour_claim'][0]['credit'],'匿名贡献者')

    def test_internal_numeric_id_is_not_scanned_as_private_phone(self):
        from unittest.mock import patch
        with patch('app.community.uid',return_value='con_12345678901234567890'):
            i=self.make()
        self.ok(self.rev(i));self.ok(self.export(i))
        data=self.ok(self.get('/public-data'));self.assertEqual(data['record_count'],1);self.assertEqual(data['categories']['labour_claim'][0]['id'],i)
    def test_revision_resets_both_reviews(self):
        i=self.make();self.ok(self.rev(i));self.ok(self.export(i))
        r=self.ok(self.post('/contributions/'+i+'/revise',{'version':1,'contribution':self.data(description='更正后的具体劳动情况仅覆盖同一厂区。')}))
        self.assertEqual((r['version'],r['evidence'],r['export_approved']),(2,'E0',False));self.assertEqual(r['reviews'],[])
        self.assertEqual(self.ok(self.get('/public-data'))['record_count'],0)
    def test_stale_edit_and_review_rejected(self):
        i=self.make();self.ok(self.post('/contributions/'+i+'/revise',{'version':1,'contribution':self.data(title='更正的标题')}))
        self.assertEqual(self.rev(i,version=1).status_code,400)
        self.assertEqual(self.post('/contributions/'+i+'/revise',{'version':1,'contribution':self.data()}).status_code,400)
    def test_cannot_edit_or_withdraw_someone_else(self):
        i=self.make();self.assertEqual(self.post('/contributions/'+i+'/withdraw',client=self.d).status_code,403)
        self.assertEqual(self.post('/contributions/'+i+'/revise',{'version':1,'contribution':self.data()},self.d).status_code,403)
    def test_withdraw_excluded_from_export(self):
        i=self.make();self.ok(self.rev(i));self.ok(self.export(i));self.ok(self.post('/contributions/'+i+'/withdraw'))
        self.assertEqual(self.ok(self.get('/public-data'))['record_count'],0)
        self.assertEqual(self.get('/contributions/'+i,self.d).status_code,404)
    def test_flag_is_private_and_pauses_export(self):
        i=self.make();self.ok(self.rev(i));self.ok(self.export(i))
        f=self.ok(self.post('/contributions/'+i+'/flag',{'reason':'私密纠错内容仅交核验人员处理。'},self.d))
        self.assertNotIn('私密纠错',self.get('/contributions/'+i).text)
        queue=self.ok(self.get('/review-queue',self.b));self.assertEqual(queue[0]['pending_flags'][0]['id'],f['id'])
        self.assertEqual(self.ok(self.get('/public-data'))['record_count'],0)
        self.assertEqual(self.ok(self.get('/contributions/'+i))['evidence'],'E3')
    def test_duplicate_flag_is_not_multiple_reports(self):
        i=self.make();d={'reason':'范围可能不适用，请核对资料。'}
        f=self.ok(self.post('/contributions/'+i+'/flag',d,self.d));g=self.ok(self.post('/contributions/'+i+'/flag',d,self.d));self.assertEqual(f['id'],g['id'])
    def test_recheck_resolves_flag_but_needs_export_recheck(self):
        i=self.make();self.ok(self.rev(i));self.ok(self.export(i));self.ok(self.post('/contributions/'+i+'/flag',{'reason':'请重新核实来源的有效范围。'},self.d))
        self.ok(self.rev(i));self.assertEqual(self.ok(self.get('/public-data'))['record_count'],0)
        self.ok(self.export(i));self.assertEqual(self.ok(self.get('/public-data'))['record_count'],1)
    def test_rejected_hidden_and_disputed_kept_qualified(self):
        i=self.make();self.ok(self.rev(i));self.ok(self.rev(i,decision='dispute'))
        self.assertEqual(self.ok(self.get('/contributions/'+i,self.d))['status'],'DISPUTED')
        self.assertEqual(self.lane('evidence_positive'),[])
        self.ok(self.rev(i,decision='reject'));self.assertEqual(self.get('/contributions/'+i,self.d).status_code,404)
    def test_community_positive_and_negative_distinct(self):
        self.vote();self.assertEqual(len(self.lane()),1);self.assertEqual(self.lane('community_negative'),[])
        self.vote('negative');self.assertEqual(self.lane(),[]);self.assertEqual(len(self.lane('community_negative')),1)
    def test_equal_votes_not_sold_as_majority(self):
        self.vote();self.vote('negative',self.d);self.assertEqual(self.lane(),[]);self.assertEqual(self.lane('community_negative'),[])
    def test_small_sample_labeled_not_suppressed(self):
        self.vote();r=self.lane()[0];self.assertTrue(r['small_sample']);self.assertEqual(r['sample_size'],1)
    def test_evidence_does_not_change_community_heat(self):
        self.vote();i=self.make();before=self.lane()[0]['participants'];self.ok(self.rev(i));self.assertEqual(self.lane()[0]['participants'],before)
    def test_high_evidence_lane_no_votes_needed(self):
        i=self.make();self.ok(self.rev(i));r=self.lane('evidence_positive')[0]
        self.assertEqual(r['sample_size'],0);self.assertEqual(r['verified_positive_claims'][0]['id'],i)
    def test_company_identity_proof_not_labour_goodness(self):
        i=self.make(self.data(kind='company_fact',direction='neutral'));self.ok(self.rev(i));self.assertEqual(self.lane('evidence_positive'),[])
    def test_product_not_inheriting_labour_evidence(self):
        p=self.make(self.data(kind='product',title='虚构折叠台灯',direction='neutral',sources=[]));i=self.make();self.ok(self.rev(i))
        r=self.lane('evidence_positive')[0];self.assertEqual(r['products'][0]['id'],p);self.assertEqual(r['products'][0]['evidence'],'E0')
    def test_product_claim_requires_same_company_product(self):
        self.assertEqual(self.post('/contributions',self.data(kind='product_claim')).status_code,400)
        p=self.make(self.data(kind='product',direction='neutral'));self.make(self.data(kind='product_claim',product_id=p))
        self.assertEqual(self.post('/contributions',self.data(kind='product_claim',product_id=p,company_id=self.company())).status_code,400)
    def test_historical_claim_not_current_positive(self):
        i=self.make(self.data(period_start='2020-01-01',period_end='2020-12-31'));self.ok(self.rev(i));self.assertEqual(self.lane('evidence_positive'),[])
    def test_negative_counter_evidence_visible(self):
        i=self.make();self.ok(self.rev(i));n=self.make(self.data(title='同一厂区的另一项问题',direction='negative',dimension='pay'))
        r=self.lane('evidence_positive')[0];self.assertEqual(r['other_claims'][0]['id'],n)
    def test_flag_does_not_remove_ordinary_heat(self):
        self.vote();i=self.make();self.ok(self.rev(i));self.ok(self.post('/contributions/'+i+'/flag',{'reason':'有不同情况需要补充说明。'},self.d))
        self.assertEqual(len(self.lane()),1);self.assertEqual(self.lane('evidence_positive'),[])
    def test_30_day_heat_not_7_day(self):
        self.vote()
        with self.s.db() as c:c.execute('UPDATE company_ballots SET created_at=?',(iso(utcnow()-timedelta(days=10)),))
        self.assertEqual(self.lane(),[]);self.assertEqual(len(self.lane(days=30)),1)
    def test_search_product_label(self):
        self.vote();self.make(self.data(kind='product',title='虚构低耗电台灯',direction='neutral'))
        self.assertEqual(len(self.lane(q='台灯')),1);self.assertEqual(self.lane(q='无此产品'),[])
    def test_plan_closes_showcase_not_registration(self):
        self.s.set_phase('plan');self.assertEqual(self.get('/showcase').status_code,403);self.make(self.data(sources=[]))
        self.assertEqual(self.get('/public-data').status_code,200)
    def test_signup_migrates_contribution_owner(self):
        i=self.make();self.ok(self.post('/account/signup',{'username':'原访客测试','password':'Synthetic-test-pass-only'}))
        self.assertTrue(self.ok(self.get('/contributions/'+i))['is_mine']);self.assertEqual(len(self.ok(self.get('/contributions?mine=true'))),1)
    def test_delete_public_contribution_and_private_fk(self):
        self.make();private=self.company(False);self.make(self.data(company_id=private,public=False))
        self.ok(self.post('/account/delete',{'confirm':True}))
        self.assertEqual(self.ok(self.get('/contributions',self.d)),[]);self.assertEqual(self.ok(self.get('/public-data'))['record_count'],0)
    def test_account_export_own_contributions_only(self):
        self.make();self.make(self.data(title='他人私密测试',public=False),self.d)
        response=self.get('/account/export');self.assertEqual(response.status_code,200)
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:r=json.loads(archive.read('my-data.json'))
        self.assertEqual(len(r['contributions']),1)
    def test_bad_lanes_and_windows_reject(self):
        self.assertEqual(self.get('/showcase?lane=anything').status_code,400);self.assertEqual(self.get('/showcase?days=2').status_code,400)
    def test_rejected_author_can_appeal_to_review_queue(self):
        i=self.make();self.ok(self.rev(i,decision='reject'))
        self.ok(self.post('/contributions/'+i+'/flag',{'reason':'作者申请复核：范围理解可能有误。'}))
        self.assertEqual(self.ok(self.get('/review-queue',self.b))[0]['id'],i)
        self.ok(self.rev(i,decision='reopen'))
        self.assertEqual(self.ok(self.get('/contributions/'+i,self.d))['evidence'],'E0')
    def test_admin_grant_requires_credentials(self):self.assertEqual(self.post('/admin/reviewers',{'username':'事实核验员'}).status_code,403)

if __name__=='__main__':unittest.main()
