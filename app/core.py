"""Local, synthetic-data vertical slice. No unattended agent or external submission.

Business invariants: immediate spaces; independent forum flag; claim-level sources;
calendar-day cohorts; private intentions excluded from public responses; atomic releases.
"""
from __future__ import annotations
import hashlib
import json
import re
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

SECTIONS = {
    'identity': '企业主体', 'business': '业务与产品', 'ownership': '母子公司与品牌',
    'facilities': '工厂与用工地点', 'supply_chain': '产业链与合作关系',
    'work_conditions': '劳动信息来源', 'channels': '咨询与申诉渠道'
}
NEEDS = {'company', 'products', 'supply_chain', 'discussion', 'help'}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError('必须提供带时区的时间')
    return value.astimezone(timezone.utc).isoformat()


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                      separators=(',', ':')).encode()).hexdigest()


def uid(prefix: str) -> str:
    return prefix + '_' + uuid.uuid4().hex[:20]


class Store:
    def __init__(self, path: str | Path, tz: str = 'Asia/Tokyo', publish_hour: int = 9):
        self.path = str(path)
        self.tz = ZoneInfo(tz)
        self.publish_hour = publish_hour
        if not 0 <= publish_hour <= 23:
            raise ValueError('发布小时无效')
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.db() as c:
            c.executescript('''
            CREATE TABLE IF NOT EXISTS companies (
              id TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL,
              website TEXT NOT NULL, registry_id TEXT NOT NULL, public INTEGER NOT NULL,
              synthetic INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS requests (
              id TEXT PRIMARY KEY, owner TEXT NOT NULL, idem TEXT NOT NULL,
              input_hash TEXT NOT NULL, company_id TEXT NOT NULL REFERENCES companies(id),
              needs TEXT NOT NULL, created_at TEXT NOT NULL, batch_day TEXT NOT NULL,
              due_at TEXT NOT NULL, UNIQUE(owner,idem));
            CREATE TABLE IF NOT EXISTS features (
              id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL,
              detail TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS jobs (
              id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
              batch_day TEXT NOT NULL, due_at TEXT NOT NULL, status TEXT NOT NULL,
              packet TEXT, UNIQUE(company_id,batch_day));
            CREATE TABLE IF NOT EXISTS snapshots (
              id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
              batch_day TEXT NOT NULL, published_at TEXT NOT NULL, packet TEXT NOT NULL,
              digest TEXT NOT NULL, status TEXT NOT NULL, UNIQUE(company_id,batch_day));
            CREATE TABLE IF NOT EXISTS posts (
              id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
              owner TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
              evidence TEXT NOT NULL DEFAULT 'E0', created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS votes (
              post_id TEXT NOT NULL REFERENCES posts(id), owner TEXT NOT NULL,
              PRIMARY KEY(post_id,owner));
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            INSERT OR IGNORE INTO settings VALUES ('forum_enabled','false');
            ''')

    @contextmanager
    def db(self):
        con = sqlite3.connect(self.path, timeout=10)
        con.row_factory = sqlite3.Row
        con.execute('PRAGMA foreign_keys=ON')
        try:
            yield con
            con.commit()
        except Exception:
            con.rollback()
            raise
        finally:
            con.close()

    def cohort(self, at: datetime) -> tuple[str, str]:
        local = at.astimezone(self.tz)
        day = local.date()
        due = datetime.combine(day + timedelta(days=1), time(self.publish_hour), self.tz)
        return str(day), iso(due)

    def setting(self, key: str) -> bool:
        with self.db() as c:
            row = c.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
            return bool(row and row[0] == 'true')

    def set_forum(self, enabled: bool) -> None:
        with self.db() as c:
            c.execute("UPDATE settings SET value=? WHERE key='forum_enabled'",
                      ('true' if enabled else 'false',))

    def register(self, owner: str, payload: dict, idem: str, at: datetime | None = None) -> dict:
        at = at or utcnow()
        name = str(payload.get('name', '')).strip()
        region = str(payload.get('region', '')).strip()
        needs = payload.get('needs', [])
        if not 2 <= len(name) <= 120 or not 1 <= len(region) <= 120:
            raise ValueError('请填写公司名称（2—120字）和国家/地区或城市')
        if not isinstance(needs, list) or not needs or any(n not in NEEDS for n in needs):
            raise ValueError('请选择至少一个有效需求')
        if payload.get('consent') is not True:
            raise ValueError('请确认本地演示数据说明')
        if not 8 <= len(idem) <= 100:
            raise ValueError('请求标识无效')
        site = str(payload.get('website', '')).strip()
        if site and (len(site) > 300 or not re.match(r'^https?://[^\s]+$', site)):
            raise ValueError('官网应为 http 或 https 地址')
        registry = str(payload.get('registry_id', '')).strip()
        if len(registry) > 80:
            raise ValueError('企业标识过长')
        hashed = digest(payload)
        day, due = self.cohort(at)
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            old = c.execute('SELECT * FROM requests WHERE owner=? AND idem=?',
                            (owner, idem)).fetchone()
            if old:
                if old['input_hash'] != hashed:
                    raise ValueError('相同请求标识对应不同内容；请重新提交')
                return self._receipt(c, old)
            cid = payload.get('company_id')
            if cid:
                co = c.execute('SELECT * FROM companies WHERE id=?', (cid,)).fetchone()
                own = c.execute('SELECT 1 FROM requests WHERE company_id=? AND owner=?',
                                (cid, owner)).fetchone()
                if not co or not (co['public'] or own):
                    raise LookupError('无法访问该公司空间')
            else:
                # No name-only entity merge: same names can be different legal persons.
                cid = uid('co')
                c.execute('INSERT INTO companies VALUES (?,?,?,?,?,?,?,?)',
                          (cid, name, region, site, registry, int(payload.get('public', False)),
                           int(payload.get('synthetic', False)), iso(at)))
            # A later user cannot publish another user's private placeholder.
            rid = uid('rq')
            c.execute('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?,?)',
                      (rid, owner, idem, hashed, cid, json.dumps(sorted(set(needs))),
                       iso(at), day, due))
            c.execute('INSERT OR IGNORE INTO jobs VALUES (?,?,?,?,?,?)',
                      (uid('job'), cid, day, due, 'QUEUED', None))
            return self._receipt(c, c.execute('SELECT * FROM requests WHERE id=?', (rid,)).fetchone())

    def _receipt(self, c, row) -> dict:
        r = dict(row)
        r.pop('owner', None); r.pop('idem', None); r.pop('input_hash', None)
        r['needs'] = json.loads(r['needs'])
        co = c.execute('SELECT name,public FROM companies WHERE id=?', (r['company_id'],)).fetchone()
        job = c.execute('SELECT status FROM jobs WHERE company_id=? AND batch_day=?',
                        (r['company_id'], r['batch_day'])).fetchone()
        r.update(name=co['name'], public=bool(co['public']), status=job['status'])
        return r

    def mine(self, owner: str) -> dict:
        with self.db() as c:
            rs = c.execute('SELECT * FROM requests WHERE owner=? ORDER BY created_at DESC', (owner,)).fetchall()
            fs = c.execute('SELECT id,title,detail,created_at FROM features WHERE owner=? ORDER BY created_at DESC', (owner,)).fetchall()
            return {'requests': [self._receipt(c, r) for r in rs], 'features': [dict(f) for f in fs]}

    def features(self, owner: str, title: str, detail: str) -> dict:
        if not 2 <= len(title.strip()) <= 100 or len(detail) > 600:
            raise ValueError('功能名称需2—100字，说明最多600字')
        data = {'id': uid('ft'), 'title': title.strip(), 'detail': detail.strip(),
                'created_at': iso(utcnow()), 'status': 'RECEIVED_PRIVATE'}
        with self.db() as c:
            c.execute('INSERT INTO features VALUES (?,?,?,?,?)',
                      (data['id'], owner, data['title'], data['detail'], data['created_at']))
        return data

    def list_companies(self) -> list[dict]:
        with self.db() as c:
            rows = c.execute('SELECT * FROM companies WHERE public=1 ORDER BY created_at DESC').fetchall()
            result = []
            for r in rows:
                co = dict(r)
                snap = c.execute('SELECT status,published_at FROM snapshots WHERE company_id=? ORDER BY published_at DESC LIMIT 1', (co['id'],)).fetchone()
                co.update(status=snap['status'] if snap else 'QUEUED', updated_at=snap['published_at'] if snap else None)
                result.append(co)
            return result

    def company(self, cid: str, owner: str) -> dict:
        with self.db() as c:
            r = c.execute('SELECT * FROM companies WHERE id=?', (cid,)).fetchone()
            own = c.execute('SELECT 1 FROM requests WHERE company_id=? AND owner=?', (cid, owner)).fetchone()
            if not r or not (r['public'] or own):
                raise LookupError('未找到可访问的公司空间')
            out = dict(r)
            snapshots = c.execute('SELECT * FROM snapshots WHERE company_id=? ORDER BY published_at DESC', (cid,)).fetchall()
            out['snapshots'] = [dict(s, packet=json.loads(s['packet'])) for s in snapshots]
            out['due_at'] = c.execute('SELECT due_at FROM jobs WHERE company_id=? ORDER BY batch_day DESC LIMIT 1', (cid,)).fetchone()[0]
            out['status'] = snapshots[0]['status'] if snapshots else 'QUEUED'
            out['forum_enabled'] = self.setting('forum_enabled') and bool(r['public'])
            # Public projection contains no requests, requester identities or intentions.
            return out

    def prepare(self, cid: str, day: str, packet: dict) -> str:
        with self.db() as c:
            co = c.execute('SELECT * FROM companies WHERE id=?', (cid,)).fetchone()
            job = c.execute('SELECT * FROM jobs WHERE company_id=? AND batch_day=?', (cid, day)).fetchone()
            if not co or not job:
                raise LookupError('未找到公司或该日任务')
            if job['status'] not in ('QUEUED', 'PREPARED'):
                raise ValueError('此批次已发布；更新应创建新版本批次')
            validate_packet(packet, co)
            value = json.dumps(packet, ensure_ascii=False, sort_keys=True)
            c.execute("UPDATE jobs SET packet=?,status='PREPARED' WHERE id=?", (value, job['id']))
            return digest(packet)

    def release(self, at: datetime | None = None) -> list[dict]:
        """One finite atomic release. No networking, scheduler, hidden agent, or shell commands."""
        at = at or utcnow()
        emitted = []
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            jobs = c.execute("SELECT * FROM jobs WHERE due_at<=? AND status IN ('QUEUED','PREPARED') ORDER BY batch_day,id", (iso(at),)).fetchall()
            for job in jobs:
                co = c.execute('SELECT * FROM companies WHERE id=?', (job['company_id'],)).fetchone()
                packet = json.loads(job['packet']) if job['packet'] else empty_packet(co)
                validate_packet(packet, co)
                known = sum(bool(s['items']) for s in packet['sections'].values())
                status = 'PUBLISHED_PARTIAL' if known else 'SOURCE_UNAVAILABLE'
                sid = uid('snap')
                c.execute('INSERT OR IGNORE INTO snapshots VALUES (?,?,?,?,?,?,?)',
                          (sid, co['id'], job['batch_day'], iso(at), json.dumps(packet, ensure_ascii=False), digest(packet), status))
                c.execute('UPDATE jobs SET status=? WHERE id=?', (status, job['id']))
                emitted.append({'company_id': co['id'], 'status': status, 'covered_sections': known,
                                'total_sections': len(SECTIONS), 'snapshot_id': sid})
        return emitted

    def posts(self, cid: str, owner: str) -> list[dict]:
        co = self.company(cid, owner)
        if not co['public']:
            return []
        with self.db() as c:
            return [dict(x) for x in c.execute('SELECT p.id,p.title,p.body,p.evidence,p.created_at,COUNT(v.owner) AS votes FROM posts p LEFT JOIN votes v ON v.post_id=p.id WHERE p.company_id=? GROUP BY p.id ORDER BY p.created_at DESC', (cid,)).fetchall()]

    def post(self, cid: str, owner: str, title: str, body: str) -> dict:
        co = self.company(cid, owner)
        if not co['forum_enabled']:
            raise ValueError('论坛尚未开放；可先登记讨论需求')
        if not 2 <= len(title.strip()) <= 100 or not 2 <= len(body.strip()) <= 2000:
            raise ValueError('标题2—100字，正文2—2000字')
        result = {'id': uid('post'), 'evidence': 'E0'}
        with self.db() as c:
            c.execute('INSERT INTO posts VALUES (?,?,?,?,?,?,?)',
                      (result['id'], cid, owner, title.strip(), body.strip(), 'E0', iso(utcnow())))
        return result

    def vote(self, pid: str, owner: str) -> None:
        if not self.setting('forum_enabled'):
            raise ValueError('论坛尚未开放')
        with self.db() as c:
            post = c.execute('SELECT p.id FROM posts p JOIN companies co ON co.id=p.company_id WHERE p.id=? AND co.public=1', (pid,)).fetchone()
            if not post:
                raise LookupError('讨论不存在')
            c.execute('INSERT OR IGNORE INTO votes VALUES (?,?)', (pid, owner))


def empty_packet(company) -> dict:
    return {'version': '0.2', 'company_id': company['id'], 'synthetic': bool(company['synthetic']),
            'review': {'status': 'NO_DATA', 'reviewer': None},
            'identity_status': 'UNRESOLVED', 'sources': [],
            'sections': {k: {'status': 'NO_DATA', 'items': [],
                            'gap': '本轮未接入可用研究材料；尚未核实，不代表不存在。'} for k in SECTIONS}}


def validate_packet(packet: dict, company) -> None:
    if packet.get('company_id') != company['id']:
        raise ValueError('研究包主体不匹配')
    if bool(packet.get('synthetic')) != bool(company['synthetic']):
        raise ValueError('演示数据与真实主体不得混用')
    if set(packet.get('sections', {})) != set(SECTIONS):
        raise ValueError('研究包必须包含全部七个栏目，可明确标记缺口')
    sources = packet.get('sources', [])
    ids = [s.get('id') for s in sources]
    if len(ids) != len(set(ids)) or any(not i for i in ids):
        raise ValueError('来源标识缺失或重复')
    for source in sources:
        if not all(source.get(k) for k in ('title', 'url', 'accessed_at', 'publisher', 'reuse_status')):
            raise ValueError('来源缺少标题、地址、核验时间、发布者或使用范围')
        if not re.match(r'^https?://[^\s]+$', source['url']):
            raise ValueError('来源地址无效')
        datetime.fromisoformat(source['accessed_at'])
    has_items = False
    for key, section in packet['sections'].items():
        if section.get('status') not in ('NO_DATA', 'PARTIAL', 'DOCUMENTED', 'CONFLICT'):
            raise ValueError('栏目状态无效')
        if not isinstance(section.get('items'), list):
            raise ValueError('栏目条目类型无效')
        if not section['items'] and not section.get('gap'):
            raise ValueError('空栏目必须解释资料缺口')
        for item in section['items']:
            has_items = True
            if not item.get('text') or not item.get('source_ids') or not set(item['source_ids']) <= set(ids):
                raise ValueError('事实条目缺少有效来源；不能补造事实')
            if not item.get('as_of') or not item.get('basis'):
                raise ValueError('必须说明关系或事实的时点、来源性质')
            if key in ('ownership', 'supply_chain', 'facilities') and not item.get('relationship_type'):
                raise ValueError('关联条目必须保留关系类型')
    if has_items and packet.get('identity_status') != 'MATCHED':
        raise ValueError('主体未匹配时不得发布关联事实')
    review = packet.get('review', {})
    if has_items and (review.get('status') != 'APPROVED' or not review.get('reviewer')):
        raise ValueError('首版研究材料需有复核记录；模型自报完成不等于接受')
