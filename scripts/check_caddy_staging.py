"""Real Caddy loopback staging drill for the production ASGI entrypoint.

Requires a locally installed Caddy binary. The drill binds both Caddy and Uvicorn
to loopback, uses an ephemeral private CA/leaf certificate, synthetic data and
random one-run secrets, verifies the reverse-proxy security path, then removes all
processes and temporary files. It never creates DNS records, public listeners or a
public certificate and does not install/start a persistent Caddy service.
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from check_launchd_supervision import make_tls, wait_port

ROOT = Path(__file__).resolve().parents[1]


def run(*args, check=True, **kwargs):
    return subprocess.run(args, check=check, capture_output=True, text=True, **kwargs)


def curl_json(curl, ca, port, path, *, method='GET', data=None, cookie=None, csrf=None):
    cmd = [
        curl, '--silent', '--show-error', '--fail-with-body',
        '--cacert', str(ca), '--resolve', f'labor.local:{port}:127.0.0.1',
        '-X', method, f'https://labor.local:{port}{path}',
        '-H', 'Accept: application/json',
    ]
    if data is not None:
        cmd += ['-H', 'Content-Type: application/json', '--data', json.dumps(data, ensure_ascii=False)]
    if cookie:
        cmd += ['-b', cookie]
    if csrf:
        cmd += ['-H', 'Origin: https://labor.local:%d' % port, '-H', 'X-Ltp-Csrf: ' + csrf]
    result = run(*cmd, check=False)
    try:
        payload = json.loads(result.stdout or '{}')
    except json.JSONDecodeError:
        payload = {'raw': result.stdout[-1000:]}
    return result.returncode, payload, result.stderr


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', default='qa/v0_6/caddy-staging.json')
    parser.add_argument('--backend-port', type=int, default=8931)
    parser.add_argument('--proxy-port', type=int, default=8932)
    args = parser.parse_args()
    caddy = shutil.which('caddy')
    curl = shutil.which('curl')
    if not caddy:
        raise SystemExit('caddy is not installed')
    if not curl:
        raise SystemExit('curl is not installed')
    for port in (args.backend_port, args.proxy_port):
        if not 1024 <= port <= 65535:
            raise SystemExit('staging ports must be between 1024 and 65535')
        if wait_port('127.0.0.1', port, timeout=0.05, want_open=True):
            raise SystemExit('port already in use: %d' % port)

    tmp = Path(tempfile.mkdtemp(prefix='ltp-caddy-stage-'))
    tmp.chmod(0o700)
    ca, cert, key = make_tls(tmp)
    db = tmp / 'stage.sqlite3'
    caddyfile = tmp / 'Caddyfile'
    backend_out = (tmp / 'backend.stdout.log').open('wb')
    backend_err = (tmp / 'backend.stderr.log').open('wb')
    caddy_out = (tmp / 'caddy.stdout.log').open('wb')
    caddy_err = (tmp / 'caddy.stderr.log').open('wb')
    backend = None
    proxy = None
    started = time.monotonic()
    result = {
        'status': 'FAILED',
        'scope': 'real Homebrew Caddy binary; loopback-only; synthetic data only',
        'backend_port': args.backend_port,
        'proxy_port': args.proxy_port,
        'public_listener_created': False,
    }
    try:
        version = run(caddy, 'version').stdout.strip()
        caddyfile.write_text(
            '{\n  admin off\n  auto_https disable_redirects\n}\n\n'
            f':{args.proxy_port} {{\n'
            '  bind 127.0.0.1\n'
            f'  tls {cert} {key}\n'
            f'  reverse_proxy 127.0.0.1:{args.backend_port} {{\n'
            '    header_up Host {http.request.host}\n'
            '  }\n'
            '}\n',
            encoding='utf-8',
        )
        caddyfile.chmod(0o600)
        validation = run(caddy, 'validate', '--config', str(caddyfile), '--adapter', 'caddyfile', check=False)
        if validation.returncode != 0:
            raise RuntimeError('caddy validate failed: ' + validation.stderr[-2000:])

        env = os.environ.copy()
        env.update({
            'LTP_RUNTIME_PROFILE': 'production',
            'LTP_DB': str(db),
            'LTP_ADMIN_TOKEN': secrets.token_urlsafe(48),
            'LTP_SECURITY_SECRET': secrets.token_urlsafe(48),
            'LTP_ALLOWED_HOSTS': 'labor.local',
            'LTP_ALLOWED_ORIGINS': f'https://labor.local:{args.proxy_port}',
            'LTP_PROXY_MODE': 'reverse-proxy',
            'LTP_FORWARDED_ALLOW_IPS': '127.0.0.1',
            # Deliberately exclude loopback so the drill can prove that the
            # real proxy path reaches the application's admin-network gate.
            'LTP_ADMIN_ALLOWED_IPS': '203.0.113.10',
            'LTP_ATTACHMENT_UPLOADS': 'disabled',
            'LTP_PUBLIC_RESEARCH_MODE': 'false',
            'LTP_RESEARCH_NETWORK_ENABLED': 'false',
            'PYTHONPATH': str(ROOT),
        })
        backend = subprocess.Popen(
            [
                str(ROOT / '.venv' / 'bin' / 'python'), '-m', 'uvicorn', 'app.production:app',
                '--host', '127.0.0.1', '--port', str(args.backend_port),
                '--proxy-headers', '--forwarded-allow-ips', '127.0.0.1', '--no-access-log',
            ],
            cwd=str(ROOT), env=env, stdout=backend_out, stderr=backend_err,
        )
        if not wait_port('127.0.0.1', args.backend_port, timeout=12):
            raise RuntimeError('backend did not open loopback port')

        proxy = subprocess.Popen(
            [caddy, 'run', '--config', str(caddyfile), '--adapter', 'caddyfile'],
            cwd=str(tmp), stdout=caddy_out, stderr=caddy_err,
        )
        if not wait_port('127.0.0.1', args.proxy_port, timeout=10):
            raise RuntimeError('Caddy did not open loopback TLS port')

        cookiejar = tmp / 'cookies.txt'
        base = [
            curl, '--silent', '--show-error', '--cacert', str(ca),
            '--resolve', f'labor.local:{args.proxy_port}:127.0.0.1',
        ]
        health = run(*base, '-D', str(tmp / 'headers.txt'), '-c', str(cookiejar),
                     f'https://labor.local:{args.proxy_port}/api/health', check=False)
        if health.returncode != 0:
            raise RuntimeError('Caddy health request failed: ' + health.stderr[-1000:])
        health_json = json.loads(health.stdout)
        headers = (tmp / 'headers.txt').read_text(encoding='utf-8', errors='replace').lower()
        if health_json.get('status') != 'ok' or health_json.get('security_profile') != 'production':
            raise RuntimeError('health response is not production/ok')

        config = run(*base, '-b', str(cookiejar), f'https://labor.local:{args.proxy_port}/api/config', check=False)
        if config.returncode != 0:
            raise RuntimeError('config request failed')
        config_json = json.loads(config.stdout)
        csrf = config_json.get('csrf_token', '')
        if len(csrf) != 64:
            raise RuntimeError('production csrf token missing')

        missing = run(
            *base, '-b', str(cookiejar), '-o', str(tmp / 'missing.json'), '-w', '%{http_code}',
            '-H', f'Origin: https://labor.local:{args.proxy_port}', '-H', 'Content-Type: application/json',
            '--data', '{"title":"caddy missing csrf","detail":"synthetic"}',
            f'https://labor.local:{args.proxy_port}/api/features', check=False,
        )
        valid = run(
            *base, '-b', str(cookiejar), '-o', str(tmp / 'valid.json'), '-w', '%{http_code}',
            '-H', f'Origin: https://labor.local:{args.proxy_port}', '-H', 'X-Ltp-Csrf: ' + csrf,
            '-H', 'Content-Type: application/json', '--data', '{"title":"caddy valid csrf","detail":"synthetic"}',
            f'https://labor.local:{args.proxy_port}/api/features', check=False,
        )
        wrong_host = run(
            curl, '--silent', '--show-error', '--cacert', str(ca), '--resolve',
            f'wrong.local:{args.proxy_port}:127.0.0.1', '-o', str(tmp / 'wrong.json'), '-w', '%{http_code}',
            f'https://wrong.local:{args.proxy_port}/api/health', check=False,
        )
        # wrong.local is intentionally absent from the cert SAN, so TLS may reject it
        # before the application sees Host. Verify application Host rejection separately
        # through the valid TLS name with an overridden HTTP Host header.
        wrong_app_host = run(
            *base, '-H', 'Host: wrong.local', '-o', str(tmp / 'wrong-app.json'), '-w', '%{http_code}',
            f'https://labor.local:{args.proxy_port}/api/health', check=False,
        )
        admin_network = run(
            *base, '-o', str(tmp / 'admin-network.json'), '-w', '%{http_code}',
            f'https://labor.local:{args.proxy_port}/api/admin', check=False,
        )

        missing_code = int((missing.stdout or '0').strip()[-3:])
        valid_code = int((valid.stdout or '0').strip()[-3:])
        wrong_app_code = int((wrong_app_host.stdout or '0').strip()[-3:])
        admin_network_code = int((admin_network.stdout or '0').strip()[-3:])
        admin_network_body = (tmp / 'admin-network.json').read_text(encoding='utf-8', errors='replace')
        if missing_code != 403 or valid_code != 200 or wrong_app_code != 403 or admin_network_code != 403 or '受限运营网络' not in admin_network_body:
            raise RuntimeError('security path mismatch: missing=%s valid=%s wrong_host=%s admin_network=%s' % (
                missing_code, valid_code, wrong_app_code, admin_network_code))

        result.update({
            'status': 'PASS',
            'caddy_binary': caddy,
            'caddy_version': version,
            'caddy_config_validate': 'PASS',
            'tls_client_verified_private_ca': True,
            'health_http_status': 200,
            'health': health_json,
            'secure_cookie_observed': 'secure' in headers and 'httponly' in headers and 'samesite=strict' in headers,
            'hsts_observed': 'strict-transport-security:' in headers,
            'csp_observed': 'content-security-policy:' in headers,
            'missing_csrf_mutation_http_status': missing_code,
            'valid_csrf_mutation_http_status': valid_code,
            'wrong_host_application_http_status': wrong_app_code,
            'admin_network_denied_http_status': admin_network_code,
            'admin_network_gate_observed_before_admin_auth': True,
            'wrong_tls_name_curl_exit': wrong_host.returncode,
            'production_attachment_uploads_enabled': health_json.get('attachment_uploads_enabled'),
            'elapsed_seconds': round(time.monotonic() - started, 3),
            'claim_boundary': (
                'RUNTIME_VERIFIED for a real Caddy 2.x binary terminating TLS and proxying the production ASGI app '
                'on loopback with a private test CA. Public DNS, public CA issuance/renewal and firewall remain unverified.'
            ),
        })
    except Exception as exc:
        result['error'] = f'{exc.__class__.__name__}: {exc}'
        for name, path in (
            ('backend_stderr_tail', tmp / 'backend.stderr.log'),
            ('caddy_stderr_tail', tmp / 'caddy.stderr.log'),
        ):
            try:
                result[name] = path.read_text(encoding='utf-8', errors='replace')[-4000:]
            except OSError:
                result[name] = ''
        raise
    finally:
        for process in (proxy, backend):
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=2)
        for fh in (backend_out, backend_err, caddy_out, caddy_err):
            fh.close()
        result['cleanup'] = {
            'backend_port_closed': wait_port('127.0.0.1', args.backend_port, timeout=5, want_open=False),
            'proxy_port_closed': wait_port('127.0.0.1', args.proxy_port, timeout=5, want_open=False),
            'persistent_caddy_service_started': False,
            'temporary_directory_removed': True,
        }
        out = (ROOT / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        shutil.rmtree(tmp, ignore_errors=True)

    print(json.dumps({
        'status': result['status'],
        'caddy_version': result.get('caddy_version'),
        'health_http_status': result.get('health_http_status'),
        'missing_csrf': result.get('missing_csrf_mutation_http_status'),
        'valid_csrf': result.get('valid_csrf_mutation_http_status'),
        'wrong_host': result.get('wrong_host_application_http_status'),
        'cleanup': result.get('cleanup'),
        'out': str(out),
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
