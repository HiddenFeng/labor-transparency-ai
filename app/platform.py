"""Local platform capabilities. Stage gates are enforced in the service, not just the UI.

This builds on the v0.2 store without discarding original data. External research and
external complaint delivery remain adapters, not simulated successful operations.
"""
from __future__ import annotations
import base64
import hashlib
import hmac
import json
import math
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from .core import Store as BaseStore, uid, iso, utcnow, digest

PHASES = {
    'plan': {'registration', 'companies'},
    'community': {'registration', 'companies', 'forum', 'rankings', 'conditions', 'responses'},
    'assistance': {'registration', 'companies', 'forum', 'rankings', 'conditions', 'responses', 'cases', 'evidence'},
}
PHASE_NAMES = {'plan': '计划与公司登记', 'community': '社区与工作体验', 'assistance': '社区与私密求助'}
ALLOWED_STATUS = {'DRAFT', 'MATERIAL_READY', 'USER_REPORTED_SUBMITTED', 'USER_REPORTED_RECEIVED',
                  'USER_REPORTED_RESOLVED', 'CLOSED'}
STATUS_NAMES = {'DRAFT': '整理中', 'MATERIAL_READY': '材料已生成，未对外提交',
 'USER_REPORTED_SUBMITTED': '用户记录已提交 · 平台未核验',
 'USER_REPORTED_RECEIVED': '用户记录收到回执 · 平台未核验',
 'USER_REPORTED_RESOLVED': '用户记录已有结果 · 平台未核验', 'CLOSED': '已归档'}


def text(value, minimum=0, maximum=2000):
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
        raise ValueError(f'文字长度需为{minimum}—{maximum}字')
    return value.strip()


def public_text(value, minimum=2, maximum=2000):
    value = text(value, minimum, maximum)
    # Targeted privacy preflight, not an evidence threshold or a guarantee of anonymisation.
    if re.search(r'(?<!\d)(?:1[3-9]\d{9}|\d{17}[\dXx])(?!\d)', value):
        raise ValueError('公开内容可能包含个人号码，请先移除或遮挡；不需要提供证据才能发帖')
    return value


def _scrypt(password_bytes, salt_bytes):
    if hasattr(hashlib, 'scrypt'):
        return hashlib.scrypt(password_bytes, salt=salt_bytes, n=16384, r=8, p=1, dklen=64)
    return Scrypt(salt=salt_bytes, length=64, n=16384, r=8, p=1).derive(password_bytes)


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    value = _scrypt(password.encode(), bytes.fromhex(salt)).hex()
    return salt + ':' + value


class Store(BaseStore):
    def __init__(self, path, tz='Asia/Tokyo', publish_hour=9):
        super().__init__(path, tz, publish_hour)
        self.attachment_scanner = None
        self.attachment_scan_required = False
        with self.db() as c:
            c.executescript('''
            CREATE TABLE IF NOT EXISTS schema_versions(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS legacy_sessions(token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL, redeemed INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS auth_attempts(owner TEXT NOT NULL, at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id), owner TEXT NOT NULL, body TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS company_ballots(company_id TEXT NOT NULL REFERENCES companies(id), owner TEXT NOT NULL, direction TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(company_id,owner));
            CREATE TABLE IF NOT EXISTS follows(company_id TEXT NOT NULL REFERENCES companies(id), owner TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(company_id,owner));
            CREATE TABLE IF NOT EXISTS conditions(id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), owner TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(company_id,owner));
            CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), owner TEXT NOT NULL, title TEXT NOT NULL, facts TEXT NOT NULL, goal TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS case_events(id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), owner TEXT NOT NULL, label TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), owner TEXT NOT NULL, claim TEXT NOT NULL, filename TEXT NOT NULL, media_type TEXT NOT NULL, content_hash TEXT NOT NULL, size INTEGER NOT NULL, ciphertext BLOB NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS public_summaries(id TEXT PRIMARY KEY, case_id TEXT NOT NULL UNIQUE REFERENCES cases(id), company_id TEXT NOT NULL REFERENCES companies(id), summary TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, owner TEXT NOT NULL, post_id TEXT NOT NULL REFERENCES posts(id), reason TEXT NOT NULL, detail TEXT NOT NULL, status TEXT NOT NULL, decision TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS representation_requests(id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), owner TEXT NOT NULL, explanation TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS representatives(company_id TEXT NOT NULL REFERENCES companies(id), owner TEXT NOT NULL, granted_at TEXT NOT NULL, reason TEXT NOT NULL, PRIMARY KEY(company_id,owner));
            CREATE TABLE IF NOT EXISTS company_responses(id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), owner TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS security_rate(actor_hash TEXT NOT NULL, bucket TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(actor_hash,bucket,window_start));
            CREATE TABLE IF NOT EXISTS security_events(id TEXT PRIMARY KEY, actor_hash TEXT NOT NULL, event TEXT NOT NULL, path TEXT NOT NULL, outcome TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
            CREATE TABLE IF NOT EXISTS notices(id TEXT PRIMARY KEY, owner TEXT NOT NULL, company_id TEXT, body TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
            INSERT OR IGNORE INTO settings VALUES ('phase','plan');
            ''')
            cols = {r[1] for r in c.execute('PRAGMA table_info(posts)')}
            for name, spec in [('tone', "TEXT NOT NULL DEFAULT 'discussion'"), ('urgent', 'INTEGER NOT NULL DEFAULT 0'), ('hidden', 'INTEGER NOT NULL DEFAULT 0')]:
                if name not in cols:
                    c.execute(f'ALTER TABLE posts ADD COLUMN {name} {spec}')
            evidence_cols = {r[1] for r in c.execute('PRAGMA table_info(evidence)')}
            for name, spec in [('scan_status', "TEXT NOT NULL DEFAULT 'LOCAL_NOT_SCANNED'"),
                               ('scan_engine', "TEXT NOT NULL DEFAULT ''"),
                               ('scan_at', "TEXT NOT NULL DEFAULT ''")]:
                if name not in evidence_cols:
                    c.execute(f'ALTER TABLE evidence ADD COLUMN {name} {spec}')
            if not c.execute("SELECT 1 FROM schema_versions WHERE version='0.3'").fetchone():
                owners=c.execute('SELECT owner FROM requests UNION SELECT owner FROM features UNION SELECT owner FROM posts UNION SELECT owner FROM votes').fetchall()
                for item in owners:
                    if re.fullmatch(r'[A-Za-z0-9_-]{43}',item['owner']):
                        c.execute('INSERT OR IGNORE INTO legacy_sessions VALUES (?,?,0)',(digest(item['owner']),item['owner']))
            vote_cols={r[1] for r in c.execute('PRAGMA table_info(votes)')}
            if 'created_at' not in vote_cols:
                c.execute("ALTER TABLE votes ADD COLUMN created_at TEXT NOT NULL DEFAULT ''")
            c.execute('INSERT OR IGNORE INTO schema_versions VALUES (?,?)', ('0.3', iso(utcnow())))

    def company(self,cid,owner):
        value=super().company(cid,owner)
        with self.db() as c:
            value['following']=bool(c.execute('SELECT 1 FROM follows WHERE company_id=? AND owner=?',(cid,owner)).fetchone())
        return value

    def phase(self):
        with self.db() as c:
            return c.execute("SELECT value FROM settings WHERE key='phase'").fetchone()[0]

    def capabilities(self):
        values = set(PHASES[self.phase()])
        # Original CLI compatibility: independently opening forum never opens private cases.
        if self.setting('forum_enabled'):
            values.add('forum')
        else:
            values.discard('forum')
        return {key: key in values for key in set.union(*PHASES.values())}

    def require(self, capability):
        if not self.capabilities().get(capability):
            raise PermissionError('此功能尚未开放；已有私密资料仍可查看和导出')

    def set_phase(self, phase, actor='local-operator'):
        if phase not in PHASES:
            raise ValueError('开放阶段无效')
        with self.db() as c:
            c.execute("UPDATE settings SET value=? WHERE key='phase'", (phase,))
            c.execute("UPDATE settings SET value=? WHERE key='forum_enabled'", ('true' if 'forum' in PHASES[phase] else 'false',))
            self._audit(c, actor, 'SET_PHASE', phase, '分阶段开放；不删除已有数据')

    @staticmethod
    def _audit(c, actor, action, target, reason):
        c.execute('INSERT INTO audit VALUES (?,?,?,?,?,?)', (uid('audit'), actor, action, target, reason, iso(utcnow())))

    def security_rate(self, actor_hash, bucket, limit, now=None):
        """Persistent fixed-window limiter; actor_hash must already exclude raw network identifiers."""
        now = now or utcnow()
        window = int(now.timestamp()) // 60
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            row = c.execute('SELECT count FROM security_rate WHERE actor_hash=? AND bucket=? AND window_start=?',
                            (actor_hash, bucket, window)).fetchone()
            count = row['count'] if row else 0
            if count >= limit:
                allowed = False
            else:
                c.execute('INSERT INTO security_rate(actor_hash,bucket,window_start,count) VALUES (?,?,?,1) '
                          'ON CONFLICT(actor_hash,bucket,window_start) DO UPDATE SET count=count+1',
                          (actor_hash, bucket, window))
                allowed = True
            # Keep a narrow operational history; rate state is not business history.
            c.execute('DELETE FROM security_rate WHERE window_start<?', (window-120,))
            return allowed

    def security_event(self, actor_hash, event, path, outcome, detail=''):
        event = text(event, 2, 80)
        path = text(path, 1, 300)
        outcome = text(outcome, 2, 40)
        detail = text(detail, 0, 300)
        with self.db() as c:
            c.execute('INSERT INTO security_events VALUES (?,?,?,?,?,?,?)',
                      (uid('sec'), actor_hash, event, path, outcome, detail, iso(utcnow())))
            # Security telemetry is intentionally bounded here; external production log retention is separate.
            c.execute('DELETE FROM security_events WHERE created_at<?', (iso(utcnow()-timedelta(days=30)),))

    def configure_attachment_scanner(self, scanner=None, required=False):
        self.attachment_scanner = scanner
        self.attachment_scan_required = bool(required)

    def resolve_session(self, token):
        if token and isinstance(token, str) and 20 <= len(token) <= 100:
            with self.db() as c:
                row = c.execute('SELECT owner FROM sessions WHERE token_hash=? AND expires_at>?', (digest(token), iso(utcnow()))).fetchone()
                if row:
                    return token, row['owner'], False
                legacy=c.execute('SELECT owner FROM legacy_sessions WHERE token_hash=? AND redeemed=0',(digest(token),)).fetchone()
                if legacy:
                    oldowner=legacy['owner'];owner=uid('visitor');newtoken=secrets.token_urlsafe(32)
                    c.execute('BEGIN IMMEDIATE')
                    # A legacy capability can be redeemed only once; new code never trusts an arbitrary cookie.
                    changed=c.execute('UPDATE legacy_sessions SET redeemed=1 WHERE token_hash=? AND redeemed=0',(digest(token),)).rowcount
                    if changed:
                        for table in ('requests','features','posts','votes'):
                            c.execute(f'UPDATE {table} SET owner=? WHERE owner=?',(owner,oldowner))
                        c.execute('INSERT INTO sessions VALUES (?,?,?)',(digest(newtoken),owner,iso(utcnow()+timedelta(days=7))))
                        return newtoken,owner,True
        token = secrets.token_urlsafe(32)
        owner = uid('visitor')
        self._session(token, owner)
        return token, owner, True

    def _session(self, token, owner):
        with self.db() as c:
            c.execute('INSERT INTO sessions VALUES (?,?,?)', (digest(token), owner, iso(utcnow()+timedelta(days=7))))

    def account(self, owner):
        with self.db() as c:
            row = c.execute('SELECT username FROM accounts WHERE id=?', (owner,)).fetchone()
            return {'signed_in': bool(row), 'username': row[0] if row else None}

    def signup(self, owner, username, password, token):
        username = text(username, 2, 32)
        if not re.fullmatch(r'[\w\-\u4e00-\u9fff]{2,32}', username):
            raise ValueError('昵称请使用中文、字母、数字、下划线或短横线')
        if not isinstance(password, str) or not 10 <= len(password) <= 128:
            raise ValueError('密码需要10—128位')
        self.auth_throttle(owner)
        aid = uid('user')
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            if c.execute('SELECT 1 FROM accounts WHERE username=?', (username,)).fetchone():
                raise ValueError('此昵称已使用')
            if c.execute('SELECT 1 FROM accounts WHERE id=?', (owner,)).fetchone():
                raise ValueError('请先退出当前账号')
            c.execute('INSERT INTO accounts VALUES (?,?,?,?)', (aid, username, password_hash(password), iso(utcnow())))
            for table in ('requests','features','posts','votes','comments','company_ballots','follows','conditions','cases','case_events','evidence','reports','representation_requests','notices'):
                c.execute(f'UPDATE {table} SET owner=? WHERE owner=?', (aid, owner))
            c.execute('DELETE FROM sessions WHERE token_hash=?', (digest(token),))
        new = secrets.token_urlsafe(32)
        self._session(new, aid)
        return new

    def auth_throttle(self, owner):
        with self.db() as c:
            since = iso(utcnow()-timedelta(minutes=15))
            count = c.execute('SELECT COUNT(*) FROM auth_attempts WHERE owner=? AND at>?', (owner,since)).fetchone()[0]
            if count >= 8:
                raise PermissionError('尝试次数较多，请稍后再试')
            c.execute('INSERT INTO auth_attempts VALUES (?,?)', (owner,iso(utcnow())))

    def login(self, owner, username, password, token):
        self.auth_throttle(owner)
        with self.db() as c:
            row = c.execute('SELECT * FROM accounts WHERE username=?', (text(username,2,32),)).fetchone()
        if not isinstance(password,str) or len(password)>128:
            raise ValueError('昵称或密码不正确')
        if not row or not hmac.compare_digest(password_hash(password,row['password_hash'].split(':')[0]),row['password_hash']):
            raise ValueError('昵称或密码不正确')
        # Preserve visitor work when attaching this browser to an existing account.
        # Account ballots/condition records win conflicts; keep the guest condition as a private note.
        if owner.startswith('visitor_'):
            with self.db() as c:
                c.execute('BEGIN IMMEDIATE')
                duplicates=c.execute('SELECT g.payload FROM conditions g JOIN conditions a ON g.company_id=a.company_id WHERE g.owner=? AND a.owner=?',(owner,row['id'])).fetchall()
                for item in duplicates:
                    c.execute('INSERT INTO features VALUES (?,?,?,?,?)',(uid('ft'),row['id'],'登录前的工作体验备份',item['payload'],iso(utcnow())))
                c.execute("UPDATE requests SET idem='import-'||id WHERE owner=?",(owner,))
                for table in ('requests','features','posts','comments','cases','case_events','evidence','reports','representation_requests','notices'):
                    c.execute(f'UPDATE {table} SET owner=? WHERE owner=?',(row['id'],owner))
                for table in ('votes','company_ballots','follows','conditions','representatives'):
                    c.execute(f'UPDATE OR IGNORE {table} SET owner=? WHERE owner=?',(row['id'],owner))
                    c.execute(f'DELETE FROM {table} WHERE owner=?',(owner,))
        self.logout(token)
        new = secrets.token_urlsafe(32)
        self._session(new,row['id'])
        return new

    def logout(self, token):
        with self.db() as c:
            c.execute('DELETE FROM sessions WHERE token_hash=?',(digest(token),))

    def post(self, cid, owner, title, body, tone='discussion', urgent=False):
        self.require('forum')
        co = self.company(cid,owner)
        if not co['public']:
            raise ValueError('这是私密公司空间，不能直接发布公开讨论')
        if tone not in ('discussion','positive','negative','question'):
            raise ValueError('请选择有效内容类型')
        title, body = public_text(title,2,100), public_text(body)
        value = {'id':uid('post'),'evidence':'E0'}
        with self.db() as c:
            c.execute('INSERT INTO posts(id,company_id,owner,title,body,evidence,created_at,tone,urgent,hidden) VALUES (?,?,?,?,?,?,?,?,?,0)',
                      (value['id'],cid,owner,title,body,'E0',iso(utcnow()),tone,int(urgent)))
        return value

    def _post(self, pid, owner):
        with self.db() as c:
            row = c.execute('SELECT * FROM posts WHERE id=? AND hidden=0',(pid,)).fetchone()
            if not row:
                raise LookupError('内容不存在或暂不可见')
        self.company(row['company_id'], owner)
        return dict(row)

    def posts(self, cid, owner):
        self.require('forum')
        co = self.company(cid,owner)
        if not co['public']:
            return []
        with self.db() as c:
            rows = c.execute('''SELECT p.id,p.company_id,p.title,p.body,p.evidence,p.created_at,p.tone,p.urgent,
               (SELECT COUNT(*) FROM votes v WHERE v.post_id=p.id) AS votes,
               (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.hidden=0) AS comments,
               EXISTS(SELECT 1 FROM votes v WHERE v.post_id=p.id AND v.owner=?) AS voted,
               p.owner=? AS is_mine FROM posts p WHERE p.company_id=? AND p.hidden=0 ORDER BY p.created_at DESC''',(owner,owner,cid)).fetchall()
            return [dict(r) for r in rows]

    def feed(self, owner, tone='', urgent=False):
        self.require('forum')
        items = []
        for company in self.list_companies():
            for post in self.posts(company['id'],owner):
                if tone and post['tone'] != tone: continue
                if urgent and not post['urgent']: continue
                post['company_name'] = company['name']
                items.append(post)
        return sorted(items,key=lambda p:p['created_at'],reverse=True)[:100]

    def post_detail(self,pid,owner):
        self.require('forum')
        p = self._post(pid,owner)
        public = next((r for r in self.posts(p['company_id'],owner) if r['id']==pid),None)
        if not public: raise LookupError('内容不存在')
        with self.db() as c:
            public['replies'] = [dict(r) for r in c.execute('SELECT id,body,created_at,owner=? AS is_mine FROM comments WHERE post_id=? AND hidden=0 ORDER BY created_at',(owner,pid))]
        public['company_name'] = self.company(p['company_id'],owner)['name']
        return public

    def comment(self,pid,owner,body):
        self.require('forum'); self._post(pid,owner)
        body=public_text(body)
        value={'id':uid('comment')}
        with self.db() as c:
            c.execute('INSERT INTO comments VALUES (?,?,?,?,0,?)',(value['id'],pid,owner,body,iso(utcnow())))
        return value

    def vote(self,pid,owner):
        self.require('forum'); self._post(pid,owner)
        with self.db() as c:
            c.execute('INSERT OR IGNORE INTO votes(post_id,owner,created_at) VALUES (?,?,?)',(pid,owner,iso(utcnow())))

    def delete_post(self,pid,owner):
        p=self._post(pid,owner)
        if p['owner'] != owner: raise PermissionError('只能撤下自己的内容')
        with self.db() as c:
            c.execute('UPDATE posts SET hidden=1 WHERE id=?',(pid,))
            self._audit(c,owner,'AUTHOR_WITHDRAW',pid,'作者撤下')

    def ballot(self,cid,owner,direction):
        self.require('rankings')
        if not self.company(cid,owner)['public']: raise LookupError('公司未公开')
        if direction not in ('positive','negative','clear'): raise ValueError('投票类型无效')
        with self.db() as c:
            if direction == 'clear': c.execute('DELETE FROM company_ballots WHERE company_id=? AND owner=?',(cid,owner))
            else: c.execute('INSERT INTO company_ballots VALUES (?,?,?,?) ON CONFLICT(company_id,owner) DO UPDATE SET direction=excluded.direction,created_at=excluded.created_at',(cid,owner,direction,iso(utcnow())))
        return {'direction':None if direction=='clear' else direction}

    def follow(self,cid,owner,active=True):
        self.company(cid,owner)
        with self.db() as c:
            if active: c.execute('INSERT OR IGNORE INTO follows VALUES (?,?,?)',(cid,owner,iso(utcnow())))
            else: c.execute('DELETE FROM follows WHERE company_id=? AND owner=?',(cid,owner))
        return {'following':bool(active)}

    def rankings(self,owner,order='heat'):
        self.require('rankings')
        if order not in ('heat','positive','negative','urgent'): raise ValueError('排行无效')
        since=iso(utcnow()-timedelta(days=7))
        items=[]
        with self.db() as c:
            for company in self.list_companies():
                cid=company['id']
                # Participation is an account count; no evidence label appears in this calculation.
                participants=c.execute('''SELECT COUNT(DISTINCT owner) FROM (
                  SELECT owner FROM posts WHERE company_id=? AND hidden=0 AND created_at>=?
                  UNION SELECT v.owner FROM votes v JOIN posts p ON p.id=v.post_id WHERE p.company_id=? AND p.hidden=0 AND COALESCE(NULLIF(v.created_at,''),p.created_at)>=?
                  UNION SELECT x.owner FROM comments x JOIN posts p ON p.id=x.post_id WHERE p.company_id=? AND p.hidden=0 AND x.hidden=0 AND x.created_at>=?
                  UNION SELECT owner FROM company_ballots WHERE company_id=? AND created_at>=?)''',(cid,since,cid,since,cid,since,cid,since)).fetchone()[0]
                ballots={r[0]:r[1] for r in c.execute('SELECT direction,COUNT(*) FROM company_ballots WHERE company_id=? AND created_at>=? GROUP BY direction',(cid,since))}
                post_count=c.execute('SELECT COUNT(*) FROM posts WHERE company_id=? AND hidden=0 AND created_at>=?',(cid,since)).fetchone()[0]
                urgent_count=c.execute('SELECT COUNT(*) FROM posts WHERE company_id=? AND hidden=0 AND urgent=1 AND created_at>=?',(cid,since)).fetchone()[0]
                mine=c.execute('SELECT direction FROM company_ballots WHERE company_id=? AND owner=?',(cid,owner)).fetchone()
                item={**company,'participants':participants,'positive':ballots.get('positive',0),'negative':ballots.get('negative',0),'heat':participants,'posts_count':post_count,'urgent':urgent_count,'my_vote':mine[0] if mine else None}
                items.append(item)
        # Emergency discovery is separate: self-report, not a verified-risk score or unlimited boost.
        return sorted(items,key=lambda x:(x[order],x['heat'],x['created_at']),reverse=True)

    def save_condition(self,cid,owner,payload):
        self.require('conditions')
        if not self.company(cid,owner)['public']: raise ValueError('工作体验只能汇总至公开公司空间')
        allowed={'period','role','rest','weekly_hours','advertised_pay','actual_pay','advertised_basis','actual_basis','currency','note'}
        if set(payload)-allowed: raise ValueError('存在不允许的字段')
        value={'period':text(payload.get('period',''),1,40),'role':text(payload.get('role',''),0,40),
               'rest':payload.get('rest','unknown'),'weekly_hours':payload.get('weekly_hours'),
               'advertised_pay':payload.get('advertised_pay'),'actual_pay':payload.get('actual_pay'),
               'advertised_basis':payload.get('advertised_basis','unknown'),'actual_basis':payload.get('actual_basis','unknown'),
               'currency':payload.get('currency','CNY'),'note':text(payload.get('note',''),0,500)}
        if value['rest'] not in ('two','one','alternating','other','unknown'): raise ValueError('休息安排无效')
        if any(value[k] not in ('gross_month','net_month','unknown') for k in ('advertised_basis','actual_basis')): raise ValueError('薪资口径无效')
        if value['currency'] not in ('CNY','USD','EUR','JPY'): raise ValueError('币种无效')
        for k,limit in [('weekly_hours',168),('advertised_pay',100000000),('actual_pay',100000000)]:
            if value[k] is not None and (isinstance(value[k],bool) or not isinstance(value[k],(int,float)) or not math.isfinite(value[k]) or not 0<=value[k]<=limit): raise ValueError('工时或薪资数值无效')
        with self.db() as c:
            c.execute('INSERT INTO conditions VALUES (?,?,?,?,?) ON CONFLICT(company_id,owner) DO UPDATE SET payload=excluded.payload,created_at=excluded.created_at',
                      (uid('condition'),cid,owner,json.dumps(value,ensure_ascii=False),iso(utcnow())))
        return {'saved':True,'scope':'本站自愿提交样本，不代表全体员工'}

    def conditions_summary(self,cid,owner):
        self.require('conditions'); self.company(cid,owner)
        with self.db() as c:
            rows=c.execute('SELECT owner,payload FROM conditions WHERE company_id=?',(cid,)).fetchall()
        own=next((json.loads(r['payload']) for r in rows if r['owner']==owner),None)
        values=[json.loads(r['payload']) for r in rows]
        result={'count':len(values),'minimum_group':5,'own':own,'groups':[],'rest':{},'scope':'本站自愿提交样本；不代表全体员工'}
        if len(values)<5: return result
        for rest in ('two','one','alternating','other','unknown'):
            n=sum(x['rest']==rest for x in values)
            result['rest'][rest]=n if n>=5 else None
        keys={(x['currency'],x['advertised_basis'],x['actual_basis'],x['period']) for x in values}
        for currency,ab,bb,period in keys:
            group=[x for x in values if (x['currency'],x['advertised_basis'],x['actual_basis'],x['period'])==(currency,ab,bb,period) and x['advertised_pay'] is not None and x['actual_pay'] is not None]
            if len(group)<5: continue
            comparable=ab==bb and ab!='unknown'
            result['groups'].append({'currency':currency,'advertised_basis':ab,'actual_basis':bb,'period':period,'count':len(group),
             'advertised_median':median(x['advertised_pay'] for x in group),'actual_median':median(x['actual_pay'] for x in group),
             'median_difference':median(x['actual_pay']-x['advertised_pay'] for x in group) if comparable else None,
             'comparable':comparable,'label':'同口径自述差值，不是违法认定' if comparable else '口径不同，不计算差值'})
        return result

    def create_case(self,cid,owner,title,facts,goal):
        self.require('cases'); self.company(cid,owner)
        title,facts,goal=text(title,2,100),text(facts,2,8000),text(goal,2,1000)
        value={'id':uid('case'),'status':'DRAFT'}
        with self.db() as c:
            c.execute('INSERT INTO cases VALUES (?,?,?,?,?,?,?,?,?)',(value['id'],cid,owner,title,facts,goal,'DRAFT',iso(utcnow()),iso(utcnow())))
        return value

    def case(self,kid,owner):
        # Retrieval/export remains possible after the feature is closed.
        with self.db() as c:
            row=c.execute('SELECT * FROM cases WHERE id=? AND owner=?',(kid,owner)).fetchone()
            if not row: raise LookupError('未找到可访问的私密事项')
            value=dict(row); value.pop('owner')
            value['status_label']=STATUS_NAMES[value['status']]
            value['company_name']=c.execute('SELECT name FROM companies WHERE id=?',(row['company_id'],)).fetchone()[0]
            value['events']=[dict(r) for r in c.execute('SELECT id,label,body,created_at FROM case_events WHERE case_id=? ORDER BY created_at',(kid,))]
            value['evidence']=[dict(r) for r in c.execute('SELECT id,claim,filename,media_type,content_hash,size,scan_status,scan_engine,scan_at,created_at FROM evidence WHERE case_id=?',(kid,))]
            s=c.execute('SELECT id,summary FROM public_summaries WHERE case_id=?',(kid,)).fetchone()
            value['public_summary']=dict(s) if s else None
            return value

    def cases(self,owner):
        with self.db() as c:
            return [dict(r) for r in c.execute('SELECT id,company_id,title,status,updated_at FROM cases WHERE owner=? ORDER BY updated_at DESC',(owner,))]

    def update_case(self,kid,owner,status,note):
        self.require('cases'); self.case(kid,owner)
        if status not in ALLOWED_STATUS: raise ValueError('状态无效；平台不提供“已认定违法”状态')
        note=text(note,2,2000)
        with self.db() as c:
            c.execute('UPDATE cases SET status=?,updated_at=? WHERE id=?',(status,iso(utcnow()),kid))
            c.execute('INSERT INTO case_events VALUES (?,?,?,?,?,?)',(uid('event'),kid,owner,STATUS_NAMES[status],note,iso(utcnow())))
        return {'status':status,'label':STATUS_NAMES[status]}

    def _cipher(self):
        keypath=Path(self.path).with_suffix('.evidence.key')
        if not keypath.exists():
            with self.db() as c:
                if c.execute('SELECT 1 FROM evidence LIMIT 1').fetchone():
                    raise ValueError('私密附件密钥缺失；请恢复原密钥，不要用新密钥替代。正文与无附件导出仍可访问。')
            try:
                import os
                fd=os.open(str(keypath),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
                with os.fdopen(fd,'wb') as f:f.write(Fernet.generate_key())
            except FileExistsError: pass
        return Fernet(keypath.read_bytes())

    def add_evidence(self,kid,owner,claim,filename,content_b64):
        self.require('evidence'); self.case(kid,owner)
        claim=text(claim,2,500)
        filename=text(filename,1,120)
        if Path(filename).name!=filename or '/' in filename or '\\' in filename: raise ValueError('文件名无效')
        try: raw=base64.b64decode(content_b64,validate=True)
        except (ValueError,TypeError): raise ValueError('文件编码无效')
        if not 1<=len(raw)<=2*1024*1024: raise ValueError('附件需为1字节—2MB')
        ext=Path(filename).suffix.lower()
        types={'.txt':'text/plain','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.pdf':'application/pdf'}
        if ext not in types: raise ValueError('只支持TXT、PNG、JPEG、PDF，不支持可执行或压缩文件')
        if ext=='.txt':
            try: raw.decode('utf-8')
            except UnicodeDecodeError: raise ValueError('文本文件需为UTF-8编码')
        elif ext=='.png' and not raw.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('文件内容与PNG格式不符')
        elif ext in ('.jpg','.jpeg') and not raw.startswith(b'\xff\xd8\xff'): raise ValueError('文件内容与JPEG格式不符')
        elif ext=='.pdf' and not raw.startswith(b'%PDF-'): raise ValueError('文件内容与PDF格式不符')

        scan_status, scan_engine, scan_at = 'LOCAL_NOT_SCANNED', '', ''
        if self.attachment_scanner is not None:
            try:
                scan = self.attachment_scanner(raw, filename, types[ext])
            except Exception as exc:
                raise ValueError('附件安全扫描暂时不可用，文件未保存') from exc
            scan_status = str((scan or {}).get('status', 'ERROR')).upper()
            scan_engine = text(str((scan or {}).get('engine', 'scanner')), 1, 40)
            if scan_status != 'CLEAN':
                raise ValueError('附件安全扫描未通过，文件未保存')
            scan_at = iso(utcnow())
        elif self.attachment_scan_required:
            raise PermissionError('生产环境附件上传尚未配置恶意文件扫描；当前拒绝接收附件')

        eid=uid('evidence')
        with self.db() as c:
            total=c.execute('SELECT COUNT(*),COALESCE(SUM(size),0) FROM evidence WHERE owner=?',(owner,)).fetchone()
            if total[0]>=40 or total[1]+len(raw)>20*1024*1024: raise ValueError('已达到本地测试账号附件限额')
            c.execute('''INSERT INTO evidence
                (id,case_id,owner,claim,filename,media_type,content_hash,size,ciphertext,created_at,scan_status,scan_engine,scan_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                (eid,kid,owner,claim,filename,types[ext],hashlib.sha256(raw).hexdigest(),len(raw),
                 self._cipher().encrypt(raw),iso(utcnow()),scan_status,scan_engine,scan_at))
        return {'id':eid,'evidence':'E2','verification':'仅收到材料，尚未核实','public':False,
                'scan_status':scan_status}

    def evidence_file(self,eid,owner):
        with self.db() as c:
            row=c.execute('SELECT * FROM evidence WHERE id=? AND owner=?',(eid,owner)).fetchone()
        if not row: raise LookupError('未找到可访问的附件')
        return self._cipher().decrypt(row['ciphertext']),row['filename']

    def delete_evidence(self,eid,owner):
        self.evidence_file(eid,owner)
        with self.db() as c:c.execute('DELETE FROM evidence WHERE id=? AND owner=?',(eid,owner))

    def material(self,kid,owner):
        value=self.case(kid,owner)
        lines=['劳动事项陈述草稿','此材料由结构化模板整理，不是律师意见，也未向外部机构提交。','',
               '涉及公司：'+value['company_name'],'事项：'+value['title'],'', '一、本人陈述的事实',value['facts'],'',
               '二、希望解决的问题',value['goal'],'','三、已提供的材料（收到不代表真实性已核验）']
        if not value['evidence']:lines.append('目前未提供附件。请勿将不存在的材料列为已提交证据。')
        for i,e in enumerate(value['evidence'],1):lines.append(f'{i}. {e["filename"]}；拟支持：{e["claim"]}；SHA-256：{e["content_hash"]}')
        lines+=['','四、后续记录']
        lines += [f'{e["created_at"]} | {e["label"]} | {e["body"]}' for e in value['events']] or ['尚无后续记录。']
        lines+=['','五、提交前请自行核对','发生日期、工作地点、用工主体、金额与请求是否准确；接收渠道是否适用于本人情况；哪些材料需要实名。','未提供的信息保持未知，不由模板补造。此下载不代表已经提交或受理。']
        return '\n'.join(lines)+'\n'

    def publish_summary(self,kid,owner,summary,consent):
        self.require('cases'); value=self.case(kid,owner)
        if consent is not True:raise ValueError('请单独确认公开这一段摘要；公开不等于向外提交')
        if not self.company(value['company_id'],owner)['public']:raise ValueError('公司空间未公开，不能直接公开求助摘要')
        summary=public_text(summary,2,1500)
        with self.db() as c:
            c.execute('INSERT INTO public_summaries VALUES (?,?,?,?,?) ON CONFLICT(case_id) DO UPDATE SET summary=excluded.summary,created_at=excluded.created_at',(uid('summary'),kid,value['company_id'],summary,iso(utcnow())))
        return {'public':True,'scope':'仅公开所确认的摘要，不包含私密事实、身份、附件或后续状态'}

    def revoke_summary(self,kid,owner):
        self.case(kid,owner)
        with self.db() as c:c.execute('DELETE FROM public_summaries WHERE case_id=?',(kid,))

    def summaries(self,cid,owner):
        self.require('cases');self.company(cid,owner)
        with self.db() as c:
            return [dict(r) for r in c.execute('SELECT id,summary,created_at FROM public_summaries WHERE company_id=? ORDER BY created_at DESC',(cid,))]

    def report(self,pid,owner,reason,detail):
        self._post(pid,owner)
        if reason not in ('privacy','harassment','inaccuracy','other'):raise ValueError('请选择反馈类型')
        detail=text(detail,2,2000)
        rid=uid('report')
        with self.db() as c:c.execute('INSERT INTO reports VALUES (?,?,?,?,?,?,?,?)',(rid,owner,pid,reason,detail,'OPEN','',iso(utcnow())))
        return {'id':rid,'status':'OPEN'}

    def moderate(self,rid,action,reason,actor='operator'):
        if action not in ('hide','restore','no_action'):raise ValueError('处理动作无效')
        reason=text(reason,5,1000)
        with self.db() as c:
            row=c.execute('SELECT * FROM reports WHERE id=?',(rid,)).fetchone()
            if not row:raise LookupError('未找到反馈')
            if action!='no_action':c.execute('UPDATE posts SET hidden=? WHERE id=?',(1 if action=='hide' else 0,row['post_id']))
            c.execute('UPDATE reports SET status=?,decision=? WHERE id=?',('RESOLVED',reason,rid))
            self._audit(c,actor,'MODERATE_'+action,row['post_id'],reason)
            p=c.execute('SELECT owner,company_id FROM posts WHERE id=?',(row['post_id'],)).fetchone()
            for user in set([row['owner'],p['owner']]):c.execute('INSERT INTO notices VALUES (?,?,?,?,0,?)',(uid('notice'),user,p['company_id'],'内容处理：'+reason,iso(utcnow())))
        return {'status':'RESOLVED'}

    def representation(self,cid,owner,explanation):
        self.require('responses')
        if not self.company(cid,owner)['public']:raise LookupError('公司未公开')
        explanation=text(explanation,5,2000)
        rid=uid('representation')
        with self.db() as c:c.execute('INSERT INTO representation_requests VALUES (?,?,?,?,?,?)',(rid,cid,owner,explanation,'PENDING',iso(utcnow())))
        return {'id':rid,'status':'PENDING'}

    def approve_representation(self,rid,reason,actor='operator'):
        reason=text(reason,5,1000)
        with self.db() as c:
            row=c.execute('SELECT * FROM representation_requests WHERE id=?',(rid,)).fetchone()
            if not row:raise LookupError('未找到代表权申请')
            c.execute('INSERT OR REPLACE INTO representatives VALUES (?,?,?,?)',(row['company_id'],row['owner'],iso(utcnow()),reason))
            c.execute("UPDATE representation_requests SET status='APPROVED' WHERE id=?",(rid,))
            self._audit(c,actor,'GRANT_REPRESENTATION',rid,reason)

    def response(self,cid,owner,body):
        self.require('responses');self.company(cid,owner)
        body=public_text(body,2,3000)
        with self.db() as c:
            if not c.execute('SELECT 1 FROM representatives WHERE company_id=? AND owner=?',(cid,owner)).fetchone():raise PermissionError('需先由运营核对企业代表权；普通用户可发表讨论')
            rid=uid('response');c.execute('INSERT INTO company_responses VALUES (?,?,?,?,?)',(rid,cid,owner,body,iso(utcnow())))
        return {'id':rid}

    def responses(self,cid,owner):
        self.require('responses');self.company(cid,owner)
        with self.db() as c:return [dict(r) for r in c.execute('SELECT id,body,created_at FROM company_responses WHERE company_id=? ORDER BY created_at DESC',(cid,))]

    def dashboard(self,owner):
        value=self.mine(owner)
        value.update(account=self.account(owner),cases=self.cases(owner))
        with self.db() as c:
            value['notices']=[dict(r) for r in c.execute('SELECT id,company_id,body,read,created_at FROM notices WHERE owner=? ORDER BY created_at DESC LIMIT 100',(owner,))]
            value['follows']=[dict(r) for r in c.execute('SELECT co.id,co.name FROM follows f JOIN companies co ON co.id=f.company_id WHERE f.owner=?',(owner,))]
            value['reports']=[dict(r) for r in c.execute('SELECT id,status,decision,created_at FROM reports WHERE owner=?',(owner,))]
        return value

    def release(self,at=None):
        released=super().release(at)
        with self.db() as c:
            for r in released:
                owners=c.execute('SELECT owner FROM requests WHERE company_id=? UNION SELECT owner FROM follows WHERE company_id=?',(r['company_id'],r['company_id'])).fetchall()
                name=c.execute('SELECT name FROM companies WHERE id=?',(r['company_id'],)).fetchone()[0]
                for row in owners:c.execute('INSERT INTO notices VALUES (?,?,?,?,0,?)',(uid('notice'),row[0],r['company_id'],name+'：首版资料或进度已更新。',iso(at or utcnow())))
        return released

    def admin_dashboard(self):
        with self.db() as c:
            return {'phase':self.phase(),'capabilities':self.capabilities(),
                'jobs':[dict(r) for r in c.execute('SELECT j.id,j.company_id,co.name,j.batch_day,j.due_at,j.status FROM jobs j JOIN companies co ON co.id=j.company_id ORDER BY j.due_at')],
                'reports':[dict(r) for r in c.execute('SELECT id,post_id,reason,detail,status,decision FROM reports ORDER BY created_at DESC')],
                'representations':[dict(r) for r in c.execute('SELECT id,company_id,explanation,status FROM representation_requests')],
                'audit':[dict(r) for r in c.execute('SELECT action,target,reason,created_at FROM audit ORDER BY created_at DESC LIMIT 50')]}

    def export_account(self,owner):
        data=self.dashboard(owner)
        data['private_cases']=[self.case(c['id'],owner) for c in data['cases']]
        with self.db() as c:
            data['posts']=[dict(r) for r in c.execute('SELECT id,company_id,title,body,evidence,tone,urgent,hidden,created_at FROM posts WHERE owner=?',(owner,))]
            data['comments']=[dict(r) for r in c.execute('SELECT id,post_id,body,hidden,created_at FROM comments WHERE owner=?',(owner,))]
            data['conditions']=[dict(r) for r in c.execute('SELECT company_id,payload,created_at FROM conditions WHERE owner=?',(owner,))]
        return data

    def delete_account(self,owner,token):
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            for table in ('public_summaries','evidence','case_events'):
                c.execute(f'DELETE FROM {table} WHERE case_id IN (SELECT id FROM cases WHERE owner=?)',(owner,))
            for table in ('cases','conditions','comments','votes','company_ballots','follows','features','notices','representation_requests','representatives'):
                c.execute(f'DELETE FROM {table} WHERE owner=?',(owner,))
            c.execute("UPDATE posts SET hidden=1,owner=?,title='作者已撤回',body='' WHERE owner=?",('deleted-author',owner))
            c.execute('UPDATE reports SET owner=?,detail=? WHERE owner=?',('deleted-reporter','提交者已删除私密反馈内容',owner))
            private_ids=[r[0] for r in c.execute('SELECT co.id FROM companies co JOIN requests r ON r.company_id=co.id WHERE r.owner=? AND co.public=0',(owner,))]
            c.execute('DELETE FROM requests WHERE owner=?',(owner,))
            for cid in private_ids:
                if not c.execute('SELECT 1 FROM requests WHERE company_id=?',(cid,)).fetchone():
                    c.execute('DELETE FROM jobs WHERE company_id=?',(cid,));c.execute('DELETE FROM snapshots WHERE company_id=?',(cid,))
                    c.execute('DELETE FROM companies WHERE id=?',(cid,))
            c.execute('DELETE FROM sessions WHERE owner=?',(owner,))
            c.execute('DELETE FROM accounts WHERE id=?',(owner,))
            c.execute('DELETE FROM auth_attempts WHERE owner=?',(owner,))
