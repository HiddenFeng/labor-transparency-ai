"""Fail-closed production configuration preflight. Never prints secret values."""
from __future__ import annotations
import json
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.security import load_production_config


def main():
    config, db, _admin = load_production_config()
    result = {
        'status': 'PRODUCTION_CONFIG_PREFLIGHT_PASSED',
        'profile': config.profile,
        'database_absolute': db.is_absolute(),
        'database_outside_source_tree': True,
        'allowed_hosts': list(config.allowed_hosts),
        'allowed_origins': list(config.allowed_origins),
        'require_https': config.require_https,
        'secure_cookie': config.cookie_secure,
        'proxy_mode': config.proxy_mode,
        'forwarded_allow_ips_count': len(config.forwarded_allow_ips),
        'admin_network_restricted': bool(config.admin_allowed_ips),
        'admin_allowed_ips_count': len(config.admin_allowed_ips),
        'rate_limits_per_minute': {
            'read': config.read_limit_per_minute,
            'mutation': config.mutation_limit_per_minute,
            'admin': config.admin_limit_per_minute,
        },
        'attachment_uploads': config.attachment_mode,
        'clamscan_configured': bool(config.clamscan_path),
        'admin_token_present': bool(os.getenv('LTP_ADMIN_TOKEN')),
        'security_secret_present': bool(os.getenv('LTP_SECURITY_SECRET')),
        'secrets_printed': False,
        'deployment_performed': False,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
