# Independent Instances and Public Evidence Federation

Date: 2026-09-17
Status: `MINIMAL_PEER_DISCOVERY_PULL_VALIDATED_LOCAL`

## Project model

Worker Manifest Fellowship / Labor Transparency is evolving toward a **non-commercial public-interest upstream software + standards + public evidence collaboration network**.

The current public website is the project's **reference instance**. It is not intended to become a mandatory global hub for every downstream community.

A downstream instance is expected to own and operate its own:

- database and object storage;
- secrets and signing keys;
- user/session state;
- moderation and local operating policy;
- logs, backups and retention policy;
- infrastructure accounts and deployment responsibility.

A fork must not silently use the reference instance's production API, database, secrets, user state or private operations endpoints.

## P0 independent-instance bootstrap implemented now

A fresh Fork can create its own local instance bundle without any reference-production API/database/secret:

```sh
node scripts/instance/bootstrap.mjs \
  --name "My Labor Transparency Instance" \
  --operator "My Public-Interest Group"

node scripts/instance/start.mjs --dir .ltp-instance
```

The bootstrap creates:

```text
.ltp-instance/
├── instance.json      # public instance identity/config
├── secrets.json       # local private secrets, owner-only permissions
└── data/
    └── state.json     # created by the runtime on first use
```

Properties of the P0 bootstrap:

- stable random `instance.id` persisted across restarts;
- stable Ed25519 instance key pair: public key in `instance.json`, private key in `secrets.json` for the next signed-snapshot milestone;
- fresh local session/review/export/advisory/community-Agent secrets;
- `secrets.json` must not be group/world readable on POSIX; launcher fails closed otherwise;
- local FileStore data is private to the instance directory and stored with owner-only file permissions;
- bootstrap refuses to overwrite an existing instance directory;
- P0 launcher only binds localhost; public hosting remains a separate deployment/security decision;
- `/api/config` and `/api/health` expose only safe public instance identity, never private tokens or the private signing key;
- the instance uses the existing same-origin app/API and does not require the reference production site to be reachable.

The default `.ltp-instance/` directory is ignored by Git.

### Existing frontend fork-safety guard

The static frontend builder supports an explicit independent-instance mode:

```sh
LTP_INDEPENDENT_INSTANCE=true \
LTP_DEPLOYMENT_LABEL=my-public-interest-instance \
node deploy/frontend/build.mjs
```

In this mode the public frontend is required to use its **own same-origin API**. The build fails closed if either `LTP_PUBLIC_API_BASE` or `LTP_PROXY_API_ORIGIN` points it at a remote API/proxy.

This protects a common fork mistake: cloning the public frontend and accidentally sending users to an upstream production backend.

This is the first P0 fork-safety guard. A signed public-evidence federation transport is now implemented locally below, but the project still does **not** claim a complete production-grade one-command Docker/self-host stack or an operating public multi-node federation network.

## Data boundary

Federation is for public evidence, not user databases.

The target data boundary is:

| Class | Meaning | Federated by default? |
| --- | --- | --- |
| `PUBLIC_VERIFIED` | public source-scoped evidence/facts with revision provenance | future federation candidate |
| `PUBLIC_UNVERIFIED` | explicitly labeled public discussion/claims whose publication and redistribution rights permit sharing | only under explicit policy |
| `LOCAL_PSEUDONYMOUS` | ballots, local reputation/moderation state, session/account linkage | no |
| `LOCAL_PRIVATE` | private cases, identifiers, contacts, raw sensitive evidence/attachments | no |

The current core product continues to keep sensitive private-case intake disabled. Anonymous advisory is a local non-sensitive assistance queue, not federation data.

## Product / labor signal boundary

The product market introduced by the active candidate intentionally keeps three different channels:

1. **Worker perspective signal** — self-declared labor-related sentiment. It is not proof of employment and not proof of a labor fact.
2. **General community signal** — general company impression/attention from the local community.
3. **Concrete labor claim evidence** — scoped `labour_claim` records whose E-level/status/source/time/scope determine what each individual claim can support.

A product can display the labor context of its associated company to help a person make their own purchasing decision. It must not convert that context into a product-quality, safety, legality or employer-morality score.

The labels `劳工愤怒榜` and `劳工支持榜` are sentiment views. They are not verified misconduct/good-employer rankings and are not platform instructions to buy, boycott, harass or target anyone.

## Signed public-evidence federation implemented locally

The first federation transport is now implemented and locally validated as **pull/file based, signed, public-only full snapshots with explicit deltas**. It is deliberately not a user/account federation system.

### Export / import

Source instance:

```sh
node scripts/federation/export.mjs \
  --dir .ltp-instance \
  --out ./public-evidence.snapshot.json
```

Receiving instance must stop its local FileStore service before mutation, matching the project's existing offline-maintenance rule:

```sh
node scripts/federation/import.mjs \
  --dir /path/to/receiver/.ltp-instance \
  --file ./public-evidence.snapshot.json \
  --service-stopped
```

After restart, imported records are available from:

```text
GET /api/federation/evidence
GET /api/federation/evidence?sourceInstanceId=<id>
GET /api/federation/evidence?includeTombstones=0
```

There is intentionally no public HTTP federation mutation endpoint in this milestone. Import is an explicit local operator action so a remote peer cannot push arbitrary state into an instance.

### What may enter a v1 snapshot

The exporter reuses the existing `publicDataset(state)` eligibility gate rather than inventing another truth/rights system. A local contribution is eligible only when the existing model already permits independent public redistribution:

- `public=true`;
- current status is `REVIEWED` or `VERIFIED`;
- independent `exportApproved=true` privacy/rights review exists for the current version;
- no open correction flag pauses redistribution;
- system synthetic records are excluded.

That means a reviewed lower-evidence public discussion can be federated only after explicit redistribution approval; its E-level remains unchanged. Federation never upgrades evidence strength.

The first version deliberately does **not** export:

- general-community ballots or worker-perspective ballots;
- owner/session/account linkage;
- private community feedback or Agent responses;
- advisory cases/advice/receipts;
- contacts, IP addresses, private attachments or other sensitive data;
- records imported from another instance, preventing automatic forwarding loops;
- `OFFICIAL_SOURCE_REFERENCE`, `OFFICIAL_SOURCE_RELATION`, `OFFICIAL_SOURCE_EVENT` or machine/source-provider lanes until their source-specific redistribution terms are explicitly reviewed.

### Snapshot shape and signing

The canonical snapshot includes at least:

```json
{
  "schema": "LTP_PUBLIC_EVIDENCE_SNAPSHOT",
  "schemaVersion": 1,
  "snapshotMode": "FULL_AUTHORIZED_PUBLIC_DATASET",
  "instance": {
    "id": "ltp_...",
    "name": "...",
    "mode": "independent",
    "publicKey": {
      "algorithm": "Ed25519",
      "encoding": "spki-der-base64",
      "value": "..."
    }
  },
  "generatedAt": "...",
  "previousRoot": "...",
  "contentRoot": "...",
  "recordCount": 0,
  "records": [],
  "delta": {
    "baseRoot": "...",
    "upserts": [],
    "tombstones": []
  },
  "snapshotRoot": "...",
  "signature": {
    "algorithm": "Ed25519",
    "keyFingerprint": "...",
    "value": "..."
  }
}
```

Records are canonicalized and ordered before hashing. `contentRoot` commits to the full current authorized public record set; `snapshotRoot` commits to the unsigned snapshot including `previousRoot` and delta metadata; the stable instance Ed25519 private key signs `snapshotRoot`.

The full snapshot is authoritative for the current authorized set. `delta` is explicit synchronization/audit metadata derived from the source instance's previous export state; it cannot contradict the full snapshot.

### Trust, replay and chain rules

- The first explicit import is trust-on-first-import for that chosen snapshot/file and pins the source instance's public-key fingerprint locally.
- A later snapshot claiming the same instance ID with a different public key is rejected; automatic key rotation is intentionally unsupported.
- Re-importing the exact current `snapshotRoot` is idempotent.
- Once a source is pinned, later snapshots must have `previousRoot` equal to the receiver's last accepted `snapshotRoot`; skipped/forked/stale snapshots are rejected.
- Same source record version with a different record hash is rejected.
- Source-version rollback is rejected.
- Schema, exact allowlisted fields, HTTPS source links, content root, snapshot root and Ed25519 signature are all verified before mutation.

If an operator first joins a source at a later full snapshot rather than its genesis snapshot, that explicit import becomes the local trust anchor (`TRUSTED_CURRENT_SNAPSHOT`); subsequent chain continuity is strict from that point forward.

### Correction, retraction and tombstone behavior

Because `snapshotMode` is explicitly a full authorized dataset, a previously imported record missing from the next valid snapshot becomes `TOMBSTONED`. This covers cases such as withdrawal, edit/re-review, open correction, lost redistribution approval or another source-side removal from the currently authorized set.

A tombstone keeps only what is needed to prove history:

- source instance / logical record identity;
- last source version;
- record hash;
- snapshot roots and timestamps;
- `UPSERT` / `TOMBSTONE` / `RESTORE` history.

The old record body is removed from the public federated projection when tombstoned. This preserves auditable change history without treating previously published text as permanently non-removable. If the source later publishes a corrected/reapproved version, a valid later snapshot restores the record with the new version/body while preserving hash-chain history.

### Local validation already passed

The two-instance integration path proves:

`Instance A -> signed export -> verify -> stopped-service import -> Instance B -> public provenance API -> tombstone -> corrected/reapproved restore`

It also proves fail-closed behavior for:

- content tampering;
- signature/root mismatch;
- replay of the current root (idempotent no-op);
- stale/old snapshot import;
- skipped snapshot / chain gap;
- same instance ID with a different signing key;
- live FileStore mutation without explicit `--service-stopped`.

The initial test did expose exactly that last live-service problem: a separate offline FileStore writer updated disk while a running process retained an in-memory state view. Rather than add a hot-write backdoor, federation import now inherits the project's existing explicit service-stopped maintenance gate.

## Content-addressed multi-mirror publication implemented locally

The signed snapshot can now be packaged and copied to multiple independent mirror roots **without changing or re-signing the source snapshot**.

Create a content-addressed public package:

```sh
node scripts/federation/package.mjs \
  --snapshot ./public-evidence.snapshot.json \
  --out ./.ltp-instance/publication
```

The package layout is deterministic:

```text
public-evidence/
└── sources/
    └── src_<sha256(instanceId) prefix>/
        └── <snapshotRoot>/
            ├── manifest.json
            └── <snapshotRoot>.snapshot.json
```

`manifest.json` is derived metadata, not a new authority or signature. It binds:

- source instance ID/name;
- source public-key fingerprint;
- `snapshotRoot`, `contentRoot`, `previousRoot`;
- source snapshot generation time and record count;
- exact content-addressed snapshot filename;
- exact SHA-256 of the source snapshot file bytes.

The authoritative signature remains the source instance's Ed25519 signature inside the snapshot itself.

Publish the same package to any number of local mirror roots (for example, separate checked-out Git repositories, static-site staging directories or object-store sync roots):

```sh
node scripts/federation/publish-mirrors.mjs \
  --package /path/to/package/public-evidence/sources/.../<snapshotRoot> \
  --mirror /path/to/mirror-a \
  --mirror /path/to/mirror-b \
  --mirror /path/to/mirror-c
```

Each mirror receives byte-identical source-signed snapshot data and a deterministic `public-evidence/index.json`. The index is only a discovery hint; it is **not signed and not trusted as evidence**. Every read re-verifies the package path, exact snapshot-file hash, snapshot roots, source identity and original source signature.

Verify one mirror:

```sh
node scripts/federation/verify-mirror.mjs \
  --mirror /path/to/mirror-a \
  --snapshot-root <snapshotRoot> \
  --source-instance-id <instanceId>
```

Resolve/recover from multiple mirrors:

```sh
node scripts/federation/resolve-mirrors.mjs \
  --mirror /path/to/mirror-a \
  --mirror /path/to/mirror-b \
  --mirror /path/to/mirror-c \
  --snapshot-root <snapshotRoot> \
  --source-instance-id <instanceId> \
  --out ./recovered.snapshot.json
```

Resolver rules:

- missing or corrupt mirrors are recorded as failures but do not block recovery when another independently verified mirror contains the requested snapshot;
- multiple valid mirrors must agree on source instance and exact snapshot-file SHA-256, making them byte-identical copies of the same source-signed artifact;
- a corrupt existing content-addressed package is never silently overwritten by the publisher;
- manifest/path/index mismatches, file-hash changes and source-signature failures all fail closed;
- mirror index history is not silently pruned when its safety bound is reached;
- mirror package/index contain no additional user/private data or mirror-side secret material beyond the already public source-signed snapshot plus derived public metadata.

Local destructive validation proved this recovery path: three mirrors were published; mirror A was deleted; mirror B's snapshot bytes were corrupted; resolver successfully recovered the exact original source-signed bytes from mirror C. After mirror C's manifest was also tampered, resolution failed completely rather than accepting damaged evidence. Real package/publish/verify/resolve CLI paths also passed.

This milestone proves the **storage/distribution contract**, not external availability. No GitHub mirror repository, object-storage bucket or IPFS node was created or modified in this local round. A mirror root can now be safely mapped to those services later without changing evidence semantics.

Optional IPFS pinning may later improve redundancy for these **public signed snapshots only**; it must never carry private/sensitive records and does not replace correction/retraction semantics.

## Minimal signed peer discovery and pull implemented locally

The next layer is intentionally **explicit peer trust**, not an automatic global registry. A source instance can publish a small signed descriptor that binds its stable instance identity/key to the latest source-signed snapshot and one or more public-evidence mirror URLs.

Generate a descriptor from an already verified latest package:

```sh
node scripts/federation/descriptor.mjs \
  --dir .ltp-instance \
  --package /path/to/package/.../<snapshotRoot> \
  --mirror-url https://mirror-a.example/public-evidence \
  --mirror-url https://mirror-b.example/public-evidence \
  --out ./peer.json
```

A descriptor includes:

- source `instance.id`, name, operator/public URL when configured, and Ed25519 public key;
- descriptor generation time;
- latest `snapshotRoot/contentRoot/previousRoot`, source snapshot time and record count;
- source public-key fingerprint;
- 1—16 explicitly declared `public-evidence` mirror base URLs;
- `descriptorRoot` plus source Ed25519 signature.

The descriptor never includes runtime/session/review/export/advisory/community-Agent secrets or the signing private key.

A receiving operator must explicitly trust/add a descriptor:

```sh
node scripts/federation/trust-peer.mjs \
  --dir /path/to/receiver/.ltp-instance \
  --descriptor https://peer.example/peer.json \
  --trust \
  --allow-network
```

Trust behavior:

- `--trust` is mandatory; there is no automatic directory/registry enrollment;
- first trust pins the peer's Ed25519 key fingerprint in local owner-private `peers.json`;
- later descriptors for the same instance ID must use the same key;
- older descriptor timestamps are rejected as rollback;
- same timestamp + different descriptor root is rejected as conflict;
- a receiving instance cannot add itself as a peer;
- descriptor source location is local operator metadata, not evidence authority.

Pull a trusted peer while the FileStore service is stopped:

```sh
node scripts/federation/pull-peer.mjs \
  --dir /path/to/receiver/.ltp-instance \
  --peer <instanceId> \
  --service-stopped \
  --refresh-descriptor \
  --allow-network
```

Pull semantics:

1. optionally refresh the saved descriptor from its explicit source and re-check the pinned key/rollback rules;
2. fetch each signed-declared mirror `index.json` as an **untrusted hint**;
3. find the descriptor's latest `snapshotRoot`;
4. fetch/verify the mirror package and original source-signed snapshot;
5. if the receiver already has an older accepted source root, walk `previousRoot` backwards through mirror indexes until that exact local root is reached;
6. reverse the verified chain and import each missing snapshot in order through the existing federation importer;
7. keep existing idempotency, source-version, tombstone and key-pinning rules unchanged.

Thus a receiver at snapshot v1 can consume a descriptor pointing at v3 and recover the missing v2 -> v3 chain, provided at least one declared mirror still contains each required source-signed artifact. A corrupt mirror is recorded/ignored when another valid mirror supplies the same byte-identical artifact.

Transport rules are deliberately bounded:

- descriptors/mirrors allow HTTPS; loopback HTTP is allowed only for local tests;
- URLs may not contain embedded credentials, query strings or fragments;
- mirror URLs must directly identify a `public-evidence` root;
- non-loopback network access requires explicit `--allow-network`;
- redirects are rejected;
- descriptor/index/manifest/snapshot response sizes and timeouts are bounded;
- there is still no remote federation mutation endpoint.

Local validation proved descriptor tamper rejection, descriptor rollback rejection, same instance ID + different signing key rejection, stopped-service enforcement, chain catch-up across a damaged mirror, up-to-date idempotency, and real descriptor/trust/pull CLI flows. Two early implementation failures were retained: the first passed an enriched verification view back through the strict raw-descriptor parser, and an early CLI test used `spawnSync`, blocking its own loopback HTTP server and causing a false timeout. The fixes preserved strict parsing and switched the CLI test to asynchronous child processes; no acceptance rule was weakened.

This is still **operator-mediated discovery**, not Internet-wide autonomous discovery. URL/DNS/mirror count never upgrades evidence strength; evidence remains anchored in the source instance key, signed snapshot and existing claim/evidence semantics.

## What is not implemented yet

- automatic peer/instance discovery or fetch scheduling;
- actual external Git/object-storage mirror publication and availability monitoring;
- optional IPFS pin/persistence workflow for public signed snapshots;
- source-specific federation of official/machine/provider lanes whose redistribution rights have not been reviewed;
- automatic signing-key rotation/recovery policy;
- cross-instance community/worker-signal aggregation or anti-Sybil weighting;
- production-grade one-command self-host packaging with TLS, reverse proxy, backup, monitoring and production Queue/Cron research;
- cross-instance accounts or identity;
- sensitive report/case hosting in the core distribution;
- blockchain consensus or immutable private-data storage.

These are not required to use the current reference instance and must not be presented as completed capabilities.

## Validation pointers

The initial P0/product candidate is governed by:

- `docs/v0_8/CHANGE-federated-public-interest-network-and-product-labor-signals.md`
- `AGENTS.md`
- `PROJECT_CONTINUITY.md`
- `sites-app/tests/model.test.mjs`
- `sites-app/tests/api.test.mjs`
- `sites-app/tests/ui.test.mjs`
- `sites-app/src/federation.mjs`
- `scripts/federation/export.mjs`
- `scripts/federation/import.mjs`
- `scripts/federation/federation.test.mjs`
- `sites-app/src/snapshot-mirror.mjs`
- `scripts/federation/package.mjs`
- `scripts/federation/publish-mirrors.mjs`
- `scripts/federation/verify-mirror.mjs`
- `scripts/federation/resolve-mirrors.mjs`
- `scripts/federation/mirror.test.mjs`
- `sites-app/src/peer-discovery.mjs`
- `scripts/federation/descriptor.mjs`
- `scripts/federation/trust-peer.mjs`
- `scripts/federation/pull-peer.mjs`
- `scripts/federation/peer.test.mjs`
- `cloudflare-backend/scripts-smoke.mjs`
- `scripts/deployment/verify_cloudflare_local.sh`
- `.github/workflows/ci.yml`

Production deployment of the candidate is a separate release/acceptance action. The accepted production runtime remains whatever `PROJECT_CONTINUITY.md` and `qa/v0_8/verification.json` currently identify until that release gate is completed.
