"""Controlled macOS launchd staging drill for process supervision and restart recovery.

This script is intentionally loopback-only and synthetic. It creates an ephemeral
launchd LaunchAgent for the production ASGI entrypoint, starts the project's TLS
staging reverse proxy as a separate process, terminates the managed backend once,
and verifies that launchd starts a new backend process that becomes healthy again.
All launchd state, listeners, secrets, certificates and synthetic data created by
this drill are removed in a finally block.

It validates one deployment property only: user-level macOS launchd can supervise
and recover the bounded staging backend. It does not validate Linux systemd,
containers, public DNS, a public CA, firewall policy, Caddy/Nginx or ClamAV.
"""
from __future__ import annotations

import argparse
import datetime as dt
import http.client
import ipaddress
import json
import os
import plistlib
import re
import secrets
import shutil
import signal
import socket
import ssl
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BACKEND_PORT = 8921
DEFAULT_PROXY_PORT = 8922


def run(*args, check=True):
    return subprocess.run(args, check=check, capture_output=True, text=True)


def wait_port(host, port, timeout=12.0, want_open=True):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        sock = socket.socket()
        sock.settimeout(0.3)
        try:
            opened = sock.connect_ex((host, port)) == 0
        finally:
            sock.close()
        if opened == want_open:
            return True
        time.sleep(0.1)
    return False


def make_tls(tmp: Path):
    now = dt.datetime.now(dt.timezone.utc)
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'LTP Ephemeral Launchd Staging Root')])
    ca_cert = (
        x509.CertificateBuilder()
        .subject_name(ca_name)
        .issuer_name(ca_name)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=1))
        .not_valid_after(now + dt.timedelta(hours=2))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(ca_key, hashes.SHA256())
    )
    leaf_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    leaf_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'labor.local')])
    leaf_cert = (
        x509.CertificateBuilder()
        .subject_name(leaf_name)
        .issuer_name(ca_name)
        .public_key(leaf_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=1))
        .not_valid_after(now + dt.timedelta(hours=1))
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName('labor.local'),
                x509.IPAddress(ipaddress.ip_address('127.0.0.1')),
            ]),
            critical=False,
        )
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(ca_key, hashes.SHA256())
    )
    ca_path = tmp / 'ca.pem'
    cert_path = tmp / 'server.pem'
    key_path = tmp / 'server-key.pem'
    ca_path.write_bytes(ca_cert.public_bytes(serialization.Encoding.PEM))
    cert_path.write_bytes(leaf_cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        leaf_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    for path in (ca_path, cert_path, key_path):
        path.chmod(0o600)
    return ca_path, cert_path, key_path


def launchd_pid(domain, label):
    result = run('/bin/launchctl', 'print', f'{domain}/{label}', check=False)
    if result.returncode != 0:
        return None
    match = re.search(r'^\s*pid = (\d+)\s*$', result.stdout, re.MULTILINE)
    return int(match.group(1)) if match else None


def wait_pid(domain, label, timeout=15.0, different_from=None):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        pid = launchd_pid(domain, label)
        if pid and (different_from is None or pid != different_from):
            return pid
        time.sleep(0.1)
    return None


def https_health(proxy_port, ca_path, timeout=3.0):
    context = ssl.create_default_context(cafile=str(ca_path))
    conn = http.client.HTTPSConnection('127.0.0.1', proxy_port, timeout=timeout, context=context)
    try:
        conn.request('GET', '/api/health', headers={'Host': 'labor.local'})
        response = conn.getresponse()
        payload = response.read()
        data = json.loads(payload.decode('utf-8')) if payload else {}
        return response.status, data
    finally:
        conn.close()


def wait_health(proxy_port, ca_path, timeout=15.0):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        try:
            status, data = https_health(proxy_port, ca_path)
            last = (status, data)
            if status == 200 and data.get('status') == 'ok' and data.get('security_profile') == 'production':
                return status, data
        except (OSError, ssl.SSLError, json.JSONDecodeError, http.client.HTTPException) as exc:
            last = ('error', exc.__class__.__name__)
        time.sleep(0.15)
    raise RuntimeError('health did not recover: %r' % (last,))


def write_plist(path: Path, label: str, root: Path, db: Path, backend_port: int, stdout: Path, stderr: Path):
    python = root / '.venv' / 'bin' / 'python'
    if not python.is_file():
        raise RuntimeError('project .venv Python is missing')
    env = {
        'LTP_RUNTIME_PROFILE': 'production',
        'LTP_DB': str(db),
        'LTP_ADMIN_TOKEN': secrets.token_urlsafe(48),
        'LTP_SECURITY_SECRET': secrets.token_urlsafe(48),
        'LTP_ALLOWED_HOSTS': 'labor.local',
        'LTP_ALLOWED_ORIGINS': f'https://labor.local:{DEFAULT_PROXY_PORT}',
        'LTP_PROXY_MODE': 'reverse-proxy',
        'LTP_FORWARDED_ALLOW_IPS': '127.0.0.1',
        'LTP_ADMIN_ALLOWED_IPS': '127.0.0.1',
        'LTP_ATTACHMENT_UPLOADS': 'disabled',
        'LTP_PUBLIC_RESEARCH_MODE': 'false',
        'LTP_RESEARCH_NETWORK_ENABLED': 'false',
        'PYTHONPATH': str(root),
    }
    plist = {
        'Label': label,
        'ProgramArguments': [
            str(python), '-m', 'uvicorn', 'app.production:app',
            '--host', '127.0.0.1', '--port', str(backend_port),
            '--proxy-headers', '--forwarded-allow-ips', '127.0.0.1', '--no-access-log',
        ],
        'WorkingDirectory': str(root),
        'EnvironmentVariables': env,
        'RunAtLoad': True,
        'KeepAlive': True,
        'ThrottleInterval': 1,
        'ProcessType': 'Background',
        'StandardOutPath': str(stdout),
        'StandardErrorPath': str(stderr),
        'Umask': 0o077,
    }
    with path.open('wb') as fh:
        plistlib.dump(plist, fh, sort_keys=True)
    path.chmod(0o600)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', default='qa/v0_6/launchd-supervision.json')
    parser.add_argument('--backend-port', type=int, default=DEFAULT_BACKEND_PORT)
    parser.add_argument('--proxy-port', type=int, default=DEFAULT_PROXY_PORT)
    args = parser.parse_args()
    if args.proxy_port != DEFAULT_PROXY_PORT:
        raise SystemExit('This bounded drill currently fixes the allowed Origin to port 8922; do not vary --proxy-port.')
    for port in (args.backend_port, args.proxy_port):
        if not 1024 <= port <= 65535:
            raise SystemExit('staging ports must be between 1024 and 65535')
        if wait_port('127.0.0.1', port, timeout=0.05, want_open=True):
            raise SystemExit(f'port already in use: {port}')

    uid = os.getuid()
    domain = f'gui/{uid}'
    label = f'org.labortransparency.staging.{os.getpid()}'
    tmp = Path(tempfile.mkdtemp(prefix='ltp-launchd-stage-'))
    tmp.chmod(0o700)
    # macOS background LaunchAgents can be denied access to privacy-protected
    # folders such as Downloads. Stage the exact current app and virtualenv in
    # this private temporary directory instead of weakening that OS boundary.
    stage_root = tmp / 'runtime'
    shutil.copytree(ROOT / 'app', stage_root / 'app')
    shutil.copytree(ROOT / '.venv', stage_root / '.venv', symlinks=True)
    plist = tmp / 'backend.plist'
    db = tmp / 'stage.sqlite3'
    stdout = tmp / 'backend.stdout.log'
    stderr = tmp / 'backend.stderr.log'
    proxy_stdout = (tmp / 'proxy.stdout.log').open('wb')
    proxy_stderr = (tmp / 'proxy.stderr.log').open('wb')
    proxy = None
    bootstrapped = False
    started = time.monotonic()
    result = {
        'status': 'FAILED',
        'scope': 'macOS user launchd; loopback-only; synthetic data only',
        'backend_port': args.backend_port,
        'proxy_port': args.proxy_port,
        'public_listener_created': False,
    }
    try:
        ca_path, cert_path, key_path = make_tls(tmp)
        write_plist(plist, label, stage_root, db, args.backend_port, stdout, stderr)
        result['staged_runtime_copy'] = True
        result['staged_runtime_reason'] = 'macOS LaunchAgent privacy keeps the Downloads project directory out of the managed process; no permission boundary was weakened'
        bootstrap = run('/bin/launchctl', 'bootstrap', domain, str(plist), check=False)
        if bootstrap.returncode != 0:
            raise RuntimeError('launchctl bootstrap failed: ' + bootstrap.stderr.strip())
        bootstrapped = True
        first_pid = wait_pid(domain, label)
        if not first_pid:
            raise RuntimeError('launchd did not report a backend pid')
        if not wait_port('127.0.0.1', args.backend_port, timeout=12):
            raise RuntimeError('launchd backend did not open loopback port')

        proxy = subprocess.Popen(
            [
                sys.executable, str(ROOT / 'scripts' / 'staging_reverse_proxy.py'),
                '--listen-port', str(args.proxy_port), '--upstream-port', str(args.backend_port),
                '--cert', str(cert_path), '--key', str(key_path),
            ],
            cwd=str(ROOT), stdout=proxy_stdout, stderr=proxy_stderr,
        )
        if not wait_port('127.0.0.1', args.proxy_port, timeout=8):
            raise RuntimeError('TLS staging proxy did not open loopback port')
        initial_status, initial_health = wait_health(args.proxy_port, ca_path)

        restart_started = time.monotonic()
        os.kill(first_pid, signal.SIGKILL)
        second_pid = wait_pid(domain, label, timeout=15, different_from=first_pid)
        if not second_pid:
            raise RuntimeError('launchd did not replace the terminated backend process')
        recovered_status, recovered_health = wait_health(args.proxy_port, ca_path, timeout=15)
        restart_seconds = round(time.monotonic() - restart_started, 3)

        if first_pid == second_pid:
            raise RuntimeError('pid did not change across restart')
        if initial_status != 200 or recovered_status != 200:
            raise RuntimeError('health status was not 200 before and after restart')
        result.update({
            'status': 'PASS',
            'launchd_domain': domain,
            'keepalive': True,
            'first_pid_observed': True,
            'replacement_pid_observed': True,
            'pid_changed': True,
            'initial_health': initial_health,
            'recovered_health': recovered_health,
            'restart_recovered_seconds': restart_seconds,
            'production_attachment_uploads_enabled': recovered_health.get('attachment_uploads_enabled'),
            'tls_client_verified_private_ca': True,
            'elapsed_seconds': round(time.monotonic() - started, 3),
            'claim_boundary': (
                'RUNTIME_VERIFIED for macOS user-level launchd recovery in this loopback staging drill only; '
                'Linux systemd/container supervision and public production recovery remain unverified.'
            ),
        })
    except Exception as exc:
        result['error'] = f'{exc.__class__.__name__}: {exc}'
        for name, log_path in (('backend_stdout_tail', stdout), ('backend_stderr_tail', stderr)):
            try:
                text = log_path.read_text(encoding='utf-8', errors='replace')
                result[name] = text[-4000:]
            except OSError:
                result[name] = ''
        raise
    finally:
        if proxy is not None:
            proxy.terminate()
            try:
                proxy.wait(timeout=4)
            except subprocess.TimeoutExpired:
                proxy.kill()
                proxy.wait(timeout=2)
        proxy_stdout.close()
        proxy_stderr.close()
        if bootstrapped:
            run('/bin/launchctl', 'bootout', f'{domain}/{label}', check=False)
        backend_closed = wait_port('127.0.0.1', args.backend_port, timeout=5, want_open=False)
        proxy_closed = wait_port('127.0.0.1', args.proxy_port, timeout=5, want_open=False)
        result['cleanup'] = {
            'launchd_bootout_attempted': bootstrapped,
            'backend_port_closed': backend_closed,
            'proxy_port_closed': proxy_closed,
            'temporary_directory_removed': True,
        }
        out = (ROOT / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        shutil.rmtree(tmp, ignore_errors=True)

    print(json.dumps({
        'status': result['status'],
        'pid_changed': result.get('pid_changed'),
        'restart_recovered_seconds': result.get('restart_recovered_seconds'),
        'cleanup': result.get('cleanup'),
        'out': str(out),
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
