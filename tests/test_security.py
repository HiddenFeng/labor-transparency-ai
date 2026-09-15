import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from fastapi.testclient import TestClient

from app.security import ROOT, SecurityConfig, load_production_config
from app.server import create_app


class ProductionConfigTests(unittest.TestCase):
    def base_env(self):
        return {
            'LTP_RUNTIME_PROFILE': 'production',
            'LTP_DB': str(Path(tempfile.gettempdir()) / 'ltp-production-config.sqlite3'),
            'LTP_ADMIN_TOKEN': 'A' * 64,
            'LTP_SECURITY_SECRET': 'B' * 64,
            'LTP_ALLOWED_HOSTS': 'labor.example',
            'LTP_ALLOWED_ORIGINS': 'https://labor.example',
            'LTP_PROXY_MODE': 'direct',
            'LTP_ADMIN_ALLOWED_IPS': '127.0.0.1',
        }

    def test_valid_exact_https_configuration(self):
        config, db, admin = load_production_config(self.base_env())
        self.assertTrue(config.production)
        self.assertTrue(config.require_https)
        self.assertTrue(config.cookie_secure)
        self.assertEqual(config.allowed_hosts, ('labor.example',))
        self.assertEqual(config.allowed_origins, ('https://labor.example',))
        self.assertEqual(config.admin_allowed_ips, ('127.0.0.1',))
        self.assertTrue(db.is_absolute())
        self.assertEqual(admin, 'A' * 64)

    def test_profile_must_be_explicit(self):
        env = self.base_env(); env.pop('LTP_RUNTIME_PROFILE')
        with self.assertRaisesRegex(ValueError, 'LTP_RUNTIME_PROFILE'):
            load_production_config(env)

    def test_database_must_be_absolute_and_outside_source_tree(self):
        env = self.base_env(); env['LTP_DB'] = 'relative.sqlite3'
        with self.assertRaisesRegex(ValueError, '绝对路径'):
            load_production_config(env)
        env = self.base_env(); env['LTP_DB'] = str(ROOT / 'local-data' / 'production.sqlite3')
        with self.assertRaisesRegex(ValueError, '源码目录'):
            load_production_config(env)

    def test_secrets_must_be_independent_and_non_placeholder(self):
        env = self.base_env(); env['LTP_ADMIN_TOKEN'] = 'change-me-' + 'X' * 40
        with self.assertRaisesRegex(ValueError, '占位'):
            load_production_config(env)
        env = self.base_env(); env['LTP_SECURITY_SECRET'] = env['LTP_ADMIN_TOKEN']
        with self.assertRaisesRegex(ValueError, '必须独立'):
            load_production_config(env)

    def test_hosts_origins_and_proxy_trust_fail_closed(self):
        env = self.base_env(); env['LTP_ALLOWED_HOSTS'] = '*.example'
        with self.assertRaisesRegex(ValueError, '通配符'):
            load_production_config(env)
        env = self.base_env(); env['LTP_ALLOWED_ORIGINS'] = 'http://labor.example'
        with self.assertRaisesRegex(ValueError, 'HTTPS'):
            load_production_config(env)
        env = self.base_env(); env['LTP_PROXY_MODE'] = 'reverse-proxy'
        with self.assertRaisesRegex(ValueError, 'LTP_FORWARDED_ALLOW_IPS'):
            load_production_config(env)
        env['LTP_FORWARDED_ALLOW_IPS'] = '*'
        with self.assertRaisesRegex(ValueError, '禁止'):
            load_production_config(env)

    def test_admin_network_allowlist_is_mandatory_and_exact_ip_only(self):
        env = self.base_env(); env.pop('LTP_ADMIN_ALLOWED_IPS')
        with self.assertRaisesRegex(ValueError, 'LTP_ADMIN_ALLOWED_IPS'):
            load_production_config(env)
        for invalid in ('*', '10.0.0.0/8', 'ops.example'):
            env = self.base_env(); env['LTP_ADMIN_ALLOWED_IPS'] = invalid
            with self.assertRaisesRegex(ValueError, 'LTP_ADMIN_ALLOWED_IPS'):
                load_production_config(env)
        env = self.base_env(); env['LTP_ADMIN_ALLOWED_IPS'] = '2001:0db8::1'
        config, _db, _admin = load_production_config(env)
        self.assertEqual(config.admin_allowed_ips, ('2001:db8::1',))


class ProductionRequestSecurityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'security.sqlite3'
        self.secret = 'C' * 64
        self.admin = 'D' * 64
        self.security = SecurityConfig.production_for_tests(secret=self.secret)
        self.app = create_app(self.path, admin_token=self.admin, security_config=self.security)
        self.app.state.store.set_phase('assistance')
        self.client = TestClient(self.app, base_url='https://labor.example')

    def tearDown(self):
        self.client.close(); self.tmp.cleanup()

    def config(self):
        response = self.client.get('/api/config')
        self.assertEqual(response.status_code, 200, response.text)
        return response

    def mutation_headers(self, csrf):
        return {'Origin': 'https://labor.example', 'X-Ltp-Csrf': csrf,
                'Idempotency-Key': 'production-security-request-001'}

    def company_payload(self):
        return {'name': '生产安全测试公司（虚构）', 'region': '示例地区', 'needs': ['company'],
                'public': True, 'consent': True, 'synthetic': True}

    def test_health_is_non_sensitive_and_production_aware(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {
            'status': 'ok', 'version': '0.6', 'security_profile': 'production',
            'database': 'ok', 'scheduler_active': False, 'attachment_uploads_enabled': False,
        })
        for secret in (self.secret, self.admin, str(self.path)):
            self.assertNotIn(secret, response.text)

    def test_secure_cookie_and_security_headers(self):
        response = self.config()
        body = response.json()
        self.assertEqual(body['security_profile'], 'production')
        self.assertEqual(body['mode'], 'PRODUCTION_CANDIDATE')
        self.assertEqual(len(body['csrf_token']), 64)
        cookie = response.headers.get('set-cookie', '')
        self.assertIn('ltp_session=', cookie)
        self.assertIn('HttpOnly', cookie)
        self.assertIn('Secure', cookie)
        self.assertIn('SameSite=strict', cookie)
        self.assertIn('max-age=31536000', response.headers['strict-transport-security'])
        self.assertEqual(response.headers['x-frame-options'], 'DENY')
        self.assertEqual(response.headers['cross-origin-resource-policy'], 'same-origin')

    def test_host_https_origin_and_csrf_are_all_enforced(self):
        self.assertEqual(self.client.get('/api/config', headers={'Host': 'evil.example'}).status_code, 403)
        with TestClient(self.app, base_url='http://labor.example') as insecure:
            self.assertEqual(insecure.get('/api/config').status_code, 403)
        csrf = self.config().json()['csrf_token']
        self.assertEqual(self.client.post('/api/requests', json=self.company_payload()).status_code, 403)
        self.assertEqual(self.client.post('/api/requests', json=self.company_payload(),
                                          headers={'Origin': 'https://evil.example', 'X-Ltp-Csrf': csrf}).status_code, 403)
        self.assertEqual(self.client.post('/api/requests', json=self.company_payload(),
                                          headers={'Origin': 'https://labor.example', 'X-Ltp-Csrf': 'wrong'}).status_code, 403)
        ok = self.client.post('/api/requests', json=self.company_payload(), headers=self.mutation_headers(csrf))
        self.assertEqual(ok.status_code, 200, ok.text)

    def test_local_client_marker_does_not_replace_production_csrf(self):
        csrf = self.config().json()['csrf_token']
        r = self.client.post('/api/requests', json=self.company_payload(),
                             headers={'Origin': 'https://labor.example', 'X-Ltp-Client': 'local-demo'})
        self.assertEqual(r.status_code, 403)
        r = self.client.post('/api/requests', json=self.company_payload(), headers=self.mutation_headers(csrf))
        self.assertEqual(r.status_code, 200, r.text)

    def test_session_rotation_rotates_csrf(self):
        first = self.config().json()['csrf_token']
        signup = self.client.post('/api/account/signup',
                                  json={'username': '生产测试成员', 'password': 'Strong-passphrase-2026'},
                                  headers=self.mutation_headers(first))
        self.assertEqual(signup.status_code, 200, signup.text)
        second = self.config().json()['csrf_token']
        self.assertNotEqual(first, second)
        stale = self.client.post('/api/features', json={'title': '安全测试', 'detail': '旧令牌应失效'},
                                 headers=self.mutation_headers(first))
        self.assertEqual(stale.status_code, 403)
        fresh = self.client.post('/api/features', json={'title': '安全测试', 'detail': '新令牌可继续使用'},
                                 headers=self.mutation_headers(second))
        self.assertEqual(fresh.status_code, 200, fresh.text)

    def test_persistent_rate_limit_returns_retry_after(self):
        limited = SecurityConfig.production_for_tests(secret='E' * 64, read_limit=2)
        app = create_app(Path(self.tmp.name) / 'limited.sqlite3', admin_token=self.admin, security_config=limited)
        with TestClient(app, base_url='https://labor.example') as client:
            self.assertEqual(client.get('/api/config').status_code, 200)
            self.assertEqual(client.get('/api/companies').status_code, 200)
            third = client.get('/api/companies')
            self.assertEqual(third.status_code, 429)
            self.assertEqual(third.headers['retry-after'], '60')

    def test_admin_api_is_restricted_to_configured_operator_network(self):
        restricted = replace(self.security, admin_allowed_ips=('203.0.113.10',))
        app = create_app(Path(self.tmp.name) / 'admin-network.sqlite3', admin_token=self.admin, security_config=restricted)
        with TestClient(app, base_url='https://labor.example') as client:
            denied = client.get('/api/admin')
            self.assertEqual(denied.status_code, 403, denied.text)
            self.assertIn('受限运营网络', denied.text)

    def test_security_audit_is_minimal_and_hashed(self):
        csrf = self.config().json()['csrf_token']
        self.client.post('/api/requests', json=self.company_payload(),
                         headers={'Origin': 'https://labor.example', 'X-Ltp-Csrf': 'bad'})
        admin = self.client.get('/api/admin', headers={'Authorization': 'Bearer ' + self.admin})
        self.assertEqual(admin.status_code, 200, admin.text)
        with self.app.state.store.db() as c:
            rows = c.execute('SELECT actor_hash,event,path,outcome,detail FROM security_events ORDER BY created_at').fetchall()
        self.assertTrue(any(r['event'] == 'CSRF_DENIED' for r in rows))
        self.assertTrue(any(r['event'] == 'ADMIN_REQUEST' and r['path'] == '/api/admin' for r in rows))
        for row in rows:
            self.assertEqual(len(row['actor_hash']), 64)
            self.assertNotIn('testclient', row['actor_hash'])
            self.assertNotIn(self.admin, row['detail'])
            self.assertNotIn(self.admin, row['path'])


if __name__ == '__main__':
    unittest.main()
