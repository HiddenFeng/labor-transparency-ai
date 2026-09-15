"""Fail-closed ASGI entrypoint for a future public deployment.

This module only builds the application after all required production environment
values pass validation. It does not configure DNS, TLS certificates, firewall rules,
process supervision, backups or external monitoring.
"""
from __future__ import annotations
import os
from .security import load_production_config
from .server import create_app


def _flag(name, default='false'):
    value = os.getenv(name, default).strip().lower()
    if value not in ('true', 'false'):
        raise ValueError(name + ' 只能是 true 或 false')
    return value == 'true'


def build_production_app():
    security, db, admin_token = load_production_config()
    public_research = _flag('LTP_PUBLIC_RESEARCH_MODE', 'false')
    research_network = _flag('LTP_RESEARCH_NETWORK_ENABLED', 'false')
    if research_network and not public_research:
        raise ValueError('开启网络研究前必须先显式开启 LTP_PUBLIC_RESEARCH_MODE=true')
    return create_app(db, admin_token=admin_token, public_research=public_research,
                      research_network=research_network, security_config=security)


app = build_production_app()
