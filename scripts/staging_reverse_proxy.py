"""Loopback-only TLS reverse proxy used only for controlled staging rehearsal.

This is not a production proxy replacement. It exists to verify the application's
trusted-forwarding, Host/Origin/HTTPS, CSRF and restart behavior before a real
Caddy/Nginx staging environment is available.
"""
from __future__ import annotations

import argparse
import http.client
import ipaddress
import ssl
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOP_BY_HOP = {
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade',
}
FORWARDED = {'forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip'}
MAX_BODY = 3_100_000


def is_loopback(host: str) -> bool:
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return host == 'localhost'


def request_headers(handler: BaseHTTPRequestHandler):
    result = {}
    for key, value in handler.headers.items():
        low = key.lower()
        if low in HOP_BY_HOP or low in FORWARDED:
            continue
        result[key] = value
    original_host = handler.headers.get('Host', '')
    if original_host:
        result['Host'] = original_host
        result['X-Forwarded-Host'] = original_host
    result['X-Forwarded-Proto'] = 'https'
    result['X-Forwarded-For'] = handler.client_address[0]
    result['Connection'] = 'close'
    return result


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'LTP-Staging-Proxy/1'

    def log_message(self, fmt, *args):
        # Do not emit headers, cookies, bodies, query data or credentials.
        print('%s %s %s' % (self.command, self.path.split('?', 1)[0], args[1] if len(args) > 1 else ''), flush=True)

    def _proxy(self):
        try:
            length = int(self.headers.get('Content-Length', '0') or '0')
        except ValueError:
            self.send_error(400, 'Invalid Content-Length')
            return
        if length < 0 or length > MAX_BODY:
            self.send_error(413, 'Request body too large')
            return
        body = self.rfile.read(length) if length else None
        conn = http.client.HTTPConnection(self.server.upstream_host, self.server.upstream_port, timeout=8)
        try:
            conn.request(self.command, self.path, body=body, headers=request_headers(self))
            upstream = conn.getresponse()
            payload = upstream.read()
            self.send_response(upstream.status, upstream.reason)
            for key, value in upstream.getheaders():
                if key.lower() in HOP_BY_HOP or key.lower() in ('server', 'content-length'):
                    continue
                self.send_header(key, value)
            self.send_header('Via', 'LTP-Staging-Proxy/1')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Connection', 'close')
            self.end_headers()
            if self.command != 'HEAD' and payload:
                self.wfile.write(payload)
        except (ConnectionError, OSError, http.client.HTTPException):
            payload = b'{"error":"staging upstream unavailable"}'
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Connection', 'close')
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(payload)
        finally:
            conn.close()

    do_GET = _proxy
    do_HEAD = _proxy
    do_POST = _proxy
    do_PUT = _proxy
    do_PATCH = _proxy
    do_DELETE = _proxy
    do_OPTIONS = _proxy


class ProxyServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, server_address, handler, upstream_host, upstream_port):
        super().__init__(server_address, handler)
        self.upstream_host = upstream_host
        self.upstream_port = upstream_port


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--listen-host', default='127.0.0.1')
    parser.add_argument('--listen-port', type=int, required=True)
    parser.add_argument('--upstream-host', default='127.0.0.1')
    parser.add_argument('--upstream-port', type=int, required=True)
    parser.add_argument('--cert', required=True)
    parser.add_argument('--key', required=True)
    args = parser.parse_args()

    if not is_loopback(args.listen_host) or not is_loopback(args.upstream_host):
        raise SystemExit('staging proxy only permits loopback listen/upstream addresses')
    cert, key = Path(args.cert), Path(args.key)
    if not cert.is_file() or not key.is_file():
        raise SystemExit('TLS certificate/key not found')
    server = ProxyServer((args.listen_host, args.listen_port), ProxyHandler, args.upstream_host, args.upstream_port)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(str(cert), str(key))
    server.socket = context.wrap_socket(server.socket, server_side=True)
    print(f'STAGING_PROXY_READY https://{args.listen_host}:{args.listen_port} -> http://{args.upstream_host}:{args.upstream_port}', flush=True)
    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
