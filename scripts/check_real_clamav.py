"""Verify the real local ClamAV engine and the production attachment gate.

This check is synthetic and local. It never scans user files. It verifies three
layers with a locally installed clamscan binary and its installed signature DB:
1) direct adapter CLEAN/INFECTED classification;
2) production-config attachment mode wired to that exact executable;
3) API storage accepts a clean synthetic text attachment and rejects an EICAR
   antivirus test file before database storage.

The EICAR string is the standard inert antivirus test signature, not malware.
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT))

from app.malware import ClamAVScanner
from app.security import load_production_config
from app.server import create_app

EICAR = b'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
CLEAN = b'ordinary synthetic public-interest attachment for scanner verification\n'


def scanner_version(executable):
    result = subprocess.run([executable, '--version'], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError('clamscan --version failed')
    return result.stdout.strip()


def default_database_facts():
    candidates = [Path('/opt/homebrew/var/lib/clamav'), Path('/usr/local/var/lib/clamav'), Path('/var/lib/clamav')]
    for directory in candidates:
        if directory.is_dir():
            files = []
            for p in sorted(directory.iterdir()):
                if p.is_file() and p.suffix.lower() in {'.cvd', '.cld'}:
                    files.append({'name': p.name, 'size': p.stat().st_size})
            return str(directory), files
    return '', []


def mutation_headers(csrf):
    return {'Origin': 'https://labor.example', 'X-Ltp-Csrf': csrf}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', default='qa/v0_6/clamav-real.json')
    args = parser.parse_args()

    clamscan = shutil.which('clamscan')
    freshclam = shutil.which('freshclam')
    if not clamscan:
        raise SystemExit('clamscan is not installed')
    clamscan = str(Path(clamscan).resolve())
    version = scanner_version(clamscan)
    db_dir, db_files = default_database_facts()
    if not db_files:
        raise SystemExit('no ClamAV .cvd/.cld signature database is present in the default database directory')

    scanner = ClamAVScanner(clamscan, timeout_seconds=30)
    direct_clean = scanner.scan(CLEAN, 'clean.txt', 'text/plain')
    direct_infected = scanner.scan(EICAR, 'eicar.txt', 'text/plain')
    if direct_clean.get('status') != 'CLEAN':
        raise RuntimeError('real ClamAV did not classify the clean synthetic file as CLEAN')
    if direct_infected.get('status') != 'INFECTED':
        raise RuntimeError('real ClamAV did not classify EICAR as INFECTED')

    with tempfile.TemporaryDirectory(prefix='ltp-real-clamav-api-') as td:
        td = Path(td)
        db = td / 'production.sqlite3'
        env = {
            'LTP_RUNTIME_PROFILE': 'production',
            'LTP_DB': str(db),
            'LTP_ADMIN_TOKEN': 'A' * 48,
            'LTP_SECURITY_SECRET': 'S' * 48,
            'LTP_ALLOWED_HOSTS': 'labor.example',
            'LTP_ALLOWED_ORIGINS': 'https://labor.example',
            'LTP_PROXY_MODE': 'direct',
            'LTP_ADMIN_ALLOWED_IPS': '127.0.0.1',
            'LTP_ATTACHMENT_UPLOADS': 'clamav',
            'LTP_CLAMSCAN_PATH': clamscan,
        }
        loaded_security, loaded_db, admin_token = load_production_config(env)
        if loaded_security.attachment_mode != 'clamav' or loaded_security.clamscan_path != clamscan:
            raise RuntimeError('production config did not preserve the real clamscan path')
        if loaded_db != db.resolve():
            raise RuntimeError('production config database path mismatch')

        # Use the exact loaded production security object. TestClient provides a
        # real ASGI request path without exposing a network listener.
        app = create_app(str(db), admin_token=admin_token, security_config=loaded_security)
        app.state.store.set_phase('assistance')
        client = TestClient(app, base_url='https://labor.example')
        config = client.get('/api/config')
        if config.status_code != 200:
            raise RuntimeError('production config endpoint failed')
        config_json = config.json()
        csrf = config_json.get('csrf_token', '')
        if config_json.get('attachment_scan_mode') != 'clamav' or not config_json.get('attachment_uploads_enabled'):
            raise RuntimeError('production API did not expose the enabled ClamAV gate')
        if len(csrf) != 64:
            raise RuntimeError('production CSRF token missing')
        headers = mutation_headers(csrf)

        registration = client.post(
            '/api/requests', headers={**headers, 'Idempotency-Key': str(uuid.uuid4())},
            json={
                'name': 'ClamAV synthetic company', 'region': 'synthetic region',
                'public': False, 'synthetic': True, 'consent': True, 'needs': ['help'],
            },
        )
        if registration.status_code != 200:
            raise RuntimeError('synthetic company registration failed: ' + registration.text[:500])
        company_id = registration.json()['company_id']
        case = client.post(
            f'/api/companies/{company_id}/cases', headers=headers,
            json={'title': 'scanner synthetic case', 'facts': 'synthetic facts only', 'goal': 'verify private attachment scan'},
        )
        if case.status_code != 200:
            raise RuntimeError('synthetic private case creation failed: ' + case.text[:500])
        case_id = case.json()['id']

        clean_upload = client.post(
            f'/api/cases/{case_id}/evidence', headers=headers,
            json={
                'claim': 'clean synthetic scanner check', 'filename': 'clean.txt',
                'content_b64': base64.b64encode(CLEAN).decode('ascii'),
            },
        )
        if clean_upload.status_code != 200 or clean_upload.json().get('scan_status') != 'CLEAN':
            raise RuntimeError('real clean attachment was not accepted as CLEAN: ' + clean_upload.text[:500])

        infected_upload = client.post(
            f'/api/cases/{case_id}/evidence', headers=headers,
            json={
                'claim': 'EICAR synthetic scanner check', 'filename': 'eicar.txt',
                'content_b64': base64.b64encode(EICAR).decode('ascii'),
            },
        )
        if infected_upload.status_code == 200:
            raise RuntimeError('EICAR attachment was incorrectly stored')

        case_after = client.get(f'/api/cases/{case_id}')
        if case_after.status_code != 200:
            raise RuntimeError('private case retrieval failed')
        evidence = case_after.json().get('evidence', [])
        if len(evidence) != 1:
            raise RuntimeError('infected upload changed stored evidence count')
        stored = evidence[0]
        if stored.get('scan_status') != 'CLEAN' or stored.get('scan_engine') != 'clamav':
            raise RuntimeError('stored clean attachment lacks real ClamAV scan metadata')

    signature_version = None
    match = re.search(r'ClamAV\s+[^/]+/(\d+)/', version)
    if match:
        signature_version = int(match.group(1))
    result = {
        'status': 'PASS',
        'scope': 'real local ClamAV binary and real installed signature DB; synthetic files only',
        'clamscan_path': clamscan,
        'freshclam_path': str(Path(freshclam).resolve()) if freshclam else None,
        'version': version,
        'signature_version': signature_version,
        'database_directory': db_dir,
        'database_files': db_files,
        'direct_adapter': {
            'clean_status': direct_clean.get('status'),
            'eicar_status': direct_infected.get('status'),
        },
        'production_config': {
            'attachment_mode': 'clamav',
            'real_executable_accepted': True,
        },
        'production_api': {
            'attachment_uploads_enabled': True,
            'clean_upload_http_status': 200,
            'clean_scan_status': 'CLEAN',
            'infected_upload_rejected': True,
            'stored_evidence_count_after_infected_attempt': 1,
            'stored_scan_engine': 'clamav',
        },
        'freshclam_update_observed': bool(db_files),
        'public_listener_created': False,
        'claim_boundary': (
            'RUNTIME_VERIFIED for the locally installed ClamAV engine/signature database and the production attachment gate. '
            'Long-run FreshClam scheduling, mirror availability, signature retention policy and scan performance under load remain separate operations gates.'
        ),
    }
    out = (ROOT / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'status': result['status'], 'version': version,
        'clean': direct_clean.get('status'), 'eicar': direct_infected.get('status'),
        'api_clean': 200, 'api_infected_rejected': True, 'out': str(out),
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
