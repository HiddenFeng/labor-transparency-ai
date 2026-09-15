"""Persistent bounded research, immutable drafts, review, and recoverable release.

No daemon is started on import. User stories, identifiers and private-case files
are never in the provider input. Publishing means local app publication, not GitHub.
"""
from __future__ import annotations
import json
import hashlib
from datetime import datetime, timedelta
from .community import Store as CommunityStore
from .core import digest, uid, iso, utcnow, validate_packet
from .gleif_source import GleifClient, SourceError, collect, lei_value
from .company_intelligence import CompanyIntelligenceClient, collect_company_intelligence
from .company_source_registry import source_registry

LABELS={'QUEUED':'等待资料整理','RUNNING':'正在查询公开资料','RETRY_WAIT':'来源暂时不可用，已保留补齐任务',
        'NEEDS_IDENTITY':'需要确认是同一家公司','DRAFT_READY':'已取得部分资料，等待核对',
        'APPROVED':'已核对，等待公布','PUBLISHED':'本批次资料已公布','FAILED_FINAL':'本轮查询停止，需要人工处理'}

class Store(CommunityStore):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs)
        with self.db() as c:
            c.executescript('''
            CREATE TABLE IF NOT EXISTS research_tasks(
              job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
              state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
              next_at TEXT NOT NULL, lease_token TEXT, lease_until TEXT,
              latest_run TEXT, last_code TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS research_runs(
              id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
              started_at TEXT NOT NULL, finished_at TEXT NOT NULL, mode TEXT NOT NULL,
              state TEXT NOT NULL, packet TEXT, packet_hash TEXT NOT NULL,
              candidates TEXT NOT NULL, observations TEXT NOT NULL, requests INTEGER NOT NULL,
              cache_hits INTEGER NOT NULL, reason TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS research_reviews(
              run_id TEXT PRIMARY KEY REFERENCES research_runs(id) ON DELETE CASCADE,
              reviewer TEXT NOT NULL, approved_at TEXT NOT NULL, reason TEXT NOT NULL,
              original_hash TEXT NOT NULL, approved_packet TEXT NOT NULL, approved_hash TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS research_bindings(
              company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
              lei TEXT NOT NULL, legal_name TEXT NOT NULL, country TEXT NOT NULL,
              reviewer TEXT NOT NULL, reason TEXT NOT NULL, bound_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS research_external_bindings(
              company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
              provider TEXT NOT NULL, external_id TEXT NOT NULL, label TEXT NOT NULL, region TEXT NOT NULL,
              reviewer TEXT NOT NULL, reason TEXT NOT NULL, bound_at TEXT NOT NULL,
              PRIMARY KEY(company_id,provider));
            CREATE TABLE IF NOT EXISTS research_source_pause(provider TEXT PRIMARY KEY, resume_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS research_daily_budget(day TEXT PRIMARY KEY, reserved_requests INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS research_cache(url TEXT PRIMARY KEY, body BLOB NOT NULL,
              fetched_at TEXT NOT NULL, body_hash TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS research_events(id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
              kind TEXT NOT NULL, code TEXT NOT NULL, at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS research_notice_events(
              job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
              kind TEXT NOT NULL, marker TEXT NOT NULL, created_at TEXT NOT NULL,
              PRIMARY KEY(job_id,kind,marker));
            CREATE TABLE IF NOT EXISTS research_scheduler(
              worker_id TEXT PRIMARY KEY, mode TEXT NOT NULL, started_at TEXT NOT NULL,
              heartbeat_at TEXT NOT NULL, last_cycle_at TEXT NOT NULL, interval_seconds INTEGER NOT NULL,
              last_result TEXT NOT NULL, last_error TEXT NOT NULL DEFAULT '');
            ''')
        self.sync_research()

    def sync_research(self):
        """Real public jobs stay outside the legacy synthetic release path."""
        now=iso(utcnow())
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            rows=c.execute("SELECT j.* FROM jobs j JOIN companies co ON co.id=j.company_id WHERE co.synthetic=0 AND co.public=1 AND j.status IN ('QUEUED','PREPARED','SOURCE_UNAVAILABLE','RESEARCH_PENDING')").fetchall()
            for j in rows:
                c.execute("INSERT OR IGNORE INTO research_tasks(job_id,state,next_at,updated_at) VALUES (?,'QUEUED',?,?)",(j['id'],now,now))
                c.execute("UPDATE jobs SET status='RESEARCH_PENDING' WHERE id=?",(j['id'],))

    def register(self,*args,**kwargs):
        result=super().register(*args,**kwargs);self.sync_research()
        with self.db() as c:
            return self._receipt(c,c.execute('SELECT * FROM requests WHERE id=?',(result['id'],)).fetchone())

    def _company_input(self,c,j):
        # Deliberately not SELECT requests.* or website: no intents or arbitrary URLs.
        row=c.execute('SELECT id,name,region,registry_id,public,synthetic FROM companies WHERE id=?',(j['company_id'],)).fetchone()
        if not row or row['synthetic'] or not row['public']: raise PermissionError('仅允许研究公开的真实企业资料')
        return dict(row)

    def _external_bindings(self, company_id):
        with self.db() as c:
            rows=c.execute('SELECT * FROM research_external_bindings WHERE company_id=? ORDER BY provider',(company_id,)).fetchall()
        return {r['provider']:dict(r) for r in rows}

    def source_registry(self):
        return source_registry()

    def task_list(self):
        with self.db() as c:
            rows=c.execute('''SELECT t.*,j.company_id,j.batch_day,j.due_at,co.name FROM research_tasks t
              JOIN jobs j ON j.id=t.job_id JOIN companies co ON co.id=j.company_id ORDER BY j.due_at,t.job_id''').fetchall()
            result=[]
            for row in rows:
                r=dict(row);r.pop('lease_token',None)
                run=c.execute('SELECT * FROM research_runs WHERE id=?',(r['latest_run'],)).fetchone()
                if run:
                    run=dict(run)
                    for k in ('packet','candidates','observations'):run[k]=json.loads(run[k]) if run[k] else None
                    r['run']=run
                result.append(r)
            return result

    def company(self,cid,owner):
        co=super().company(cid,owner)
        with self.db() as c:
            row=c.execute('''SELECT t.state,t.last_code,t.updated_at,t.next_at,j.due_at
                 FROM research_tasks t JOIN jobs j ON j.id=t.job_id WHERE j.company_id=? ORDER BY j.batch_day DESC LIMIT 1''',(cid,)).fetchone()
        if row:
            if not co['snapshots']:co['status']='RESEARCH_PENDING'
            co['research_progress']={'state':row['state'],'label':LABELS[row['state']],
                'updated_at':row['updated_at'],'target_at':row['due_at'],
                'overdue':row['due_at']<iso(utcnow()) and row['state']!='PUBLISHED',
                'note':'已公开资料不会因本轮来源失败而变成最新调查；没有资料不影响已开放功能。'}
        return co

    def _cache(self,action,url,value):
        with self.db() as c:
            if action=='get':
                row=c.execute('SELECT * FROM research_cache WHERE url=?',(url,)).fetchone()
                if not row:return None
                if datetime.fromisoformat(row['fetched_at'])<utcnow()-timedelta(hours=24):return None
                raw=bytes(row['body'])
                if hashlib.sha256(raw).hexdigest()!=row['body_hash']:return None
                return raw,row['fetched_at']
            raw,fetched=value
            c.execute('INSERT OR REPLACE INTO research_cache VALUES (?,?,?,?)',(url,raw,fetched,hashlib.sha256(raw).hexdigest()))
            c.execute('DELETE FROM research_cache WHERE fetched_at<?',(iso(utcnow()-timedelta(days=2)),))

    def _claim(self,at,max_attempts,daily_budget,include_current,reserved_requests=6):
        local_day=str(at.astimezone(self.tz).date());stamp=iso(at)
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            # Reclaim abandoned leases. Old workers are fenced by a unique lease token.
            stale=c.execute("SELECT job_id,attempts FROM research_tasks WHERE state='RUNNING' AND lease_until<=?",(stamp,)).fetchall()
            for row in stale:
                status='FAILED_FINAL' if row['attempts']>=max_attempts else 'RETRY_WAIT'
                c.execute('UPDATE research_tasks SET state=?,lease_token=NULL,lease_until=NULL,next_at=?,last_code=?,updated_at=? WHERE job_id=?',
                          (status,stamp,'LEASE_EXPIRED',stamp,row['job_id']))
                c.execute('INSERT INTO research_events VALUES (?,?,?,?,?)',(uid('evt'),row['job_id'],'RECOVERY','LEASE_EXPIRED',stamp))
            pause=c.execute("SELECT resume_at FROM research_source_pause WHERE provider='GLEIF'").fetchone()
            if pause and pause[0]>stamp:return None
            rows=c.execute('''SELECT t.*,j.company_id,j.batch_day,j.due_at FROM research_tasks t JOIN jobs j ON j.id=t.job_id
             WHERE t.state IN ('QUEUED','RETRY_WAIT') AND t.next_at<=? AND t.attempts<? ORDER BY j.due_at,t.job_id''',(stamp,max_attempts)).fetchall()
            for row in rows:
                if not include_current and row['batch_day']>=local_day:continue
                co=self._company_input(c,row)
                used=c.execute('SELECT reserved_requests FROM research_daily_budget WHERE day=?',(local_day,)).fetchone()
                if (used[0] if used else 0)+reserved_requests>daily_budget:return None
                c.execute('INSERT INTO research_daily_budget VALUES (?,?) ON CONFLICT(day) DO UPDATE SET reserved_requests=reserved_requests+excluded.reserved_requests',(local_day,reserved_requests))
                token=uid('lease')
                c.execute("UPDATE research_tasks SET state='RUNNING',attempts=attempts+1,lease_token=?,lease_until=?,updated_at=? WHERE job_id=?",
                          (token,iso(at+timedelta(minutes=3)),stamp,row['job_id']))
                binding=c.execute('SELECT * FROM research_bindings WHERE company_id=?',(co['id'],)).fetchone()
                return dict(row),co,token,dict(binding) if binding else None
        return None

    def run_research(self,*,allow_network=False,max_jobs=5,max_attempts=3,daily_budget=120,
                     include_current=False,at=None,client_factory=None):
        if not allow_network and client_factory is None:raise PermissionError('尚未明确授权本次公开来源查询')
        if not 1<=max_jobs<=20 or not 1<=max_attempts<=5 or not 6<=daily_budget<=3000:raise ValueError('研究配额不合法')
        frozen_at=at;self.sync_research();results=[];reserved_per_job=6;source_mode='MULTI_SOURCE' if client_factory is None else 'INJECTED_TEST_CLIENT'
        for _ in range(max_jobs):
            at=frozen_at or utcnow()
            client=client_factory() if client_factory else CompanyIntelligenceClient.live(cache=self._cache)
            reserved_per_job=6 if isinstance(client,GleifClient) else int(getattr(client,'max_requests_total',18))
            if daily_budget < reserved_per_job:raise ValueError('研究配额不足以覆盖本轮来源预算')
            claim=self._claim(at,max_attempts,daily_budget,include_current,reserved_per_job)
            if claim is None:break
            job,company,token,binding=claim
            attempt=job['attempts']+1;next_at=at;reason='';state='FAILED_FINAL';packet=None;candidates=[];code=''
            try:
                if isinstance(client,GleifClient):
                    out=collect(company,client,binding)
                else:
                    out=collect_company_intelligence(company,client,binding,self._external_bindings(company['id']))
                state,packet,candidates,reason=out['state'],out['packet'],out['candidates'],out['reason']
            except SourceError as exc:
                code=exc.code
                state='RETRY_WAIT' if exc.retryable and attempt<max_attempts else 'FAILED_FINAL'
                next_at=at+timedelta(seconds=max(900*2**(attempt-1),exc.retry_after))
                reason='本轮未获得可发布资料；原始错误码仅供运营处理。'
            except Exception:
                # No exception text: it may contain a query, credential or private value.
                code='COLLECTOR_INTERNAL_ERROR';state='FAILED_FINAL';reason='适配器出现未处理错误，需人工检查。'
            finished=at if client_factory else utcnow();run_id=uid('run')
            raw=json.dumps(packet,ensure_ascii=False,sort_keys=True) if packet else None
            with self.db() as c:
                c.execute('BEGIN IMMEDIATE')
                if client.pause_seconds:
                    resume=iso(finished+timedelta(seconds=client.pause_seconds))
                    c.execute("INSERT INTO research_source_pause VALUES ('GLEIF',?) ON CONFLICT(provider) DO UPDATE SET resume_at=MAX(resume_at,excluded.resume_at)",(resume,))
                task=c.execute('SELECT * FROM research_tasks WHERE job_id=?',(job['job_id'],)).fetchone()
                if not task or task['lease_token']!=token:
                    results.append({'job_id':job['job_id'],'state':'STALE_RESULT_DISCARDED'});continue
                if task['lease_until']<iso(finished):
                    c.execute("UPDATE research_tasks SET state=?,lease_token=NULL,lease_until=NULL,next_at=?,last_code='LEASE_EXPIRED',updated_at=? WHERE job_id=?",('FAILED_FINAL' if attempt>=max_attempts else 'RETRY_WAIT',iso(finished),iso(finished),job['job_id']))
                    results.append({'job_id':job['job_id'],'state':'LEASE_EXPIRED'});continue
                c.execute('INSERT INTO research_runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    (run_id,job['job_id'],iso(at),iso(finished),client.mode,state,raw,digest(packet) if packet else '',
                     json.dumps(candidates,ensure_ascii=False),json.dumps(client.observations,ensure_ascii=False),
                     client.calls,client.cache_hits,code or reason))
                c.execute('UPDATE research_tasks SET state=?,next_at=?,lease_token=NULL,lease_until=NULL,latest_run=?,last_code=?,updated_at=? WHERE job_id=?',
                          (state,iso(next_at),run_id,code,iso(finished),job['job_id']))
            results.append({'job_id':job['job_id'],'run_id':run_id,'state':state,'code':code,
                            'requests':client.calls,'cache_hits':client.cache_hits,'mode':client.mode})
            if client.pause_seconds or client.access_denied:break
        return {'runs':results,'network_authorized':allow_network,'scheduler_installed':False,
                'scope':'FINITE_LOCAL_RESEARCH','reserved_requests_per_job':reserved_per_job,
                'source_mode':source_mode}

    def bind_identity(self,run_id,lei,reviewer,reason,at=None):
        lei=lei_value(lei);at=at or utcnow()
        if len(reason.strip())<8 or not reviewer:raise ValueError('请说明主体匹配依据')
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            run=c.execute('SELECT * FROM research_runs WHERE id=?',(run_id,)).fetchone()
            if not run:raise LookupError('研究记录不存在')
            task=c.execute('SELECT * FROM research_tasks WHERE job_id=?',(run['job_id'],)).fetchone()
            if task['latest_run']!=run_id or task['state']!='NEEDS_IDENTITY':raise ValueError('该候选不是当前待核对版本')
            candidates=json.loads(run['candidates']);candidate=next((r for r in candidates if r['lei']==lei),None)
            if not candidate:raise ValueError('只能选择本次来源返回的候选，不能凭空绑定')
            job=c.execute('SELECT * FROM jobs WHERE id=?',(run['job_id'],)).fetchone()
            c.execute('INSERT OR REPLACE INTO research_bindings VALUES (?,?,?,?,?,?,?)',
                (job['company_id'],lei,candidate['name'],candidate['country'],reviewer,reason.strip(),iso(at)))
            c.execute("UPDATE research_tasks SET state='QUEUED',next_at=?,attempts=0,updated_at=? WHERE job_id=?",(iso(at),iso(at),job['id']))
        return {'bound':True,'company_id':job['company_id'],'lei':lei}

    def bind_external_source(self,run_id,provider,external_id,reviewer,reason,at=None):
        at=at or utcnow();provider=str(provider or '').strip().upper();external_id=str(external_id or '').strip()
        allowed={'SEC_EDGAR','WIKIDATA','NLRB_CASES','OSHA_ENFORCEMENT','DOL_WHD','FMCS_F7','NLRB_VOLUNTARY_RECOGNITION','FMCS_WORK_STOPPAGES','OLMS_LM20','USA_SPENDING','OPENCORPORATES','OPEN_SUPPLY_HUB'}
        if provider not in allowed:raise ValueError('该来源不支持当前绑定流程')
        if not external_id or len(external_id)>300 or len(reason.strip())<8 or not reviewer:raise ValueError('来源绑定参数或理由无效')
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            run=c.execute('SELECT * FROM research_runs WHERE id=?',(run_id,)).fetchone()
            if not run:raise LookupError('研究记录不存在')
            task=c.execute('SELECT * FROM research_tasks WHERE job_id=?',(run['job_id'],)).fetchone()
            if task['latest_run']!=run_id or task['state'] not in ('DRAFT_READY','NEEDS_IDENTITY','QUEUED'):raise ValueError('只能绑定当前研究版本返回的来源候选')
            candidates=json.loads(run['candidates'] or '[]')
            candidate=next((x for x in candidates if x.get('provider')==provider and str(x.get('external_id'))==external_id),None)
            if not candidate:raise ValueError('只能绑定本次来源实际返回的候选，不能凭空指定')
            job=c.execute('SELECT * FROM jobs WHERE id=?',(run['job_id'],)).fetchone()
            c.execute('''INSERT INTO research_external_bindings VALUES (?,?,?,?,?,?,?,?)
              ON CONFLICT(company_id,provider) DO UPDATE SET external_id=excluded.external_id,label=excluded.label,region=excluded.region,reviewer=excluded.reviewer,reason=excluded.reason,bound_at=excluded.bound_at''',
              (job['company_id'],provider,external_id,str(candidate.get('label') or external_id),str(candidate.get('region') or ''),reviewer,reason.strip(),iso(at)))
            c.execute("UPDATE research_tasks SET state='QUEUED',next_at=?,attempts=0,updated_at=? WHERE job_id=?",(iso(at),iso(at),job['id']))
        return {'bound':True,'company_id':job['company_id'],'provider':provider,'external_id':external_id}

    def review_research(self,run_id,expected_hash,reviewer,reason,checks,at=None):
        at=at or utcnow()
        if not reviewer or reviewer.startswith('collector:') or len(reason.strip())<8:raise ValueError('需要独立的运营复核与具体理由')
        required={'identity_checked','sources_checked','scope_checked','no_private_data','license_checked'}
        if set(checks)!=required or any(checks[k] is not True for k in required):raise ValueError('需完成主体、来源、范围、隐私及许可检查')
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            run=c.execute('SELECT * FROM research_runs WHERE id=?',(run_id,)).fetchone()
            if not run:raise LookupError('研究记录不存在')
            task=c.execute('SELECT * FROM research_tasks WHERE job_id=?',(run['job_id'],)).fetchone()
            if task['latest_run']!=run_id or task['state'] not in ('DRAFT_READY','APPROVED'):raise ValueError('只能复核当前待发布草稿')
            if not run['packet']:raise ValueError('没有可核对的资料')
            packet=json.loads(run['packet'])
            if expected_hash!=run['packet_hash'] or digest(packet)!=expected_hash:raise ValueError('草稿版本已变化，请重新打开核对')
            old=c.execute('SELECT * FROM research_reviews WHERE run_id=?',(run_id,)).fetchone()
            if old:return {'approved':True,'digest':old['approved_hash'],'idempotent':True}
            packet['review']={'status':'APPROVED','reviewer':reviewer,'reviewed_at':iso(at),'reason':reason.strip(),'checks':checks,'run_id':run_id}
            job=c.execute('SELECT * FROM jobs WHERE id=?',(run['job_id'],)).fetchone()
            company=self._company_input(c,job);validate_packet(packet,company)
            approved_hash=digest(packet)
            c.execute('INSERT INTO research_reviews VALUES (?,?,?,?,?,?,?)',
                (run_id,reviewer,iso(at),reason.strip(),expected_hash,json.dumps(packet,ensure_ascii=False),approved_hash))
            c.execute("UPDATE research_tasks SET state='APPROVED',updated_at=? WHERE job_id=?",(iso(at),job['id']))
        return {'approved':True,'digest':approved_hash,'idempotent':False}

    def reopen_research(self,job_id,reviewer,reason,at=None):
        at=at or utcnow()
        if not reviewer or len(reason.strip())<8:raise ValueError('请记录重新处理的具体原因')
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            t=c.execute('SELECT * FROM research_tasks WHERE job_id=?',(job_id,)).fetchone()
            if not t or t['state'] not in ('FAILED_FINAL','RETRY_WAIT'):raise ValueError('只有失败或等待重试的任务可恢复')
            c.execute("UPDATE research_tasks SET state='QUEUED',attempts=0,next_at=?,last_code='',updated_at=? WHERE job_id=?",(iso(at),iso(at),job_id))
            c.execute('INSERT INTO research_events VALUES (?,?,?,?,?)',(uid('evt'),job_id,'MANUAL_REOPEN',reason.strip(),iso(at)))
        return {'reopened':True}

    def _notify_research_company(self,c,job_id,company_id,kind,marker,body,at):
        """Emit a deduplicated in-app notice without exposing requester intent."""
        changed=c.execute('INSERT OR IGNORE INTO research_notice_events VALUES (?,?,?,?)',
                          (job_id,kind,marker,iso(at))).rowcount
        if not changed:return 0
        owners=c.execute('SELECT owner FROM requests WHERE company_id=? UNION SELECT owner FROM follows WHERE company_id=?',
                         (company_id,company_id)).fetchall()
        for row in owners:
            c.execute('INSERT INTO notices VALUES (?,?,?,?,0,?)',
                      (uid('notice'),row[0],company_id,body,iso(at)))
        return len(owners)

    def emit_overdue_notices(self,at=None):
        at=at or utcnow();sent=[]
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            rows=c.execute("""SELECT t.job_id,t.state,j.company_id,j.due_at,co.name
              FROM research_tasks t JOIN jobs j ON j.id=t.job_id JOIN companies co ON co.id=j.company_id
              WHERE j.due_at<=? AND t.state!='PUBLISHED' ORDER BY j.due_at,t.job_id""",(iso(at),)).fetchall()
            for row in rows:
                count=self._notify_research_company(c,row['job_id'],row['company_id'],'OVERDUE','FIRST_DUE',
                    row['name']+'：资料预计更新时间已到，仍在核对或等待公开来源；不会用猜测补齐。',at)
                if count:sent.append({'job_id':row['job_id'],'company_id':row['company_id'],'recipients':count,'state':row['state']})
        return sent

    def scheduler_status(self,at=None):
        at=at or utcnow();stamp=iso(at)
        with self.db() as c:
            counts={r['state']:r['n'] for r in c.execute('SELECT state,COUNT(*) n FROM research_tasks GROUP BY state')}
            hb=c.execute('SELECT * FROM research_scheduler ORDER BY heartbeat_at DESC LIMIT 1').fetchone()
            overdue=c.execute("""SELECT COUNT(*) FROM research_tasks t JOIN jobs j ON j.id=t.job_id
              WHERE j.due_at<=? AND t.state!='PUBLISHED'""",(stamp,)).fetchone()[0]
            pause=c.execute("SELECT resume_at FROM research_source_pause WHERE provider='GLEIF'").fetchone()
            budget=c.execute('SELECT reserved_requests FROM research_daily_budget WHERE day=?',(str(at.astimezone(self.tz).date()),)).fetchone()
        worker=None;active=False
        if hb:
            worker=dict(hb);heartbeat=datetime.fromisoformat(worker['heartbeat_at'])
            active=heartbeat>=at-timedelta(seconds=max(180,worker['interval_seconds']*3))
            worker['active']=active;worker['last_result']=json.loads(worker['last_result']) if worker['last_result'] else {}
        return {'active':active,'worker':worker,'states':counts,'overdue':overdue,
                'source_pause_until':pause[0] if pause else None,'reserved_requests_today':budget[0] if budget else 0}

    def _scheduler_heartbeat(self,worker_id,mode,interval_seconds,result,at=None,error=''):
        at=at or utcnow();payload=json.dumps(result or {},ensure_ascii=False,sort_keys=True)
        with self.db() as c:
            old=c.execute('SELECT started_at FROM research_scheduler WHERE worker_id=?',(worker_id,)).fetchone()
            started=old[0] if old else iso(at)
            c.execute('INSERT INTO research_scheduler VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(worker_id) DO UPDATE SET mode=excluded.mode,heartbeat_at=excluded.heartbeat_at,last_cycle_at=excluded.last_cycle_at,interval_seconds=excluded.interval_seconds,last_result=excluded.last_result,last_error=excluded.last_error',
                      (worker_id,mode,started,iso(at),iso(at),interval_seconds,payload,error[:200]))

    def scheduler_cycle(self,*,worker_id='manual',allow_network=False,max_jobs=5,max_attempts=3,daily_budget=120,
                        include_current=False,interval_seconds=300,at=None,client_factory=None):
        at=at or utcnow()
        if not 60<=interval_seconds<=3600:raise ValueError('调度间隔需为60—3600秒')
        research={'runs':[],'network_authorized':False,'scope':'RELEASE_ONLY','reserved_requests_per_job':6}
        if allow_network or client_factory is not None:
            research=self.run_research(allow_network=allow_network,max_jobs=max_jobs,max_attempts=max_attempts,
                daily_budget=daily_budget,include_current=include_current,at=at,client_factory=client_factory)
        released=self.release(at);overdue=self.emit_overdue_notices(at)
        result={'research':research,'released':released,'overdue_notices':overdue,'at':iso(at)}
        self._scheduler_heartbeat(worker_id,'NETWORK' if (allow_network or client_factory is not None) else 'RELEASE_ONLY',interval_seconds,result,at)
        return result

    def prepare(self,cid,day,packet):
        with self.db() as c:
            co=c.execute('SELECT * FROM companies WHERE id=?',(cid,)).fetchone()
            if co and not co['synthetic']:
                raise ValueError('真实企业资料必须经过研究草稿及服务端复核，不能自填APPROVED导入')
        return super().prepare(cid,day,packet)

    def release(self,at=None):
        at=at or utcnow();self.sync_research()
        emitted=super().release(at) # Existing synthetic fixtures only; real jobs have another status.
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            rows=c.execute("SELECT t.*,j.company_id,j.batch_day,j.due_at FROM research_tasks t JOIN jobs j ON j.id=t.job_id WHERE t.state='APPROVED' AND j.due_at<=? ORDER BY j.due_at",(iso(at),)).fetchall()
            for row in rows:
                review=c.execute('SELECT * FROM research_reviews WHERE run_id=?',(row['latest_run'],)).fetchone()
                run=c.execute('SELECT * FROM research_runs WHERE id=?',(row['latest_run'],)).fetchone()
                if not review or not run or digest(json.loads(run['packet']))!=review['original_hash']:
                    raise ValueError('原始研究内容与已核对版本不一致，停止发布')
                packet=json.loads(review['approved_packet'])
                if digest(packet)!=review['approved_hash']:raise ValueError('待发布版本校验失败')
                company=self._company_input(c,row);validate_packet(packet,company)
                existing=c.execute('SELECT id,status FROM snapshots WHERE company_id=? AND batch_day=?',(company['id'],row['batch_day'])).fetchone()
                # Legacy no-data snapshots must remain historical. Use an explicit revision key.
                key=row['batch_day'] if not existing else row['batch_day']+'~recovery-'+row['latest_run']
                sid=uid('snap')
                c.execute('INSERT INTO snapshots VALUES (?,?,?,?,?,?,?)',
                    (sid,company['id'],key,iso(at),review['approved_packet'],review['approved_hash'],'PUBLISHED_PARTIAL'))
                c.execute("UPDATE jobs SET status='PUBLISHED_PARTIAL',packet=? WHERE id=?",(review['approved_packet'],row['job_id']))
                c.execute("UPDATE research_tasks SET state='PUBLISHED',updated_at=? WHERE job_id=?",(iso(at),row['job_id']))
                self._notify_research_company(c,row['job_id'],company['id'],'PUBLISHED',row['latest_run'],
                    company['name']+'：首版公开资料已经更新，可查看来源、范围和仍待补充的栏目。',at)
                emitted.append({'company_id':company['id'],'snapshot_id':sid,'status':'PUBLISHED_PARTIAL',
                                'covered_sections':sum(bool(s['items']) for s in packet['sections'].values()),'total_sections':7})
        return emitted
