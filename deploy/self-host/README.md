# Self-host independent instance

Status: local release/runtime contract validated; reference production unchanged.

This path is for a downstream public-interest community that wants its **own** Labor Transparency instance. It does not connect to the Worker Manifest Fellowship reference production API/database/secrets by default.

## Security / responsibility boundary

- Instance identity, Ed25519 key, session/review/export/Agent secrets and FileStore state live in the instance data directory/volume, never in the release image.
- The app is a same-origin frontend + API. Do not split the browser onto an unrelated remote API.
- In the Compose layout the `app` service has no host-published port; Caddy is the only host ingress.
- Production Caddy should terminate TLS. Keep `LTP_SELF_HOST_SECURE_COOKIE=true` for HTTPS.
- Host allowlisting, exact Origin matching, CSRF, SameSite cookie and security headers remain enabled. Do not disable them to simplify deployment.
- This FileStore self-host release does not provide the Cloudflare production Queue/Cron automatic company-research runtime. Existing community/public contribution/advisory/product/federation functions work, but production-grade unattended research requires a separately accepted deployment adapter.
- Downstream operators own their own moderation, backups, availability, logs and legal/privacy obligations. The upstream reference instance is not their data controller/operator by default.

## Option A — portable Node release bundle

Build a code-only release directory:

```sh
node scripts/instance/build-self-host-release.mjs \
  --out ./release/self-host \
  --revision local
```

`SELF_HOST_RELEASE.json` hashes the complete bundle. Generated instance data is intentionally excluded.

First start, with the instance data outside the release directory:

```sh
export LTP_INSTANCE_DIR=/srv/ltp-data/instance
export LTP_INSTANCE_NAME='My Labor Transparency Community'
export LTP_INSTANCE_OPERATOR='My Public-Interest Group'
export LTP_INSTANCE_PUBLIC_URL='https://labor.example.org'
export LTP_SELF_HOST_SECURE_COOKIE=true
export LTP_SELF_HOST_ALLOWED_HOSTS='labor.example.org'
export HOST=127.0.0.1
export PORT=8787

node ./release/self-host/scripts/instance/self-host-server.mjs
```

The first run bootstraps the instance automatically. Later code releases can replace `./release/self-host` while reusing `/srv/ltp-data/instance`; the instance ID/secrets/state are not regenerated.

Use a reverse proxy such as Caddy in front of the loopback app. The supplied `Caddyfile` intentionally relies on Caddy's default preservation of the incoming `Host` header. Do not rewrite it to `{host}`: stripping the public port can break the backend's exact Origin-vs-Host CSRF check.

## Option B — Docker Compose

Copy the example environment file, then edit it:

```sh
cp deploy/self-host/.env.example deploy/self-host/.env
```

Local-only HTTP smoke defaults:

```text
LTP_SITE_ADDRESS=:80
LTP_HTTP_BIND=127.0.0.1:8080
LTP_SELF_HOST_SECURE_COOKIE=false
```

Public example:

```text
LTP_INSTANCE_PUBLIC_URL=https://labor.example.org
LTP_SITE_ADDRESS=labor.example.org
LTP_HTTP_BIND=0.0.0.0:80
LTP_HTTPS_BIND=0.0.0.0:443
LTP_SELF_HOST_SECURE_COOKIE=true
LTP_SELF_HOST_ALLOWED_HOSTS=labor.example.org
```

Then:

```sh
docker compose -f deploy/self-host/compose.yml build app
docker compose -f deploy/self-host/compose.yml up -d
```

Caddy automatically manages HTTPS when `LTP_SITE_ADDRESS` is a real hostname and ports 80/443 are reachable. The app only exposes `8787` to the internal Compose network; it is not published to the host.

The current local machine successfully validates `docker compose config` and the Caddy production-domain configuration, but a full local image build is currently blocked by this machine's Docker Hub registry path timing out while pulling `node:22-alpine`. This is recorded as an external-registry validation gap, not silently reported as a successful container build.

## Health / preflight

Runtime readiness:

```sh
node scripts/instance/healthcheck.mjs \
  --url http://127.0.0.1:8787
```

Offline instance integrity/pre-upgrade check:

```sh
node scripts/instance/preflight.mjs \
  --dir /srv/ltp-data/instance
```

The preflight verifies instance config, private file permissions, Ed25519 key correspondence, state schema, peer trust store and federation export-chain metadata without printing secrets.

## Backup

FileStore backup is an offline operation. Stop the app first, then explicitly acknowledge that state:

```sh
node scripts/instance/backup.mjs \
  --dir /srv/ltp-data/instance \
  --out /srv/ltp-backups/backup-2026-09-17 \
  --service-stopped
```

The private backup includes only the current essential instance files:

- `instance.json`
- `secrets.json`
- `data/state.json`
- `peers.json` when present
- `federation/export-state.json` when present

`backup-manifest.json` binds exact file hashes/sizes/modes. Backup creation refuses an existing output directory and private files remain owner-only on POSIX.

Validate an instance against a backup before upgrade:

```sh
node scripts/instance/preflight.mjs \
  --dir /srv/ltp-data/instance \
  --backup /srv/ltp-backups/backup-2026-09-17
```

## Restore

Restore only into a missing or empty target while the service is stopped:

```sh
node scripts/instance/restore.mjs \
  --backup /srv/ltp-backups/backup-2026-09-17 \
  --dir /srv/new-ltp-data/instance \
  --service-stopped
```

Restore verifies the backup manifest and every file hash before copying. It refuses to overwrite a non-empty instance directory. A restored instance keeps the same instance ID, signing key, operational secrets, local state, peer trust and federation metadata.

## Upgrade procedure

1. Stop the FileStore app.
2. Create a verified backup.
3. Run `preflight.mjs --backup ...`.
4. Build/download the new **code-only** self-host release or image.
5. Keep the existing instance data directory/volume unchanged.
6. Start the new release against that same data path.
7. Run `healthcheck.mjs` and verify the expected instance ID.
8. Confirm the company/product/federation views before deleting old code artifacts.

The local regression test explicitly starts two separately built release bundles (`rev-a` then `rev-b`) against the same restored data directory and verifies that the instance ID and user data survive the release replacement.

## Current non-claims

This self-host candidate does not establish:

- a successful container build on every registry/network path;
- public DNS/firewall correctness or a real CA certificate lifecycle on a downstream server;
- automatic backups/off-site replication;
- production monitoring/alerting;
- production Queue/Cron company research in the FileStore runtime;
- an upstream guarantee for a downstream operator's uptime/moderation/compliance.

Those must be verified by each deployment environment rather than inferred from the reference instance.
