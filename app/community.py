"""Community-maintained facts, products, independent review and safe projections.

Unverified contributions may be public at E0. Publication, evidence review and
permission to redistribute are three independent states. No network fetches.
"""
from __future__ import annotations
import ipaddress
import json
import re
from datetime import date, timedelta
from urllib.parse import urlsplit, urlunsplit, unquote
from .platform import Store as PlatformStore, public_text, text
from .core import uid, utcnow, iso, digest

LICENSE_ID = 'LicenseRef-LTP-Public-Interest-1.0'
KINDS = {'product', 'company_fact', 'relationship', 'labour_claim', 'product_claim'}
DIMENSIONS = {'pay', 'rest', 'hours', 'safety', 'contract', 'respect', 'representation', 'other'}
RIGHTS = {'own_summary', 'permission', 'public_domain', 'reference_only'}
SOURCE_TYPES = {'first_person', 'company_disclosure', 'public_record', 'official_decision', 'other'}
PUBLIC_KEYS = ('id','company_id','kind','title','description','scope','period_start','period_end',
               'direction','dimension','product_id','relation','category','version','evidence',
               'status','created_at','updated_at','credit_name','export_approved')


def clean(value, minimum=0, maximum=2000):
    value = public_text(value, minimum, maximum)
    if re.search(r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|(?<!\d)\d{12,19}(?!\d)', value):
        raise ValueError('公开字段可能包含邮箱或私人号码，请移除后再提交')
    return value


def source_url(value):
    """Accept only credential-free public HTTPS references, without query tracking.
    This is syntactic validation, not proof a source exists. Never auto-fetch.
    """
    value = text(value, 8, 500)
    clean(unquote(value), 8, 500)
    u = urlsplit(value)
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.query or u.fragment:
        raise ValueError('来源请使用无账号、查询参数和片段的公开HTTPS地址')
    host = u.hostname.lower()
    if host in {'localhost','localhost.localdomain'} or host.endswith(('.local','.internal','.localhost')) or '.' not in host:
        raise ValueError('来源必须是公开网站地址')
    try:
        addr = ipaddress.ip_address(host)
        if not addr.is_global: raise ValueError('不接受内网来源地址')
    except ValueError as e:
        if ':' in host or re.fullmatch(r'[\d.]+',host): raise ValueError('不接受IP来源地址') from e
    if u.port not in (None,443): raise ValueError('来源不支持自定义端口')
    return urlunsplit(('https',host,u.path or '/','',''))


def date_value(value):
    if not value: return ''
    try: return date.fromisoformat(value).isoformat()
    except (ValueError,TypeError): raise ValueError('日期请使用YYYY-MM-DD')


class Store(PlatformStore):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs)
        with self.db() as c:
            c.executescript('''
            CREATE TABLE IF NOT EXISTS contributions(
             id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), owner TEXT NOT NULL,
             kind TEXT NOT NULL, payload TEXT NOT NULL, public INTEGER NOT NULL,
             version INTEGER NOT NULL DEFAULT 1, evidence TEXT NOT NULL DEFAULT 'E0',
             status TEXT NOT NULL DEFAULT 'PENDING', export_approved INTEGER NOT NULL DEFAULT 0,
             created_at TEXT NOT NULL, updated_at TEXT NOT NULL, input_hash TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS contribution_company ON contributions(company_id,kind,status);
            CREATE TABLE IF NOT EXISTS contribution_versions(
             id TEXT NOT NULL REFERENCES contributions(id), version INTEGER NOT NULL,
             payload TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(id,version));
            CREATE TABLE IF NOT EXISTS contribution_reviews(
             id TEXT PRIMARY KEY, contribution_id TEXT NOT NULL REFERENCES contributions(id),
             version INTEGER NOT NULL, reviewer TEXT NOT NULL, decision TEXT NOT NULL,
             evidence TEXT NOT NULL, rationale TEXT NOT NULL, checks TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS review_roles(owner TEXT PRIMARY KEY, granted_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS contribution_flags(
             id TEXT PRIMARY KEY, contribution_id TEXT NOT NULL REFERENCES contributions(id),
             owner TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS export_reviews(
             id TEXT PRIMARY KEY, contribution_id TEXT NOT NULL REFERENCES contributions(id), version INTEGER NOT NULL,
             reviewer TEXT NOT NULL, action TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
            INSERT OR IGNORE INTO schema_versions VALUES ('0.4', datetime('now'));
            ''')

    def capabilities(self):
        result = super().capabilities()
        result.update({'contributions': True, 'showcase': result.get('rankings',False), 'public_data': True})
        return result

    def _validated(self,owner,data):
        if not isinstance(data,dict): raise ValueError('贡献需要结构化对象')
        allowed = {'company_id','kind','title','description','scope','period_start','period_end','direction',
                   'dimension','product_id','relation','category','sources','public','consent','share_consent',
                   'rights','rights_note','credit_name'}
        if set(data)-allowed: raise ValueError('不接受未定义字段或用户指定证据等级')
        co=self.company(data.get('company_id',''),owner)
        if data.get('public') is True and not co['public']: raise ValueError('私密公司空间不能公开贡献')
        if data.get('consent') is not True: raise ValueError('请确认所选公开范围')
        kind=data.get('kind')
        if kind not in KINDS: raise ValueError('贡献类型无效')
        rights=data.get('rights','reference_only')
        if rights not in RIGHTS: raise ValueError('版权声明无效')
        if data.get('share_consent') is True and rights=='reference_only':
            raise ValueError('仅供参考的第三方材料不能授权公益再分发')
        p={'kind':kind,'company_id':co['id'],'title':clean(data.get('title',''),2,120),
           'description':clean(data.get('description',''),2,2000),'scope':clean(data.get('scope',''),0,300),
           'period_start':date_value(data.get('period_start','')),'period_end':date_value(data.get('period_end','')),
           'direction':data.get('direction','neutral'),'dimension':data.get('dimension','other'),
           'product_id':data.get('product_id',''),'relation':clean(data.get('relation',''),0,80),
           'category':clean(data.get('category',''),0,80),'public':data.get('public') is True,
           'share_consent':data.get('share_consent') is True,'rights':rights,
           'rights_note':clean(data.get('rights_note',''),0,500),'credit_name':clean(data.get('credit_name',''),0,40),
           'sources':[]}
        if p['direction'] not in {'neutral','positive','negative'} or p['dimension'] not in DIMENSIONS:
            raise ValueError('主张方向或领域无效')
        if p['period_start'] and p['period_end'] and p['period_start']>p['period_end']:
            raise ValueError('起止日期顺序错误')
        if kind in {'labour_claim','product_claim'} and p['direction']=='neutral':
            raise ValueError('请明确该项具体主张是正向还是负向')
        if p['product_id']:
            product=self.contribution(p['product_id'],owner)
            if product['kind']!='product' or product['company_id']!=co['id']:
                raise ValueError('产品必须来自同一公司空间')
            if p['public'] and not product['public']: raise ValueError('不能公开引用私密产品')
        elif kind=='product_claim': raise ValueError('请指定被评价的产品')
        if p['share_consent'] and rights=='permission' and not p['rights_note']:
            raise ValueError('请说明允许再分发的授权依据')
        sources=data.get('sources',[])
        if not isinstance(sources,list) or len(sources)>10: raise ValueError('最多10个来源')
        for i,s in enumerate(sources):
            if not isinstance(s,dict) or set(s)-{'url','title','type','published_at','supports'}: raise ValueError('来源字段无效')
            st=s.get('type','other')
            if st not in SOURCE_TYPES: raise ValueError('来源类型无效')
            p['sources'].append({'id':'S'+str(i+1),'url':source_url(s.get('url','')),
              'title':clean(s.get('title',''),2,200),'type':st,'published_at':date_value(s.get('published_at','')),
              'supports':clean(s.get('supports',''),2,1000)})
        return p

    def contribute_many(self,owner,items):
        self.require('contributions')
        if not isinstance(items,list) or not 1<=len(items)<=50: raise ValueError('每次提交1—50条贡献')
        validated=[self._validated(owner,p) for p in items]  # no partial writes on validation failure
        result=[]
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            recent=c.execute('SELECT COUNT(*) FROM contributions WHERE owner=? AND created_at>?',
                             (owner,iso(utcnow()-timedelta(hours=1)))).fetchone()[0]
            if recent+len(items)>100: raise ValueError('本小时贡献数量已达本地配额，请稍后再试')
            for p in validated:
                h=digest(p)
                old=c.execute("SELECT id FROM contributions WHERE owner=? AND input_hash=? AND status!='WITHDRAWN'",(owner,h)).fetchone()
                if old: result.append({'id':old['id'],'duplicate':True});continue
                cid=uid('con');at=iso(utcnow());raw=json.dumps(p,ensure_ascii=False)
                c.execute('INSERT INTO contributions VALUES (?,?,?,?,?,?,1,\'E0\',\'PENDING\',0,?,?,?)',
                          (cid,p['company_id'],owner,p['kind'],raw,int(p['public']),at,at,h))
                c.execute('INSERT INTO contribution_versions VALUES (?,1,?,?)',(cid,raw,at))
                result.append({'id':cid,'evidence':'E0','status':'PENDING','public':p['public'],'duplicate':False})
        return result

    def _row(self,c,cid):
        r=c.execute('SELECT * FROM contributions WHERE id=?',(cid,)).fetchone()
        if not r: raise LookupError('未找到该贡献')
        return dict(r)

    def _projection(self,c,r,owner='',private=False):
        p=json.loads(r['payload'])
        value={k:r.get(k,p.get(k,'')) for k in PUBLIC_KEYS}
        value.update(public=bool(r['public']),is_mine=r['owner']==owner,export_approved=bool(r['export_approved']),
                     credit_name=p.get('credit_name') or '匿名贡献者',sources=p['sources'])
        reviews=c.execute('SELECT version,decision,evidence,rationale,created_at FROM contribution_reviews WHERE contribution_id=? ORDER BY created_at',(r['id'],)).fetchall()
        # Do not leak old withdrawn/private payloads or reviewers' identities.
        value['reviews']=[dict(x) for x in reviews if x['version']==r['version']]
        if private: value.update(share_consent=p['share_consent'],rights=p['rights'],rights_note=p['rights_note'])
        return value

    def contribution(self,cid,owner=''):
        with self.db() as c:
            r=self._row(c,cid)
            if r['owner']!=owner and (not r['public'] or r['status'] in {'WITHDRAWN','REJECTED'}):
                raise LookupError('贡献不存在或未公开')
            self.company(r['company_id'],owner)
            return self._projection(c,r,owner,r['owner']==owner)

    def contributions(self,owner='',company_id='',mine=False,kind=''):
        if kind and kind not in KINDS: raise ValueError('类型无效')
        if company_id:self.company(company_id,owner)
        with self.db() as c:
            rows=c.execute('SELECT x.* FROM contributions x JOIN companies co ON co.id=x.company_id WHERE '
                + ('x.owner=?' if mine else "x.public=1 AND co.public=1 AND x.status NOT IN ('WITHDRAWN','REJECTED')")
                +' ORDER BY x.updated_at DESC', (owner,) if mine else ()).fetchall()
            return [self._projection(c,dict(r),owner,mine) for r in rows
                    if (not company_id or r['company_id']==company_id) and (not kind or r['kind']==kind)]

    def revise_contribution(self,cid,owner,data,version):
        p=self._validated(owner,data)
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE');r=self._row(c,cid)
            if r['owner']!=owner: raise PermissionError('只能修改自己的贡献；其他人可以提交纠错')
            if version!=r['version']: raise ValueError('版本已变化，请刷新后重试')
            if p['company_id']!=r['company_id'] or p['kind']!=r['kind']: raise ValueError('不能将已有贡献改成另一家公司或类型')
            if r['status']=='WITHDRAWN': raise ValueError('撤回记录不能直接恢复；请新建贡献')
            version+=1;raw=json.dumps(p,ensure_ascii=False);at=iso(utcnow())
            c.execute("UPDATE contributions SET payload=?,public=?,version=?,evidence='E0',status='PENDING',export_approved=0,updated_at=?,input_hash=? WHERE id=?",
                      (raw,int(p['public']),version,at,digest(p),cid))
            c.execute('INSERT INTO contribution_versions VALUES (?,?,?,?)',(cid,version,raw,at))
            self._audit(c,owner,'REVISE_CONTRIBUTION',cid,'修改后需重新核验与再分发审查')
        return self.contribution(cid,owner)

    def withdraw_contribution(self,cid,owner):
        with self.db() as c:
            r=self._row(c,cid)
            if r['owner']!=owner:raise PermissionError('只能撤回自己的贡献')
            c.execute("UPDATE contributions SET public=0,status='WITHDRAWN',export_approved=0 WHERE id=?",(cid,))
            self._audit(c,owner,'WITHDRAW_CONTRIBUTION',cid,'停止后续展示及导出；已下载副本不能保证回收')

    def grant_reviewer(self,username,active=True):
        with self.db() as c:
            r=c.execute('SELECT id FROM accounts WHERE username=?',(username,)).fetchone()
            if not r: raise LookupError('请先创建核验员账号')
            if active:c.execute('INSERT OR IGNORE INTO review_roles VALUES (?,?)',(r[0],iso(utcnow())))
            else:c.execute('DELETE FROM review_roles WHERE owner=?',(r[0],))
            self._audit(c,'operator','REVIEW_ROLE',r[0],'grant' if active else 'revoke')

    def can_review(self,owner):
        with self.db() as c:return bool(c.execute('SELECT 1 FROM review_roles WHERE owner=?',(owner,)).fetchone())

    def review_queue(self,owner):
        if not self.can_review(owner):raise PermissionError('需要已授权核验员账号')
        # Private submissions never enter shared review queues.
        with self.db() as c:
            result=[]
            for r in c.execute("SELECT * FROM contributions WHERE public=1 AND status!='WITHDRAWN' AND (status!='REJECTED' OR EXISTS (SELECT 1 FROM contribution_flags f WHERE f.contribution_id=contributions.id AND f.status='OPEN')) ORDER BY updated_at"):
                item=self._projection(c,dict(r),owner,True)
                item['pending_flags']=[dict(f) for f in c.execute("SELECT id,reason,created_at FROM contribution_flags WHERE contribution_id=? AND status='OPEN'",(r['id'],))]
                result.append(item)
            return result

    def review_contribution(self,cid,reviewer,version,decision,evidence,rationale,checks):
        if not self.can_review(reviewer):raise PermissionError('需要已授权核验员账号')
        if decision not in {'approve','reject','dispute','reopen'}:raise ValueError('核验决定无效')
        if evidence not in {'E0','E1','E2','E3','E4','E5'}:raise ValueError('证据等级无效')
        rationale=clean(rationale,8,1000)
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE');r=self._row(c,cid);p=json.loads(r['payload'])
            if r['owner']==reviewer: raise PermissionError('不能核验自己的贡献')
            if not r['public'] or r['status']=='WITHDRAWN':raise PermissionError('不向核验员开放私密或撤回材料')
            if r['version']!=version:raise ValueError('版本已变化，请重新核对原文')
            if decision=='approve':
                if checks.get('scope_checked') is not True:raise ValueError('需确认结论覆盖范围')
                if int(evidence[1])>=2 and not p['sources']:raise ValueError('缺少来源，不能提升至材料等级')
                if int(evidence[1])>=3:
                    if not p['scope'] or not p['period_start'] or not p['period_end']:raise ValueError('高证据主张需要明确范围及起止时间')
                    if checks.get('authenticity_checked') is not True:raise ValueError('需记录来源真实性核对')
                    refs=checks.get('source_ids',[])
                    if not refs or not set(refs).issubset({s['id'] for s in p['sources']}):raise ValueError('请选择实际支持该主张的来源')
                if evidence=='E5':
                    if not any(s['type']=='official_decision' and s['id'] in checks.get('source_ids',[]) for s in p['sources']):raise ValueError('E5需要支持同一主张的正式认定')
                    if not checks.get('decision_reference') or checks.get('effective') is not True:raise ValueError('需明确正式决定编号与当前效力')
                status='VERIFIED' if int(evidence[1])>=3 else 'REVIEWED'
            else:
                status={'reject':'REJECTED','dispute':'DISPUTED','reopen':'PENDING'}[decision]
                evidence=r['evidence'] if decision=='dispute' else 'E0'
            c.execute('INSERT INTO contribution_reviews VALUES (?,?,?,?,?,?,?,?,?)',(uid('review'),cid,version,reviewer,decision,evidence,rationale,json.dumps(checks,ensure_ascii=False),iso(utcnow())))
            c.execute('UPDATE contributions SET status=?,evidence=?,export_approved=0,updated_at=? WHERE id=?',(status,evidence,iso(utcnow()),cid))
            c.execute("UPDATE contribution_flags SET status='REVIEWED' WHERE contribution_id=? AND status='OPEN'",(cid,))
            self._audit(c,reviewer,'REVIEW_CONTRIBUTION',cid,decision)
        return {'id':cid,'status':status,'evidence':evidence}

    def flag_contribution(self,cid,owner,reason):
        self.contribution(cid,owner);reason=text(reason,5,1000)
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            existing=c.execute("SELECT id FROM contribution_flags WHERE contribution_id=? AND owner=? AND status='OPEN'",(cid,owner)).fetchone()
            if existing:return {'id':existing[0],'status':'OPEN','message':'你的纠错已在等待处理，不会重复计数'}
            count=c.execute('SELECT COUNT(*) FROM contribution_flags WHERE owner=? AND created_at>=?',(owner,iso(utcnow()-timedelta(hours=1)))).fetchone()[0]
            if count>=20:raise ValueError('本小时反馈已达上限')
            fid=uid('flag');c.execute('INSERT INTO contribution_flags VALUES (?,?,?,?,\'OPEN\',?)',(fid,cid,owner,reason,iso(utcnow())))
            # A flag alone does not decide truth or erase E0 discussion. Stop bulk redistribution pending review.
            c.execute('UPDATE contributions SET export_approved=0 WHERE id=?',(cid,))
        return {'id':fid,'status':'OPEN','message':'纠错已私密提交；不等于认定内容失实'}

    def approve_export(self,cid,reviewer,version,privacy_checked,rights_checked,reason):
        if not self.can_review(reviewer):raise PermissionError('需要已授权核验员账号')
        reason=clean(reason,8,1000)
        if privacy_checked is not True or rights_checked is not True:raise ValueError('需分别完成隐私与版权检查')
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE');r=self._row(c,cid);p=json.loads(r['payload'])
            if reviewer==r['owner']:raise PermissionError('不能批准自己贡献的导出')
            review=c.execute("SELECT reviewer FROM contribution_reviews WHERE contribution_id=? AND version=? AND decision='approve' ORDER BY created_at DESC LIMIT 1",(cid,version)).fetchone()
            if not review or review['reviewer']==reviewer:raise PermissionError('数据开放须由另一名核验员复核')
            if version!=r['version'] or r['status'] not in {'REVIEWED','VERIFIED'} or not r['public']:raise ValueError('仅当前已复核证据状态的公开版本可供再分发')
            if not p['share_consent'] or p['rights']=='reference_only':raise ValueError('没有独立的公益再分发授权')
            if c.execute("SELECT 1 FROM contribution_flags WHERE contribution_id=? AND status='OPEN'",(cid,)).fetchone():raise ValueError('存在待处理纠错，暂停再分发')
            c.execute('UPDATE contributions SET export_approved=1 WHERE id=?',(cid,))
            c.execute('INSERT INTO export_reviews VALUES (?,?,?,?,?,?,?)',(uid('export_review'),cid,version,reviewer,'APPROVE',reason,iso(utcnow())))
        return {'id':cid,'export_approved':True,'license':LICENSE_ID}

    def safe_dataset(self):
        """Allowlist-only dataset. Never serializes databases, private cases or member IDs."""
        categories={k:[] for k in sorted(KINDS)}
        with self.db() as c:
            rows=c.execute("SELECT x.*,co.name AS company_name,co.region AS region,co.synthetic AS synthetic FROM contributions x JOIN companies co ON x.company_id=co.id WHERE x.public=1 AND co.public=1 AND x.status IN ('REVIEWED','VERIFIED') AND x.export_approved=1 ORDER BY x.id").fetchall()
            for r in rows:
                p=json.loads(r['payload'])
                if not p['share_consent'] or p['rights']=='reference_only':continue
                if c.execute("SELECT 1 FROM contribution_flags WHERE contribution_id=? AND status='OPEN'",(r['id'],)).fetchone():continue
                item={k:p[k] for k in ('title','description','scope','period_start','period_end','dimension','direction','relation','category','product_id')}
                item.update(id=r['id'],version=r['version'],company_id=r['company_id'],company_name=r['company_name'],region=r['region'],synthetic=bool(r['synthetic']),
                            evidence=r['evidence'],credit=p['credit_name'] or '匿名贡献者',
                            sources=[{k:s[k] for k in ('url','title','type','published_at','supports')} for s in p['sources']],
                            license=LICENSE_ID)
                # Re-scan only human-facing/public-origin fields. Internal random IDs can legitimately
                # contain long digit runs and must not be mistaken for phone/account numbers.
                human={k:item[k] for k in ('title','description','scope','company_name','region','credit','relation','category')}
                human['sources']=[{k:s[k] for k in ('url','title','supports')} for s in item['sources']]
                clean(json.dumps(human,ensure_ascii=False),2,20000)
                categories[r['kind']].append(item)
        return {'schema_version':'0.4','license':LICENSE_ID,'purpose':'仅限非商业公益用途；不授予第三方原文、商标或个人信息权利',
                'generated_at':iso(utcnow()),'categories':categories,'record_count':sum(map(len,categories.values())),
                'withdrawal_notice':'本端点排除后续撤回与纠错中的条目；已下载副本不能保证回收。'}

    def showcase(self,owner='',lane='community_positive',query='',days=7):
        self.require('showcase')
        if lane not in {'community_positive','community_negative','evidence_positive'}:raise ValueError('展示分区无效')
        if days not in {7,30,90}:raise ValueError('时间窗只支持7、30或90天')
        query=text(query,0,100).casefold();since=iso(utcnow()-timedelta(days=days));now=utcnow().date().isoformat();items=[]
        contributions=self.contributions()
        with self.db() as c:
            for co in self.list_companies():
                cid=co['id'];facts=[x for x in contributions if x['company_id']==cid]
                products=[x for x in facts if x['kind']=='product']
                if query and query not in (co['name']+' '+co['region']+' '+' '.join(p['title'] for p in products)).casefold():continue
                ballots={r[0]:r[1] for r in c.execute('SELECT direction,COUNT(*) FROM company_ballots WHERE company_id=? AND created_at>=? GROUP BY direction',(cid,since))}
                positive=ballots.get('positive',0);negative=ballots.get('negative',0)
                participants=c.execute('''SELECT COUNT(DISTINCT owner) FROM (
                  SELECT owner FROM posts WHERE company_id=? AND hidden=0 AND created_at>=?
                  UNION SELECT owner FROM company_ballots WHERE company_id=? AND created_at>=?
                  UNION SELECT x.owner FROM comments x JOIN posts p ON p.id=x.post_id WHERE p.company_id=? AND p.hidden=0 AND x.hidden=0 AND x.created_at>=?
                  UNION SELECT v.owner FROM votes v JOIN posts p ON p.id=v.post_id WHERE p.company_id=? AND p.hidden=0 AND v.created_at>=?)''',(cid,since,cid,since,cid,since,cid,since)).fetchone()[0]
                high=[x for x in facts if x['kind']=='labour_claim' and x['direction']=='positive' and x['status']=='VERIFIED' and int(x['evidence'][1])>=3 and x['period_start']<=now<=x['period_end']]
                # Unresolved counterclaims remain visible and exclude that item from the high-evidence lane.
                high=[x for x in high if not c.execute("SELECT 1 FROM contribution_flags WHERE contribution_id=? AND status='OPEN'",(x['id'],)).fetchone()]
                included=(positive>negative if lane=='community_positive' else negative>positive if lane=='community_negative' else bool(high))
                if not included:continue
                items.append({'company':co,'products':products,'positive':positive,'negative':negative,'participants':participants,
                    'sample_size':positive+negative,'small_sample':positive+negative<5,'positive_share':round(positive/(positive+negative),3) if positive+negative else None,
                    'verified_positive_claims':high,'other_claims':[x for x in facts if x['kind'] in {'labour_claim','product_claim'} and x not in high],
                    'max_evidence':max((x['evidence'] for x in facts),default='E0')})
        items.sort(key=lambda x:(-len(x['verified_positive_claims']) if lane=='evidence_positive' else -x['participants'],x['company']['name']))
        return {'lane':lane,'days':days,'items':items,'updated_at':iso(utcnow()),'method_version':'0.4',
          'method':'社区分区按去重参与账号数排序、按正负票多数归类；高证据分区只认当前有效的具体正向劳动主张。',
          'limits':'本站自愿样本，不代表全体员工。公司劳动评价不是产品质量检测；产品关联也需要独立核验。'}

    def signup(self,owner,username,password,token):
        new=super().signup(owner,username,password,token)
        _,aid,_=self.resolve_session(new)
        with self.db() as c:
            for table in ('contributions','contribution_flags'):c.execute(f'UPDATE {table} SET owner=? WHERE owner=?',(aid,owner))
        return new

    def login(self,owner,username,password,token):
        new=super().login(owner,username,password,token)
        if owner.startswith('visitor_'):
            _,aid,_=self.resolve_session(new)
            with self.db() as c:
                for table in ('contributions','contribution_flags'):c.execute(f'UPDATE {table} SET owner=? WHERE owner=?',(aid,owner))
        return new

    def export_account(self,owner):
        result=super().export_account(owner);result['contributions']=self.contributions(owner,mine=True);return result

    def delete_account(self,owner,token):
        # Remove originals and attribution; retain minimal anonymous change/audit references.
        with self.db() as c:
            for r in c.execute('SELECT id FROM contributions WHERE owner=?',(owner,)).fetchall():
                c.execute('DELETE FROM contribution_versions WHERE id=?',(r[0],))
            c.execute("UPDATE contributions SET owner='deleted-author',public=0,status='WITHDRAWN',export_approved=0,payload='{}' WHERE owner=?",(owner,))
            c.execute("UPDATE contribution_flags SET owner='deleted-author',reason='作者已删除私人纠错内容' WHERE owner=?",(owner,))
            c.execute('DELETE FROM review_roles WHERE owner=?',(owner,))
        with self.db() as c:
            private=[r[0] for r in c.execute("SELECT x.id FROM contributions x JOIN companies co ON x.company_id=co.id WHERE co.public=0 AND co.id IN (SELECT company_id FROM requests WHERE owner=?)",(owner,))]
            for cid in private:
                for table in ('contribution_reviews','export_reviews','contribution_flags'):c.execute(f'DELETE FROM {table} WHERE contribution_id=?',(cid,))
                c.execute('DELETE FROM contribution_versions WHERE id=?',(cid,))
                c.execute('DELETE FROM contributions WHERE id=?',(cid,))
        super().delete_account(owner,token)
