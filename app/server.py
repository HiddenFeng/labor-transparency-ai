"""Loopback-only demonstration server; do not deploy this demo with real personal data."""
from __future__ import annotations
import ipaddress
import os
import secrets
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict
from .research import Store
from .research_routes import install_research
from .platform import PHASE_NAMES
from .community_routes import install_community
from .routes import install
from .security import SecurityConfig, actor_hash, csrf_token, limit_for, rate_bucket
from .malware import ClamAVScanner

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'app' / 'web'

class CompanyRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=2, max_length=120)
    region: str = Field(min_length=1, max_length=120)
    website: str = Field(default='', max_length=300)
    registry_id: str = Field(default='', max_length=80)
    company_id: Optional[str] = None
    needs: list[str] = Field(min_length=1, max_length=5)
    public: bool = False
    consent: bool = False
    synthetic: bool = True  # Demo app only, not an attestation about real-world entities.

class FeatureRequest(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    detail: str = Field(default='', max_length=600)

class PostRequest(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    body: str = Field(min_length=2, max_length=2000)
    tone: str = "discussion"
    urgent: bool = False


def create_app(path=None, admin_token=None, public_research=False, research_network=False, research_client_factory=None,
               security_config=None):
    security = security_config or SecurityConfig.local()
    store = Store(path or os.getenv('LTP_DB', str(ROOT/'local-data'/'demo.sqlite3')),
                  os.getenv('LTP_TZ', 'Asia/Tokyo'), int(os.getenv('LTP_PUBLISH_HOUR', '9')))
    if security.production:
        scanner = ClamAVScanner(security.clamscan_path).scan if security.attachment_mode == 'clamav' else None
        store.configure_attachment_scanner(scanner, required=True)
    title = '劳动透明计划 · 生产候选' if security.production else '劳动透明计划 · 本地验证版'
    app = FastAPI(title=title, version='0.6.0', docs_url=None, redoc_url=None)
    app.state.store = store
    app.state.public_research = public_research
    app.state.research_network = research_network
    app.state.research_client_factory = research_client_factory
    app.state.security = security

    def denied(request, actor, event, message, status=403, detail=''):
        # RATE_LIMIT itself is intentionally not written per rejected request; that would turn a flood into log amplification.
        if security.production and event != 'RATE_LIMIT':
            store.security_event(actor, event, request.url.path, str(status), detail)
        headers = {'Retry-After': '60'} if status == 429 else None
        return JSONResponse({'error': message}, status_code=status, headers=headers)

    @app.middleware('http')
    async def bounds(request: Request, call_next):
        host = (request.url.hostname or '').lower().rstrip('.')
        remote = request.client.host if request.client else 'unknown'
        admin_remote = remote
        try:
            admin_remote = ipaddress.ip_address(remote).compressed
        except ValueError:
            pass  # TestClient and other non-IP sentinels remain exact-match only.
        actor = actor_hash(security.secret, remote) if security.production else ''
        if security.production:
            bucket = rate_bucket(request.url.path, request.method)
            if not store.security_rate(actor, bucket, limit_for(security, bucket)):
                return denied(request, actor, 'RATE_LIMIT', '请求过于频繁，请稍后再试', 429, bucket)
        if host not in security.allowed_hosts:
            return denied(request, actor, 'HOST_DENIED', '请求主机未获允许' if security.production else '本原型仅供本机验证')
        if security.production and security.require_https and request.url.scheme != 'https':
            return denied(request, actor, 'HTTPS_REQUIRED', '生产入口只接受HTTPS')
        if security.production and request.url.path.startswith('/api/admin') and admin_remote not in security.admin_allowed_ips:
            return denied(request, actor, 'ADMIN_NETWORK_DENIED', '管理入口仅允许来自受限运营网络的请求')

        mutating = request.method.upper() not in ('GET', 'HEAD', 'OPTIONS')
        if mutating:
            origin = request.headers.get('origin', '').rstrip('/')
            if security.production:
                if not origin or origin not in security.allowed_origins:
                    return denied(request, actor, 'ORIGIN_DENIED', '跨站请求未获允许')
            else:
                if origin and origin != str(request.base_url).rstrip('/'):
                    return JSONResponse({'error': '跨站请求未获允许'}, status_code=403)
                if request.headers.get('x-ltp-client') != 'local-demo':
                    return JSONResponse({'error': '缺少本地客户端标记'}, status_code=403)
            try:
                length = int(request.headers.get('content-length', '0'))
            except ValueError:
                return denied(request, actor, 'INVALID_LENGTH', '请求长度无效', 400)
            if length < 0 or length > 3000000:
                return denied(request, actor, 'BODY_TOO_LARGE', '请求过大', 413)
            body = await request.body()
            if len(body) > 3000000:
                return denied(request, actor, 'BODY_TOO_LARGE', '请求过大', 413)

        session, owner, fresh = store.resolve_session(request.cookies.get(security.cookie_name))
        request.state.owner = owner
        request.state.token = session
        request.state.security_actor = actor
        if security.production and mutating:
            provided = request.headers.get('x-ltp-csrf', '')
            expected = csrf_token(security.secret, session)
            if not provided or not secrets.compare_digest(provided, expected):
                return denied(request, actor, 'CSRF_DENIED', '请求校验失败，请刷新页面后重试')

        response = await call_next(request)
        rotated = getattr(request.state, 'rotated_token', None)
        if security.production and request.url.path.startswith('/api/admin'):
            store.security_event(actor, 'ADMIN_REQUEST', request.url.path, str(response.status_code), request.method.upper())
        if fresh or rotated:
            response.set_cookie(security.cookie_name, rotated or session, httponly=True, secure=security.cookie_secure,
                                samesite='strict', max_age=60*60*24*7, path='/')
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['X-Robots-Tag'] = 'noindex, nofollow'
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        if security.production:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(req, exc):
        return JSONResponse({'error': '输入不符合要求，请检查字段类型、长度及额外字段。'}, status_code=422)

    @app.exception_handler(ValueError)
    async def value_error(req, exc):
        return JSONResponse({'error': str(exc)}, status_code=400)

    @app.exception_handler(LookupError)
    async def not_found(req, exc):
        return JSONResponse({'error': str(exc)}, status_code=404)

    @app.get('/api/health')
    def health():
        with store.db() as c:
            c.execute('SELECT 1').fetchone()
        return {
            'status': 'ok',
            'version': '0.6',
            'security_profile': security.profile,
            'database': 'ok',
            'scheduler_active': bool(store.scheduler_status()['active']),
            'attachment_uploads_enabled': (not security.production) or security.attachment_mode == 'clamav',
        }

    @app.get('/api/config')
    def config(request: Request):
        mode = 'PRODUCTION_CANDIDATE' if security.production else ('LOCAL_PUBLIC_RESEARCH_TEST' if public_research else 'LOCAL_SYNTHETIC_DEMO')
        result = {'mode': mode, 'timezone': str(store.tz),
                  'publish_hour': store.publish_hour, 'forum_enabled': store.setting('forum_enabled'),
                  'network_research': research_network, 'scheduler_installed': store.scheduler_status()['active'],
                  'phase': store.phase(), 'phase_label': PHASE_NAMES[store.phase()],
                  'capabilities': store.capabilities(), 'version': '0.6',
                  'public_research_mode': public_research, 'research_network_enabled': research_network,
                  'source_adapter_available': 'GLEIF', 'research_requires_review': True,
                  'security_profile': security.profile,
                  'attachment_uploads_enabled': (not security.production) or security.attachment_mode == 'clamav',
                  'attachment_scan_mode': security.attachment_mode}
        if security.production:
            result['csrf_token'] = csrf_token(security.secret, request.state.token)
        return result

    @app.get('/api/companies')
    def companies():
        return store.list_companies()

    @app.post('/api/requests')
    def register(body: CompanyRequest, request: Request):
        if body.synthetic is not True and not (public_research and body.public):
            raise ValueError('真实公司仅允许在公开企业资料研究模式登记；不收集真实申诉材料')
        return store.register(request.state.owner, body.model_dump(), request.headers.get('idempotency-key', ''))

    @app.get('/api/me')
    def mine(request: Request):
        return store.mine(request.state.owner)

    @app.post('/api/features')
    def feature(body: FeatureRequest, request: Request):
        return store.features(request.state.owner, body.title, body.detail)

    @app.get('/api/companies/{cid}')
    def company(cid: str, request: Request):
        return store.company(cid, request.state.owner)

    @app.get('/api/companies/{cid}/posts')
    def posts(cid: str, request: Request):
        return store.posts(cid, request.state.owner)

    @app.post('/api/companies/{cid}/posts')
    def post(cid: str, body: PostRequest, request: Request):
        return store.post(cid, request.state.owner, body.title, body.body, body.tone, body.urgent)

    @app.post('/api/posts/{pid}/vote')
    def vote(pid: str, request: Request):
        store.vote(pid, request.state.owner)
        return {'ok': True}

    @app.get('/')
    def index():
        return FileResponse(WEB/'index.html')

    install(app, store, admin_token or os.getenv('LTP_ADMIN_TOKEN', ''))
    install_community(app, store, admin_token or os.getenv('LTP_ADMIN_TOKEN', ''))
    install_research(app, store, admin_token or os.getenv('LTP_ADMIN_TOKEN', ''))
    app.mount('/assets', StaticFiles(directory=WEB), name='assets')
    return app

app = create_app()
