"""Runtime security profiles for the local prototype and a future public service.

The production profile is deliberately fail-closed: it needs an external database,
independent high-entropy secrets, exact HTTPS origins and exact hosts. Merely importing
this module never enables public serving and never creates deployment resources.
"""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Tuple
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
_MUTATING = {'POST', 'PUT', 'PATCH', 'DELETE'}
_PLACEHOLDERS = ('change-me', 'changeme', 'example-secret', 'synthetic', 'test-only', 'password')


def _positive_int(value, name, default):
    raw = str(value or default)
    if not re.fullmatch(r'[1-9][0-9]{0,5}', raw):
        raise ValueError(name + ' 必须是1—999999之间的整数')
    return int(raw)


def _split_csv(value):
    return tuple(x.strip().lower() for x in (value or '').split(',') if x.strip())


def _strong_secret(value, name):
    if not isinstance(value, str) or len(value) < 32:
        raise ValueError(name + ' 必须至少32个字符，并由独立安全随机源生成')
    low = value.lower()
    if any(marker in low for marker in _PLACEHOLDERS):
        raise ValueError(name + ' 看起来仍是示例或占位值')
    return value


def _validate_host(host):
    if not host or '*' in host or '://' in host or '/' in host or '@' in host or any(ch.isspace() for ch in host):
        raise ValueError('LTP_ALLOWED_HOSTS 只接受精确主机名，不允许通配符、协议、路径或用户信息')
    # IPv6 literals are intentionally deferred until a dedicated deployment needs them.
    if ':' in host:
        raise ValueError('LTP_ALLOWED_HOSTS 不接受端口；端口只能出现在允许的Origin中')
    return host.lower().rstrip('.')


def _validate_origin(origin, hosts):
    try:
        p = urlsplit(origin)
    except ValueError as exc:
        raise ValueError('LTP_ALLOWED_ORIGINS 包含无效URL') from exc
    if p.scheme != 'https' or not p.hostname or p.username or p.password or p.path not in ('', '/') or p.query or p.fragment:
        raise ValueError('生产Origin必须是精确HTTPS源，例如 https://labor.example.org；不能包含路径、查询、片段或用户信息')
    if p.hostname.lower().rstrip('.') not in hosts:
        raise ValueError('每个生产Origin的主机名都必须同时列入LTP_ALLOWED_HOSTS')
    return origin.rstrip('/')


def _validate_admin_ip(value):
    if value == '*' or '/' in value:
        raise ValueError('LTP_ADMIN_ALLOWED_IPS 只接受精确IP，不允许通配符或CIDR')
    try:
        return ipaddress.ip_address(value).compressed
    except ValueError as exc:
        raise ValueError('LTP_ADMIN_ALLOWED_IPS 只能包含精确IPv4或IPv6地址') from exc


def _outside_source_tree(path):
    try:
        path.relative_to(ROOT)
        return False
    except ValueError:
        return True


@dataclass(frozen=True)
class SecurityConfig:
    profile: str
    allowed_hosts: Tuple[str, ...]
    allowed_origins: Tuple[str, ...]
    secret: str = ''
    cookie_name: str = 'ltp_demo_session'
    cookie_secure: bool = False
    require_https: bool = False
    read_limit_per_minute: int = 100000
    mutation_limit_per_minute: int = 100000
    admin_limit_per_minute: int = 100000
    proxy_mode: str = 'direct'
    forwarded_allow_ips: Tuple[str, ...] = ()
    admin_allowed_ips: Tuple[str, ...] = ()
    attachment_mode: str = 'local-unscanned'
    clamscan_path: str = ''

    @property
    def production(self):
        return self.profile == 'production'

    @classmethod
    def local(cls):
        return cls(profile='local', allowed_hosts=('127.0.0.1', 'localhost', 'testserver'), allowed_origins=())

    @classmethod
    def production_for_tests(cls, host='labor.example', origin='https://labor.example', secret=None,
                             read_limit=300, mutation_limit=60, admin_limit=30):
        # Explicitly test-only factory; production environment loading has stricter path/secret checks.
        return cls(profile='production', allowed_hosts=(host,), allowed_origins=(origin,),
                   secret=secret or ('S' * 64), cookie_name='ltp_session', cookie_secure=True,
                   require_https=True, read_limit_per_minute=read_limit,
                   mutation_limit_per_minute=mutation_limit, admin_limit_per_minute=admin_limit,
                   admin_allowed_ips=('testclient',), attachment_mode='disabled')


def load_production_config(env: Mapping[str, str] | None = None):
    env = os.environ if env is None else env
    if env.get('LTP_RUNTIME_PROFILE') != 'production':
        raise ValueError('必须显式设置 LTP_RUNTIME_PROFILE=production；本地模式不会自动升级为生产模式')
    db_raw = env.get('LTP_DB', '')
    if not db_raw:
        raise ValueError('生产模式必须显式设置 LTP_DB')
    db = Path(db_raw).expanduser()
    if not db.is_absolute():
        raise ValueError('生产 LTP_DB 必须是绝对路径')
    db = db.resolve()
    if not _outside_source_tree(db):
        raise ValueError('生产数据库不得位于源码目录内；请使用独立数据卷或系统数据目录')

    admin_token = _strong_secret(env.get('LTP_ADMIN_TOKEN', ''), 'LTP_ADMIN_TOKEN')
    secret = _strong_secret(env.get('LTP_SECURITY_SECRET', ''), 'LTP_SECURITY_SECRET')
    if hmac.compare_digest(admin_token, secret):
        raise ValueError('管理凭据与安全派生密钥必须独立')

    hosts = tuple(dict.fromkeys(_validate_host(x) for x in _split_csv(env.get('LTP_ALLOWED_HOSTS'))))
    if not hosts:
        raise ValueError('生产模式必须设置至少一个精确 LTP_ALLOWED_HOSTS')
    origins_raw = tuple(x.strip() for x in env.get('LTP_ALLOWED_ORIGINS', '').split(',') if x.strip())
    origins = tuple(dict.fromkeys(_validate_origin(x, set(hosts)) for x in origins_raw))
    if not origins:
        raise ValueError('生产模式必须设置至少一个精确HTTPS LTP_ALLOWED_ORIGINS')

    proxy_mode = env.get('LTP_PROXY_MODE', 'direct').strip().lower()
    if proxy_mode not in ('direct', 'reverse-proxy'):
        raise ValueError('LTP_PROXY_MODE 只能是 direct 或 reverse-proxy')
    forwarded = _split_csv(env.get('LTP_FORWARDED_ALLOW_IPS'))
    if proxy_mode == 'reverse-proxy' and not forwarded:
        raise ValueError('reverse-proxy模式必须显式设置LTP_FORWARDED_ALLOW_IPS，不能信任任意转发头')
    if '*' in forwarded:
        raise ValueError('禁止用 * 信任所有代理转发头')

    admin_raw = tuple(x.strip() for x in env.get('LTP_ADMIN_ALLOWED_IPS', '').split(',') if x.strip())
    admin_allowed = tuple(dict.fromkeys(_validate_admin_ip(x) for x in admin_raw))
    if not admin_allowed:
        raise ValueError('生产模式必须设置至少一个精确 LTP_ADMIN_ALLOWED_IPS；管理API不能默认向所有来源开放')

    attachment_mode = env.get('LTP_ATTACHMENT_UPLOADS', 'disabled').strip().lower()
    if attachment_mode not in ('disabled', 'clamav'):
        raise ValueError('LTP_ATTACHMENT_UPLOADS 只能是 disabled 或 clamav')
    clamscan_path = ''
    if attachment_mode == 'clamav':
        clamscan_raw = env.get('LTP_CLAMSCAN_PATH', '')
        clamscan = Path(clamscan_raw).expanduser()
        if not clamscan_raw or not clamscan.is_absolute() or not clamscan.is_file() or not os.access(str(clamscan), os.X_OK):
            raise ValueError('启用附件上传时必须设置可执行的绝对 LTP_CLAMSCAN_PATH')
        clamscan_path = str(clamscan.resolve())

    config = SecurityConfig(
        profile='production', allowed_hosts=hosts, allowed_origins=origins, secret=secret,
        cookie_name='ltp_session', cookie_secure=True, require_https=True,
        read_limit_per_minute=_positive_int(env.get('LTP_READ_LIMIT_PER_MINUTE'), 'LTP_READ_LIMIT_PER_MINUTE', 300),
        mutation_limit_per_minute=_positive_int(env.get('LTP_MUTATION_LIMIT_PER_MINUTE'), 'LTP_MUTATION_LIMIT_PER_MINUTE', 60),
        admin_limit_per_minute=_positive_int(env.get('LTP_ADMIN_LIMIT_PER_MINUTE'), 'LTP_ADMIN_LIMIT_PER_MINUTE', 30),
        proxy_mode=proxy_mode, forwarded_allow_ips=forwarded, admin_allowed_ips=admin_allowed,
        attachment_mode=attachment_mode, clamscan_path=clamscan_path,
    )
    return config, db, admin_token


def csrf_token(secret, session_token):
    return hmac.new(secret.encode('utf-8'), ('csrf:' + session_token).encode('utf-8'), hashlib.sha256).hexdigest()


def actor_hash(secret, remote_host):
    remote = remote_host or 'unknown'
    return hmac.new(secret.encode('utf-8'), ('client:' + remote).encode('utf-8'), hashlib.sha256).hexdigest()


def rate_bucket(path, method):
    if path.startswith('/api/admin'):
        return 'admin'
    if method.upper() in _MUTATING:
        return 'mutation'
    return 'read'


def limit_for(config, bucket):
    if bucket == 'admin':
        return config.admin_limit_per_minute
    if bucket == 'mutation':
        return config.mutation_limit_per_minute
    return config.read_limit_per_minute
