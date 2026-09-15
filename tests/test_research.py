"""Deterministic tests: mocked GLEIF responses, NOT evidence of live connectivity."""
import copy,json,tempfile,unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
import httpx
from fastapi.testclient import TestClient
from app.gleif_source import GleifClient,SourceError,collect,lei_value,record_projection,retry_seconds
from app.research import Store
from app.core import iso,utcnow,digest,empty_packet
from app.server import create_app

def make_lei(seed):
    prefix=('TEST'+str(seed).zfill(14))
    number=''.join(str(ord(c)-55) if c.isalpha() else c for c in prefix)+'00'
    return prefix+str(98-int(number)%97).zfill(2)
LEI=make_lei(1);PARENT=make_lei(2)
AT=datetime(2026,10,10,0,0,tzinfo=timezone.utc)
CHECKS={k:True for k in ('identity_checked','sources_checked','scope_checked','no_private_data','license_checked')}

def record(lei=LEI,name='Alpha Fixture Ltd',country='GB'):
    return {'id':lei,'attributes':{'lei':lei,'entity':{'legalName':{'name':name},
       'legalAddress':{'country':country,'addressLines':['NOT_PROJECTED_PRIVATE_LINE']},
       'jurisdiction':country,'status':'ACTIVE','category':'GENERAL'},
       'registration':{'status':'ISSUED','lastUpdateDate':'2026-09-01T00:00:00Z'}}}

def handler(request):
    path=request.url.path
    if path.endswith('direct-parent'):data=record(PARENT,'Parent Fixture Ltd')
    elif path.endswith('ultimate-parent'):return httpx.Response(404)
    elif path.endswith('/lei-records'):data=[record()]
    else:data=record()
    return httpx.Response(200,json={'data':data})

def factory(fn=handler,cache=None):
    return GleifClient(transport=httpx.MockTransport(fn),min_interval=0,cache=cache)

class SourceTests(unittest.TestCase):
    def co(self):return {'id':'co_test','name':'Alpha Fixture Ltd','region':'GB','registry_id':'LEI:'+LEI,'public':True,'synthetic':False}
    def test_no_network_by_default(self):
        with self.assertRaisesRegex(SourceError,'NETWORK_NOT_AUTHORIZED'):GleifClient().entity(LEI)
    def test_lei_validation(self):
        self.assertEqual(lei_value('LEI:'+LEI),LEI)
        for val in ('bad',LEI[:-2]+'99','https://example.invalid'):
            with self.subTest(val=val),self.assertRaises(ValueError):lei_value(val)
    def test_projection_drops_address(self):
        self.assertNotIn('NOT_PROJECTED',json.dumps(record_projection(record())))
    def test_sole_proprietor_not_projected(self):
        r=record();r['attributes']['entity']['category']='SOLE_PROPRIETOR'
        with self.assertRaisesRegex(SourceError,'NATURAL_PERSON'):record_projection(r)
    def test_schema_change(self):
        with self.assertRaises(SourceError):record_projection({'attributes':{}})
    def test_only_public_real(self):
        for changes in ({'synthetic':True},{'public':False}):
            with self.subTest(changes=changes),self.assertRaises(SourceError):collect(dict(self.co(),**changes),factory())
    def test_exact_lei_name_country_produces_draft(self):
        result=collect(self.co(),factory());packet=result['packet']
        self.assertEqual(result['state'],'DRAFT_READY');self.assertEqual(packet['review']['status'],'DRAFT')
        self.assertEqual(len(packet['sections']['identity']['items']),6)
        self.assertEqual(len(packet['sections']['ownership']['items']),1)
        self.assertEqual(packet['source_policy']['collection_mode'],'INJECTED_TEST_TRANSPORT')
        for key in ('business','facilities','supply_chain','work_conditions','channels'):self.assertEqual(packet['sections'][key]['items'],[])
    def test_unknown_parent_is_not_no_parent(self):
        p=collect(self.co(),factory())['packet'];self.assertIn('不推断无母公司',p['sections']['ownership']['gap'])
    def test_optional_rate_limit_stops_remaining_requests(self):
        calls=[]
        def limited(req):
            calls.append(str(req.url))
            if req.url.path.endswith('direct-parent'):return httpx.Response(429,headers={'retry-after':'7200'})
            return handler(req)
        client=factory(limited);p=collect(self.co(),client)['packet']
        self.assertEqual(len(calls),2);self.assertEqual(client.pause_seconds,7200)
        self.assertEqual(len(p['sections']['identity']['items']),6)
        self.assertIn('其余关系本轮不继续',p['sections']['ownership']['gap'])
    def test_optional_access_denied_stops_remaining_requests(self):
        calls=[]
        def denied(req):
            calls.append(str(req.url))
            return httpx.Response(403) if req.url.path.endswith('direct-parent') else handler(req)
        client=factory(denied);collect(self.co(),client)
        self.assertEqual(len(calls),2);self.assertTrue(client.access_denied)
    def test_plain_name_does_not_auto_match(self):
        r=collect(dict(self.co(),registry_id=''),factory());self.assertEqual(r['state'],'NEEDS_IDENTITY');self.assertIsNone(r['packet'])
    def test_name_and_region_conflicts(self):
        for changes in ({'name':'Wrong Company'},{'region':'US'},{'region':'London'}):
            with self.subTest(changes=changes):self.assertEqual(collect(dict(self.co(),**changes),factory())['state'],'NEEDS_IDENTITY')
    def test_redirect_denied(self):
        with self.assertRaisesRegex(SourceError,'UNEXPECTED_SOURCE_STATUS'):factory(lambda r:httpx.Response(302,headers={'location':'https://example.invalid'})).entity(LEI)
    def test_access_denied_is_final(self):
        for status in (401,403):
            with self.subTest(status=status),self.assertRaises(SourceError) as ex:factory(lambda r:httpx.Response(status)).entity(LEI)
            self.assertFalse(ex.exception.retryable)
    def test_rate_limit_keeps_retry_after(self):
        with self.assertRaises(SourceError) as ex:factory(lambda r:httpx.Response(429,headers={'retry-after':'3600'})).entity(LEI)
        self.assertTrue(ex.exception.retryable);self.assertEqual(ex.exception.retry_after,3600)
    def test_network_error_classified(self):
        def fail(r):raise httpx.ConnectError('HOST_CONTEXT_SHOULD_NOT_LEAK',request=r)
        with self.assertRaisesRegex(SourceError,'SOURCE_NETWORK_ERROR') as ex:factory(fail).entity(LEI)
        self.assertNotIn('HOST_CONTEXT',str(ex.exception))
    def test_timeout(self):
        def fail(r):raise httpx.ReadTimeout('timeout',request=r)
        with self.assertRaisesRegex(SourceError,'SOURCE_TIMEOUT'):factory(fail).entity(LEI)
    def test_non_json_and_broken_json(self):
        for resp in (httpx.Response(200,text='<html/>'),httpx.Response(200,content=b'{',headers={'content-type':'application/json'})):
            with self.subTest(resp=resp),self.assertRaises(SourceError):factory(lambda r:resp).entity(LEI)
    def test_content_bound(self):
        with self.assertRaisesRegex(SourceError,'SOURCE_TOO_LARGE'):factory(lambda r:httpx.Response(200,content=b'x'*2_000_001,headers={'content-type':'application/json'})).entity(LEI)
    def test_request_budget(self):
        f=factory();f.max_requests=1;f.entity(LEI)
        with self.assertRaisesRegex(SourceError,'JOB_BUDGET'):f.entity(LEI)
    def test_arbitrary_path_not_allowed(self):
        with self.assertRaises(SourceError):factory()._read('https://example.invalid')
    def test_identity_response_mismatch(self):
        with self.assertRaisesRegex(SourceError,'SOURCE_IDENTITY_MISMATCH'):factory(lambda r:httpx.Response(200,json={'data':record(PARENT)})).entity(LEI)
    def test_parent_failure_keeps_identity(self):
        def partial(r):return httpx.Response(503) if r.url.path.endswith('parent') else handler(r)
        p=collect(self.co(),factory(partial))['packet'];self.assertTrue(p['sections']['identity']['items']);self.assertFalse(p['sections']['ownership']['items'])
    def test_retry_header(self):
        self.assertEqual(retry_seconds('bad'),0);self.assertEqual(retry_seconds('-1'),0)
        self.assertEqual(retry_seconds('Sat, 10 Oct 2026 01:00:00 GMT',AT),3600)

class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.store=Store(Path(self.tmp.name)/'state.sqlite3')
    def tearDown(self):self.tmp.cleanup()
    def register(self,**kw):
        p={'name':'Alpha Fixture Ltd','region':'GB','registry_id':'LEI:'+LEI,'needs':['help'],
           'public':True,'synthetic':False,'consent':True};p.update(kw)
        return self.store.register('PRIVATE_OWNER',p,'request-'+str(len(self.store.mine('PRIVATE_OWNER')['requests'])),AT-timedelta(days=2))
    def run_one(self,at=AT,fn=handler,**kw):return self.store.run_research(at=at,client_factory=lambda:factory(fn),**kw)
    def approve(self):
        task=self.store.task_list()[0];run=task['run']
        return self.store.review_research(run['id'],run['packet_hash'],'operator:test','已逐项检查模拟来源和范围',CHECKS,AT)
    def test_end_to_end_review_release(self):
        r=self.register();out=self.run_one();self.assertEqual(out['runs'][0]['state'],'DRAFT_READY')
        self.assertEqual(self.store.release(AT),[]);self.approve();pub=self.store.release(AT)
        self.assertEqual(len(pub),1);self.assertEqual(pub[0]['covered_sections'],2)
        self.assertEqual(self.store.release(AT),[])
        co=self.store.company(r['company_id'],'public-reader');self.assertEqual(co['research_progress']['state'],'PUBLISHED')
        self.assertNotIn('PRIVATE_OWNER',json.dumps(co));self.assertNotIn('NOT_PROJECTED',json.dumps(co))
    def test_early_release_waits(self):
        r=self.register();self.run_one();self.approve()
        self.assertEqual(self.store.release(datetime.fromisoformat(r['due_at'])-timedelta(seconds=1)),[])
    def test_default_no_authorization(self):
        self.register()
        with self.assertRaises(PermissionError):self.store.run_research()
    def test_private_and_synthetic_never_queued(self):
        self.register(public=False);self.register(synthetic=True);self.assertEqual(self.store.task_list(),[])
    def test_draft_cannot_self_approve_via_prepare(self):
        r=self.register();self.run_one();p=self.store.task_list()[0]['run']['packet'];p['review']={'status':'APPROVED','reviewer':'fake'}
        with self.assertRaises(ValueError):self.store.prepare(r['company_id'],r['batch_day'],p)
    def test_review_hash_and_checks(self):
        self.register();self.run_one();run=self.store.task_list()[0]['run']
        for expected,checks in [('0'*64,CHECKS),(run['packet_hash'],dict(CHECKS,no_private_data=False))]:
            with self.subTest(expected=expected,checks=checks),self.assertRaises(ValueError):self.store.review_research(run['id'],expected,'operator','复核理由足够长的测试',checks)
    def test_approve_idempotence(self):
        self.register();self.run_one();self.assertFalse(self.approve()['idempotent']);self.assertTrue(self.approve()['idempotent'])
    def test_no_collector_self_approval(self):
        self.register();self.run_one();r=self.store.task_list()[0]['run']
        with self.assertRaises(ValueError):self.store.review_research(r['id'],r['packet_hash'],'collector:gleif','测试不允许自我批准资料',CHECKS)
    def test_tampered_approval_stops_release(self):
        self.register();self.run_one();self.approve()
        with self.store.db() as c:c.execute("UPDATE research_reviews SET approved_packet='{}'")
        with self.assertRaises(ValueError):self.store.release(AT)
    def test_missing_data_does_not_consume_job(self):
        r=self.register();out=self.run_one(fn=lambda r:httpx.Response(503));self.assertEqual(out['runs'][0]['state'],'RETRY_WAIT')
        self.assertEqual(self.store.release(AT+timedelta(days=1)),[])
        self.run_one(AT+timedelta(days=1));self.approve();self.assertEqual(len(self.store.release(AT+timedelta(days=1))),1)
        self.assertTrue(self.store.company(r['company_id'],'x')['snapshots'])
    def test_old_backlog_not_dropped(self):
        self.register();self.run_one(at=AT+timedelta(days=30));self.approve();self.assertEqual(len(self.store.release(AT+timedelta(days=31))),1)
    def test_retry_after_not_ignored(self):
        self.register();self.run_one(fn=lambda r:httpx.Response(429,headers={'retry-after':'7200'}))
        self.assertEqual(self.run_one(at=AT+timedelta(hours=1))['runs'],[])
        self.assertEqual(self.run_one(at=AT+timedelta(hours=2))['runs'][0]['state'],'DRAFT_READY')
    def test_retry_cap_and_manual_reopen(self):
        self.register()
        for i in range(3):self.run_one(at=AT+timedelta(days=i),fn=lambda r:httpx.Response(503))
        t=self.store.task_list()[0];self.assertEqual(t['state'],'FAILED_FINAL')
        self.assertEqual(self.run_one(at=AT+timedelta(days=4))['runs'],[])
        self.store.reopen_research(t['job_id'],'operator','来源恢复，重新发起有限检查',AT+timedelta(days=4))
        self.assertEqual(self.run_one(at=AT+timedelta(days=4))['runs'][0]['state'],'DRAFT_READY')
    def test_rate_limit_pauses_other_jobs_persistently(self):
        self.register();self.register()
        def limited(req):
            return httpx.Response(429,headers={'retry-after':'7200'}) if req.url.path.endswith('direct-parent') else handler(req)
        result=self.run_one(fn=limited,max_jobs=3)
        self.assertEqual(len(result['runs']),1)
        self.assertEqual(self.run_one(at=AT+timedelta(hours=1),max_jobs=3)['runs'],[])
        self.assertEqual(len(self.run_one(at=AT+timedelta(hours=2),max_jobs=3)['runs']),1)
    def test_legacy_prepared_real_packet_does_not_skip_review(self):
        r=self.register()
        with self.store.db() as c:
            c.execute('DELETE FROM research_tasks')
            c.execute("UPDATE jobs SET status='PREPARED',packet=?",(json.dumps(empty_packet({'id':r['company_id'],'synthetic':False})),))
        self.assertEqual(self.store.release(AT+timedelta(days=2)),[])
        self.assertEqual(self.store.task_list()[0]['state'],'QUEUED')
    def test_daily_budget(self):
        self.register();self.register();self.assertEqual(len(self.run_one(daily_budget=6,max_jobs=3)['runs']),1)
        self.assertEqual(self.run_one(daily_budget=6)['runs'],[])
    def test_open_calendar_day_waits(self):
        self.store.register('x',{'name':'Alpha Fixture Ltd','region':'GB','registry_id':'LEI:'+LEI,'needs':['company'],'public':True,'synthetic':False,'consent':True},'current-day',AT)
        self.assertEqual(self.run_one()['runs'],[])
        self.assertEqual(len(self.run_one(include_current=True)['runs']),1)
    def test_lease_recovery(self):
        self.register()
        with self.store.db() as c:c.execute("UPDATE research_tasks SET state='RUNNING',attempts=1,lease_token='dead',lease_until=?",(iso(AT-timedelta(minutes=1)),))
        self.assertEqual(self.run_one()['runs'][0]['state'],'DRAFT_READY')
        with self.store.db() as c:self.assertEqual(c.execute('SELECT count(*) FROM research_events').fetchone()[0],1)
    def test_stale_worker_cannot_overwrite(self):
        self.register()
        def replaced(req):
            with self.store.db() as c:c.execute("UPDATE research_tasks SET lease_token='new-worker'")
            return handler(req)
        self.assertEqual(self.run_one(fn=replaced)['runs'][0]['state'],'STALE_RESULT_DISCARDED')
    def test_bind_candidate_then_retry(self):
        self.register(registry_id='');self.run_one();r=self.store.task_list()[0]['run']
        with self.assertRaises(ValueError):self.store.bind_identity(r['id'],PARENT,'operator','不能随便选择没有的主体',AT)
        self.store.bind_identity(r['id'],LEI,'operator','已核对名称国家及该标识记录',AT)
        self.assertEqual(self.run_one()['runs'][0]['state'],'DRAFT_READY')
    def test_cache_preserves_fetch_time_and_no_second_network(self):
        one=factory(cache=self.store._cache);a,s=one.entity(LEI)
        two=factory(lambda r:(_ for _ in ()).throw(AssertionError('must hit cache')),cache=self.store._cache);b,t=two.entity(LEI)
        self.assertEqual(a,b);self.assertEqual(s['accessed_at'],t['accessed_at']);self.assertEqual(two.calls,0);self.assertTrue(t['cached'])
    def test_corrupt_cache_not_used(self):
        one=factory(cache=self.store._cache);one.entity(LEI)
        with self.store.db() as c:c.execute("UPDATE research_cache SET body_hash='bad'")
        two=factory(cache=self.store._cache);two.entity(LEI);self.assertEqual(two.calls,1)
    def test_reopen_store_preserves_state(self):
        self.register();self.run_one();other=Store(self.store.path);self.assertEqual(other.task_list()[0]['state'],'DRAFT_READY')
    def test_no_private_fields_sent(self):
        self.register(website='https://private.invalid/context');urls=[]
        def observed(r):urls.append(str(r.url));return handler(r)
        self.run_one(fn=observed)
        text=' '.join(urls);self.assertNotIn('PRIVATE_OWNER',text);self.assertNotIn('private.invalid',text);self.assertNotIn('help',text)
    def test_legacy_no_data_recovery_keeps_snapshot(self):
        r=self.register()
        with self.store.db() as c:
            c.execute('DELETE FROM research_tasks')
            c.execute("UPDATE jobs SET status='SOURCE_UNAVAILABLE'")
            p=empty_packet({'id':r['company_id'],'synthetic':False})
            c.execute('INSERT INTO snapshots VALUES (?,?,?,?,?,?,?)',('legacy',r['company_id'],r['batch_day'],iso(AT-timedelta(days=1)),json.dumps(p),digest(p),'SOURCE_UNAVAILABLE'))
        self.store.sync_research();self.run_one();self.approve();self.store.release(AT)
        self.assertEqual(len(self.store.company(r['company_id'],'x')['snapshots']),2)

    def test_scheduler_release_only_publishes_approved_without_network(self):
        r=self.register();self.run_one();self.approve()
        out=self.store.scheduler_cycle(worker_id='release-only',allow_network=False,at=AT,interval_seconds=60)
        self.assertEqual(out['research']['runs'],[]);self.assertEqual(len(out['released']),1)
        self.assertEqual(self.store.company(r['company_id'],'reader')['research_progress']['state'],'PUBLISHED')

    def test_scheduler_cycle_with_injected_source_records_heartbeat(self):
        self.register();out=self.store.scheduler_cycle(worker_id='worker-a',client_factory=lambda:factory(handler),at=AT,interval_seconds=60)
        self.assertEqual(out['research']['runs'][0]['state'],'DRAFT_READY')
        status=self.store.scheduler_status(AT);self.assertTrue(status['active']);self.assertEqual(status['worker']['worker_id'],'worker-a')
        self.assertEqual(status['states']['DRAFT_READY'],1)

    def test_scheduler_heartbeat_expires(self):
        self.store._scheduler_heartbeat('worker-a','RELEASE_ONLY',60,{'ok':True},AT)
        self.assertTrue(self.store.scheduler_status(AT+timedelta(seconds=179))['active'])
        self.assertFalse(self.store.scheduler_status(AT+timedelta(seconds=181))['active'])

    def test_overdue_notice_is_deduplicated(self):
        r=self.register();due=datetime.fromisoformat(r['due_at']);first=self.store.emit_overdue_notices(due+timedelta(seconds=1))
        second=self.store.emit_overdue_notices(due+timedelta(days=2))
        self.assertEqual(len(first),1);self.assertEqual(second,[])
        notices=self.store.dashboard('PRIVATE_OWNER')['notices'];self.assertEqual(len(notices),1);self.assertIn('不会用猜测补齐',notices[0]['body'])

    def test_real_publication_notifies_requester_once(self):
        self.register();self.run_one();self.approve();self.store.release(AT);self.store.release(AT)
        notices=self.store.dashboard('PRIVATE_OWNER')['notices']
        self.assertEqual(len(notices),1);self.assertIn('首版公开资料已经更新',notices[0]['body'])

    def test_real_publication_notifies_follower_without_private_context(self):
        r=self.register();self.store.follow(r['company_id'],'FOLLOWER',True);self.run_one();self.approve();self.store.release(AT)
        body=self.store.dashboard('FOLLOWER')['notices'][0]['body']
        self.assertIn('首版公开资料已经更新',body);self.assertNotIn('PRIVATE_OWNER',body);self.assertNotIn('help',body)

    def test_scheduler_status_projection_has_no_requester_private_fields(self):
        self.register(website='https://private.invalid/user-context')
        raw=json.dumps(self.store.scheduler_status(AT),ensure_ascii=False)
        self.assertNotIn('PRIVATE_OWNER',raw);self.assertNotIn('private.invalid',raw);self.assertNotIn('help',raw)

    def test_scheduler_interval_bounds(self):
        for seconds in (59,3601):
            with self.subTest(seconds=seconds),self.assertRaises(ValueError):
                self.store.scheduler_cycle(interval_seconds=seconds,at=AT)

class ResearchAPITests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.app=create_app(Path(self.tmp.name)/'api.sqlite3',admin_token='admin-test',public_research=True,research_network=True,research_client_factory=factory)
        self.client=TestClient(self.app);self.client.get('/api/config')
        self.headers={'x-ltp-client':'local-demo','authorization':'Bearer admin-test'}
    def tearDown(self):self.client.close();self.tmp.cleanup()
    def register(self,public=True):
        return self.client.post('/api/requests',headers=dict(self.headers,**{'idempotency-key':'api-research-01'}),json={'name':'Alpha Fixture Ltd','region':'GB','registry_id':'LEI:'+LEI,'needs':['company'],'public':public,'consent':True,'synthetic':False})
    def test_real_registration_opt_in(self):self.assertEqual(self.register().status_code,200)
    def test_private_real_not_allowed(self):self.assertEqual(self.register(False).status_code,400)
    def test_queue_admin_only(self):self.assertEqual(self.client.get('/api/admin/research').status_code,403)
    def test_api_explicit_network_consent(self):
        self.register();r=self.client.post('/api/admin/research/run',headers=self.headers,json={'allow_network':False});self.assertEqual(r.status_code,403)
    def test_draft_review_api(self):
        self.register();result=self.client.post('/api/admin/research/run',headers=self.headers,json={'allow_network':True,'include_current':True})
        self.assertEqual(result.status_code,200,result.text)
        q=self.client.get('/api/admin/research',headers=self.headers).json();r=q['tasks'][0]['run']
        payload={'expected_hash':r['packet_hash'],'reason':'已核查模拟来源字段和归属范围','checks':CHECKS}
        self.assertEqual(self.client.post('/api/admin/research/runs/'+r['id']+'/approve',json=payload,headers=self.headers).status_code,200)
    def test_no_arbitrary_collection_url_field(self):
        r=self.client.post('/api/admin/research/run',headers=self.headers,json={'allow_network':True,'url':'https://example.invalid'})
        self.assertEqual(r.status_code,422)
    def test_config_not_claim_scheduled(self):
        r=self.client.get('/api/config').json();self.assertFalse(r['scheduler_installed']);self.assertTrue(r['public_research_mode'])

    def test_scheduler_health_admin_only(self):
        self.assertEqual(self.client.get('/api/admin/research/health').status_code,403)
        r=self.client.get('/api/admin/research/health',headers=self.headers);self.assertEqual(r.status_code,200);self.assertIn('states',r.json())

    def test_queue_exposes_bounded_scheduler_status(self):
        r=self.client.get('/api/admin/research',headers=self.headers).json();self.assertIn('scheduler',r);self.assertFalse(r['scheduler']['active'])

    def test_config_scheduler_reflects_recent_heartbeat(self):
        self.assertFalse(self.client.get('/api/config').json()['scheduler_installed'])
        self.app.state.store._scheduler_heartbeat('test-worker','RELEASE_ONLY',300,{'released':[]},utcnow())
        self.assertTrue(self.client.get('/api/config').json()['scheduler_installed'])

if __name__=='__main__':unittest.main()
