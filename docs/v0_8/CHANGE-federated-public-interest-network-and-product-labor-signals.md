# CHANGE — Federated public-interest network + product labor signals

Date: 2026-09-17
Impact: `PROJECT_INTENT_DELTA + ARCHITECTURE_DELTA + PRODUCT_BEHAVIOR_DELTA`
Production impact in this work round: `NONE_UNTIL_SEPARATE_DEPLOYMENT_ACCEPTANCE`
Status: `VERSIONED_SOURCE_CANDIDATE_PUBLISHED_CI_PASS / PRODUCTION_NOT_DEPLOYED`
Current source/runtime candidate: `0.9.0-rc.1`
Current next gate: `REFERENCE_PRODUCTION_RELEASE_GATE` after successful versioned source publication + CI

## PROBLEM

The accepted v0.8.8 production baseline is usable, but the long-term architecture still presents one canonical production site as the natural center of the project. That creates an avoidable responsibility and continuity concentration: upstream maintainers can become the default operator for user data, regional moderation and global availability even though the project is non-commercial public-interest infrastructure.

The product also exposes company/community evidence well, but workers cannot yet browse products in a consumer-style surface that makes three different signals legible at once:

1. worker-perspective discussion about labor treatment;
2. general community image/opinion;
3. concrete labor claims and their evidence strength.

Without explicit separation, a future "anger list" or "support list" could accidentally turn popularity/emotion into a factual employer or product-quality verdict.

## CURRENT

- Canonical production is the accepted v0.8.8 reference deployment on Vercel + Cloudflare Worker/D1.
- The core license is already non-commercial public-interest source-available, not OSI Open Source.
- Public product records are `product` contributions attached to a company.
- General company community sentiment is stored as deduplicated positive/negative ballots.
- Concrete labor-practice claims use `labour_claim`, direction, E0–E5 evidence and review/flag semantics.
- Official reference/relation/event and machine/source-signal lanes remain separate.
- Anonymous advisory deliberately does not accept sensitive identity/contact/attachment data.
- Frontend source defaults to same-origin API; the generic source tree does not hardcode the canonical production API.

## PROPOSED

### A. Project identity and deployment model

Evolve the project from "one centrally operated global platform" toward:

`non-commercial public-interest upstream software + standards + public evidence collaboration network + independently operated instances + one reference instance`

Independent instances own their own database, secrets, users, logs, moderation and deployment responsibility. A fork must not silently depend on the reference instance's production API/database/secrets.

The upstream project maintains code, evidence semantics, privacy/safety baselines, interoperable public-data contracts and reference documentation. It does not automatically become operator/controller for every downstream instance.

### B. Federation data boundary

Federation is for public evidence, not user databases.

Data is separated conceptually into:

1. `PUBLIC_VERIFIED` — public, source-scoped evidence/facts with revision history;
2. `PUBLIC_UNVERIFIED` — explicitly labeled public discussion/claims that may be shared only under their publication/redistribution rules;
3. `LOCAL_PSEUDONYMOUS` — ballots, local reputation/moderation state and local account/session linkage; not federated by default;
4. `LOCAL_PRIVATE` — private cases, identifiers, contacts, raw sensitive materials/attachments; not federated. The core project continues to keep sensitive private-case intake disabled.

Future federation snapshots must support correction/retraction/tombstone semantics. "Auditable history" does not mean immutable publication of private or legally removable material.

### C. Product labor-signal surface

Add a shopping-app-like product page whose cards show the product and company while keeping three independent lanes:

- `WORKER_PERSPECTIVE_SIGNAL` — self-declared worker/applicant/contractor perspective; positive/negative labor-treatment sentiment. It affects only labor-treatment discussion/ranking and is not employment verification or fact.
- `GENERAL_COMMUNITY_SIGNAL` — existing general positive/negative company impression. It affects community-image display/ranking only.
- `LABOUR_CLAIM_EVIDENCE` — concrete public `labour_claim` records, including direction, evidence level, status, scope/date/source where present. It determines only how strongly a specific labor claim is supported.

Product cards may inherit the company's labor/community context as a consumer-choice reference, but company labor signals never become product quality/safety facts.

Initial product lanes:

- all public products;
- "劳工愤怒榜" — ordered by negative worker-perspective signals, explicitly labeled as community emotion/sentiment;
- "劳工支持榜" — ordered by positive worker-perspective signals;
- evidence-focused labor context — ordered by strongest supported concrete labor claims, without collapsing direction and evidence into one moral score;
- community attention — ordered by general community participation.

The UI may explain that users can make their own support/avoidance purchasing decisions. The project does not claim a verified "good/bad company" score and does not organize harassment or paid targeting.

### D. First fork-safety guard

Add an explicit independent/fork frontend build mode. In that mode the build must fail closed if configured to call a remote API/proxy; it must remain same-origin so a cloned deployment cannot silently point to upstream production. This is a first P0 guard, not the complete future one-command self-host stack.

## PRESERVE

The following accepted behavior must not regress:

- E0 discussion remains usable; popularity and evidence strength remain separate.
- No uncalibrated truth score, employer morality score, product-quality score or legal-risk score.
- Community / worker-perspective / concrete claim evidence / official reference / official relation / official event / machine reference / source signal remain distinct lanes.
- `0 match` does not mean absence; `NOT_APPLICABLE` retains its existing meaning.
- Subject binding remains fail-closed; abbreviations/context similarity cannot upgrade identity.
- Queue remains the new-company research main path; Cron remains recovery/refresh.
- Normal production remains independent of a named human reviewer.
- Anonymous advisory continues to reject sensitive identity/contact/health/payment/attachment data.
- Production E2E remains post-deploy manual with exact QA cleanup.
- Tencent/EdgeOne remains historical/non-gate.
- Existing accepted v0.8.8 production is not changed or redeployed merely because this candidate exists.

## IMPLEMENTATION SCOPE — THIS ROUND

In scope:

- project-governance/continuity update for the new authorized direction;
- worker-perspective company ballot lane, backward-compatible with existing community ballots;
- public product-market projection/API;
- product consumer-choice page and distinct discussion/evidence entry points;
- focused semantic/API/UI tests;
- independent/fork build guard and test/documentation.

Out of scope for this round:

- blockchain storage;
- irreversible storage of personal/private material;
- global peer discovery/consensus;
- cross-instance identity/account sharing;
- automatic cross-instance user-discussion replication;
- a new sensitive report/case portal;
- full monorepo rewrite;
- production deployment/release acceptance;
- a new version number solely for planning/governance.

## VALIDATION

Before this candidate can be called locally implemented:

1. existing ballots remain backward-compatible and still represent general community opinion;
2. one browser/session can independently set/withdraw community and worker-perspective signals for the same company;
3. product-market projection exposes product/company plus separate worker/general/evidence summaries and contains no owner/session/private fields;
4. "anger/support" ordering depends only on the documented worker-perspective lane and is not represented as factual evidence;
5. strongest evidence and concrete positive/negative labor claims remain separately inspectable;
6. UI has explicit language that labor/company signals do not establish product quality and that worker perspective is self-declared, not identity verification;
7. existing privacy/evidence/UI tests plus focused new tests pass;
8. Cloudflare Worker and local reference server expose equivalent new public API semantics;
9. independent/fork build mode fails if a remote API/proxy is supplied and succeeds same-origin;
10. `git diff --check` passes.

Production acceptance later requires its normal independent release/deployment gate; local candidate validation is not production acceptance.

## VALIDATION RESULT — 2026-09-17

Local candidate validation passed after one retained test-contract correction.

The first focused run produced `12/13 PASS`: all new model/API/product/worker-signal checks passed, while the existing UI contract still required the old literal label `社区声音`. The implementation had intentionally renamed that general-community panel to `社区总体印象` so it would no longer be confused with the newly added worker-perspective lane. The failed result was retained; the UI expectation was updated to require both `社区总体印象` and `劳动者视角与实际劳动主张`, then validation was rerun. The acceptance standard was not weakened.

Final decisive evidence:

- focused `model + api + ui`: `13/13 PASS`;
- full `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- public smoke contract: `9/9 PASS`;
- `sites-app` build: `PASS`, 17 files, version remains `0.8.8-rc.1`;
- independent same-origin frontend build: `PASS` with `independentInstance=true`;
- frontend privacy audit: `PASS`, 0 forbidden matches;
- independent mode + remote `LTP_PUBLIC_API_BASE`: expected failure confirmed with `Independent instance mode must use its own same-origin API; remote upstream API/proxy is forbidden`;
- local Wrangler Worker + D1 smoke: `PASS`; worker-perspective and normal community signals coexisted for the same company, `/api/product-market` returned the expected separate projection, and Worker restart persistence retained `workerPositive=1` plus public product records;
- `git diff --check`: `PASS`.

The D1 change is backward compatible by construction and runtime evidence: legacy/general community ballot keys remain `companyId:owner`; only the new worker-perspective lane uses `companyId:worker:owner`. No accepted production D1 data was migrated or modified in this round.

Strongest defensible claim at this **earlier first-milestone checkpoint**: signal-separated product consumer-choice UI/API, backward-compatible worker-perspective persistence, and one fail-closed fork-safety build guard were locally implemented and validated. At that checkpoint it did **not yet** establish a deployed production release, complete independent self-host package, signed federation transport, multi-instance governance, or global decentralized persistence. The later P0 and signed-federation sections below supersede only those specifically completed local milestones; production/global-network claims remain out of scope.

## ROLLBACK / ABORT CONDITION

Abort or roll back the behavioral candidate if any of the following occurs:

- worker and general-community sentiment are merged or overwrite one another;
- a sentiment ranking is presented as verified employer misconduct/goodness or product quality;
- an unverified claim is upgraded because it is popular or emotionally strong;
- the change requires sensitive identity/employment proof in the core product;
- a fork defaults to the upstream production API/data;
- current company research/evidence lanes, advisory privacy boundaries or v0.8.8 core flows regress;
- implementation requires an unbounded schema migration or production data rewrite to achieve the first milestone.

## APPROVAL

The user explicitly authorized the federated public-interest direction and requested the new product/labor-signal surface on 2026-09-17. No additional product-intent approval is required for the reversible local candidate described above. Production deployment remains a separate high-impact action.

## P0 INDEPENDENT-INSTANCE BOOTSTRAP RESULT — 2026-09-17

The next Phase O gate has now also been implemented and locally validated without touching reference production.

Implemented:

- `.ltp-instance/` is the default ignored local instance directory;
- `scripts/instance/bootstrap.mjs` atomically creates a new independent instance and refuses to overwrite an existing directory;
- each instance gets a stable random instance ID, public instance metadata, an Ed25519 public/private key pair, fresh session/review/export/advisory/community-Agent secrets and a local data directory;
- `secrets.json` is owner-only on POSIX and the launcher refuses loose permissions;
- `scripts/instance/start.mjs` validates the instance bundle, forbids remote upstream API/proxy configuration, confines the P0 launcher to localhost, and starts the existing same-origin Node/FileStore runtime;
- the standalone runtime projects safe public instance identity through `/api/config` and `/api/health`; private secrets and the private signing key are never included in those public responses;
- the public footer runtime status displays the instance name when one exists, reducing the risk that a Fork is mistaken for the reference instance;
- CI now runs the independent-instance bootstrap/runtime test in addition to the existing frontend independent-build guard.

Focused independent-instance validation:

- `scripts/instance/instance.test.mjs`: `2/2 PASS`;
- fresh bootstrap creates a stable instance ID and a corresponding Ed25519 key pair;
- bootstrap rerun against the same directory fails closed rather than rotating/overwriting secrets or state;
- independent runtime starts with mode `INDEPENDENT_LOCAL_INSTANCE` and `referenceProductionDependency=false`;
- public config contains no session/review/export/advisory/community-Agent secret or private signing key;
- company creation, ordinary community ballot, worker-perspective ballot, product contribution and `/api/product-market` work through the bootstrapped instance;
- runtime restart preserves instance identity, local product/company data and the distinct worker/community signal lanes;
- injected remote reference-production API configuration is rejected;
- loose secret permissions are rejected on POSIX;
- real CLI smoke (`bootstrap.mjs` -> `start.mjs --port 0` -> `/api/config`) passed and returned a fresh independent instance identity;
- `.ltp-instance/` ignore check passed.

Regression evidence after the bootstrap implementation:

- full `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- project continuity regression: `3/3 PASS`;
- public smoke contract: `9/9 PASS`;
- `git diff --check`: `PASS`.

Strongest defensible claim: **a fresh Fork can now bootstrap and run the existing core public application locally with its own stable identity, secrets and storage, without relying on the reference production runtime or data.** This is a P0 independence proof, not a production-grade self-host release. The bootstrap currently uses the local FileStore runtime and does not claim production Queue/Cron company research, TLS/reverse-proxy hardening, backup/monitoring, Docker packaging or public internet deployment.

The next Phase O gate is now the public-evidence-only signed snapshot/delta contract and implementation: export/import only material that is actually eligible for public redistribution, bind it to the stable instance identity key, and preserve correction/retraction/tombstone semantics without federating users or private data.

## SIGNED PUBLIC-EVIDENCE SNAPSHOT / DELTA RESULT — 2026-09-17

That next gate has now also been implemented and locally validated.

### Implemented transport

- `sites-app/src/federation.mjs` defines a canonical `LTP_PUBLIC_EVIDENCE_SNAPSHOT` v1 full-snapshot format with explicit delta metadata, deterministic canonical JSON, SHA-256 record/content/snapshot roots, and Ed25519 signatures bound to the existing instance key.
- Export reuses the existing `publicDataset()` redistribution eligibility instead of creating a second evidence/rights system. Eligible local records must already be public, `REVIEWED`/`VERIFIED`, independently export-approved for the current version, and free of open correction flags. Synthetic records are excluded.
- General-community ballots, worker-perspective ballots, owner/session state, private community feedback, anonymous advisory, contacts/IP/private attachments and imported federation records are excluded.
- Official/machine/provider lanes are also excluded from v1 until their source-specific redistribution terms are separately reviewed.
- `scripts/federation/export.mjs` produces a signed full authorized dataset plus `delta.upserts` / `delta.tombstones`, and persists private export-chain state inside the ignored instance directory.
- `scripts/federation/import.mjs` verifies schema/allowlist, content root, snapshot root, Ed25519 signature, source key continuity, source-version monotonicity and snapshot chain continuity before applying a local import.
- First explicit import is trust-on-first-import for the chosen file and pins the source key fingerprint. Same source ID with a later different key is rejected.
- Exact current-root replay is an idempotent no-op; stale, old, skipped and forked chains are rejected after a source is pinned.
- Imported evidence lives in separate `federatedEvidence` / `federationImports` collections and is not automatically re-exported, preventing uncontrolled forwarding loops.
- `/api/federation/evidence` exposes safe imported public evidence/provenance/tombstones without providing an HTTP mutation endpoint.
- Direct FileStore import requires explicit `--service-stopped`, inheriting the project's existing offline-write safety rule.

### Correction and removal semantics

A missing record from a later valid `FULL_AUTHORIZED_PUBLIC_DATASET` snapshot becomes a tombstone. This can represent withdrawal, editing while re-review is pending, an open correction, lost redistribution approval or another removal from the currently authorized set.

The receiver preserves identity/version/hash/root/history proof but removes the old record body from the public federated projection. A later corrected/reapproved version may restore the logical record with a higher source version and a `RESTORE` event. Thus the network preserves auditable history without interpreting “permanent record” as “withdrawn text must stay permanently public.”

### Retained failure evidence

The first federation integration run failed after an apparently successful offline import: the running B instance still had `0` visible imported records because its FileStore runtime retained an in-memory state while a separate importer had written disk. Treating that as success would have created a real concurrent-write/stale-state risk.

The fix did not weaken the test or add a raw hot-write path. Import now fails closed unless `--service-stopped` is explicitly supplied; the integration test stops B, imports, restarts B, and then verifies the public projection. The same safety model already existed for offline advisory FileStore maintenance.

A later review also tightened tombstones: tombstoned records no longer keep publishing the old record body. Only hash/version/chain/history proof remains public until a newer authorized version restores content.

### Validation

- two-instance signed federation integration: `PASS`;
- federation test suite including real export/import CLI and stopped-service gate: `2/2 PASS`;
- tampered content/root/signature rejected;
- same instance ID with a different key rejected;
- current-root replay idempotent;
- stale/old snapshot and skipped-chain snapshot rejected;
- withdrawal/edit causes tombstone; corrected/reapproved v2 restores the record with `UPSERT -> TOMBSTONE -> RESTORE` history;
- federation payload privacy assertions confirmed no private feedback/advisory markers, ballots, owner/session or secret fields;
- full `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- project continuity regression: `3/3 PASS`;
- public smoke contract: `9/9 PASS`;
- local Wrangler Worker + D1 smoke: `PASS` with existing company/research/community/privacy/restart contracts intact;
- `sites-app` build: `PASS` (18 files after the federation module was added);
- independent frontend privacy audit: `PASS`, 0 forbidden matches;
- `git diff --check`: `PASS`.

Strongest defensible claim: **two independently bootstrapped local instances can now exchange signed, redistribution-approved public contribution evidence with source-key pinning, chain verification, idempotency and correction/retraction/tombstone history, without federating user/private data.** This is still a local protocol/runtime milestone, not an operating global network, public mirror service, automatic peer fetch/discovery system or reference-production release.

The next highest-value durability gate is `PUBLIC_SNAPSHOT_MULTI_MIRROR_PUBLICATION`: package/publish these already-signed public snapshots under content-addressed names/manifests so a snapshot can survive loss of one Git repository/site and can be independently verified from multiple mirrors. Complex cross-instance sentiment aggregation remains later because anti-Sybil semantics are not yet established.

## CONTENT-ADDRESSED MULTI-MIRROR RESULT — 2026-09-17

That durability gate has now also been implemented and locally validated without connecting any external hosting account.

### Implemented mirror contract

- `sites-app/src/snapshot-mirror.mjs` defines deterministic publication manifests, content-addressed package paths, mirror-index validation and multi-mirror resolution.
- A package keeps the **exact source-signed snapshot bytes**. Mirrors never re-sign or rewrite the evidence artifact.
- Content address path is `public-evidence/sources/<sha256(instanceId) prefix>/<snapshotRoot>/` containing `manifest.json` and `<snapshotRoot>.snapshot.json`.
- Derived `manifest.json` binds source instance/key fingerprint, snapshot/content/previous roots, generated time, record count, exact content-addressed filename and exact source snapshot-file SHA-256.
- Mirror `public-evidence/index.json` is deterministic but deliberately unsigned/untrusted; it is only a discovery hint. Every verification resolves the package then rechecks path, exact byte hash and the original source snapshot signature.
- `scripts/federation/package.mjs` creates/idempotently verifies a content-addressed package and refuses an existing conflicting package.
- `scripts/federation/publish-mirrors.mjs` copies the exact package into 1—32 independent mirror roots, updates their deterministic index, and never silently overwrites a corrupt/conflicting content address.
- `scripts/federation/verify-mirror.mjs` independently verifies a requested snapshot at one mirror.
- `scripts/federation/resolve-mirrors.mjs` can query multiple mirrors, ignore missing/corrupt copies, require all valid copies to agree on source instance + exact snapshot-file hash, and recover exact bytes from a remaining valid mirror.
- Mirror indexes fail rather than silently pruning history at the configured safety bound.
- No mirror adds user/private data or mirror-side secret material beyond the already signed public snapshot and derived public metadata.

### Destructive durability validation

The test published one source snapshot to three independent mirror directories. Then:

1. mirror A was fully deleted;
2. mirror B's snapshot bytes were corrupted;
3. resolver was given A + B + C and successfully recovered byte-identical original source-signed snapshot bytes from C;
4. publisher was asked to reuse corrupt B and correctly refused to overwrite the damaged existing content address;
5. mirror C's manifest was then tampered;
6. with A missing, B corrupted and C manifest-corrupt, resolver failed completely instead of accepting any degraded artifact.

The same mirror index generated from the same publication set was deterministic across mirrors, and package/index privacy checks found none of the source instance session/review/export/advisory/community-Agent tokens or signing private key.

Real CLI paths also passed end to end: federation export -> package -> two-mirror publish -> single-mirror verify -> delete one mirror -> multi-mirror resolve/recovery.

### Regression evidence

- mirror package/publication/destruction/recovery suite: `2/2 PASS`;
- federation signed exchange: `2/2 PASS`;
- independent instance bootstrap: `2/2 PASS`;
- full `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- project continuity: `3/3 PASS`;
- public smoke contract: `9/9 PASS`;
- sites build: `PASS`, 19 files;
- independent frontend privacy audit: `PASS`, 0 forbidden matches;
- `git diff --check`: `PASS`.

Strongest defensible claim: **an already source-signed public-evidence snapshot can now be packaged under a content address, copied byte-for-byte into multiple independent mirror roots, independently reverified at each mirror, and recovered when other mirrors disappear or are corrupted.** This proves a mirror/storage contract, not actual Internet durability: no external Git mirror repository, object-storage bucket or IPFS node was created or modified, and there is still no automatic instance discovery/pull scheduler.

The next Phase O gate at this checkpoint was `MINIMAL_INSTANCE_DISCOVERY_AND_PULL`: publish a small public instance descriptor pointing to its signed snapshot mirror locations, let an operator explicitly trust/add peer descriptors, fetch/verify their mirror indexes/snapshots without central registry dependence, and keep actual evidence trust anchored in the source instance signature rather than DNS/URL popularity. Cross-instance sentiment aggregation remains later until anti-Sybil semantics exist.

## MINIMAL SIGNED PEER DISCOVERY / PULL RESULT — 2026-09-17

That gate has now also been implemented and locally validated.

### Implemented peer contract

- `sites-app/src/peer-discovery.mjs` defines `LTP_PUBLIC_INSTANCE_DESCRIPTOR` v1, explicit peer trust-store semantics and bounded HTTP(S) transport helpers.
- A peer descriptor is signed by the source instance's existing Ed25519 key and binds source instance identity/public key, descriptor timestamp, latest source-signed snapshot metadata and 1—16 `public-evidence` mirror base URLs.
- The descriptor does not carry runtime/session/review/export/advisory/community-Agent secrets or the signing private key.
- `scripts/federation/descriptor.mjs` generates a descriptor only from a verified latest package whose source identity/key matches the instance.
- `scripts/federation/trust-peer.mjs` requires explicit `--trust`; there is no automatic enrollment or central registry. First trust pins the peer key in owner-private `.ltp-instance/peers.json`.
- Later same-instance descriptors must use the same key; descriptor timestamp rollback and same-time content conflict fail closed.
- `scripts/federation/pull-peer.mjs` requires `--service-stopped`, may explicitly refresh the saved descriptor, treats mirror indexes as untrusted hints, fetches source-signed packages, and walks `previousRoot` backwards until the receiver's exact current accepted root is reached before importing missing snapshots in forward order.
- A receiver at v1 can therefore catch up directly from a descriptor pointing at v3 by verifying/importing v2 then v3, as long as declared mirrors still contain the chain.
- Pull reuses the existing federation importer, so source-key pinning, version monotonicity, idempotency, tombstone semantics and no-reexport rules remain unchanged.

### Network boundary

- HTTPS is required for non-loopback transport; loopback HTTP exists only for local tests.
- URL credentials, query strings and fragments are rejected.
- Mirror URLs must directly address a `public-evidence` root.
- Any non-loopback fetch requires explicit `--allow-network`.
- Redirects are rejected.
- Descriptor/index/manifest/snapshot body sizes and timeouts are bounded.
- There is still no remote mutation endpoint and no automatic periodic peer crawler.

### Retained implementation failures

The first peer test failed before protocol execution because the test imported `publicKeyFingerprint` from the wrong module. That narrow module-load failure was retained and fixed by importing the function from `federation.mjs`, its actual owner.

The next run exposed two separate implementation/test issues:

1. remote descriptor fetch returned an enriched verification view with an extra computed `keyFingerprint`, then the strict raw-descriptor parser correctly rejected that undefined field on the next validation pass;
2. the real CLI test used synchronous child processes while the loopback descriptor/mirror servers lived in the same Node test process, blocking the event loop and producing a false timeout.

The fixes preserved the strict contract: descriptor fetch now verifies the received JSON but persists/passes the original signed object, and the CLI test uses asynchronous child processes so the local HTTP server remains responsive. No acceptance boundary was loosened.

### Validation

- peer descriptor/trust/pull suite: `2/2 PASS`;
- explicit trust required;
- peer key pinning, descriptor rollback rejection and same-ID different-key rejection passed;
- descriptor tampering invalidated root/signature;
- receiver caught up v1 -> v2 -> v3 even with one mirror's v2 package corrupted;
- current-root pull became idempotent `UP_TO_DATE`;
- FileStore pull without `--service-stopped` was rejected;
- non-loopback HTTPS fetch without `--allow-network` was rejected before network access;
- non-loopback plaintext HTTP mirror URLs were rejected;
- public descriptor contained none of the source instance private tokens/private signing key;
- local peer trust store is owner-private on POSIX;
- real descriptor -> trust -> pull CLI flow passed without a central registry;
- mirror suite: `2/2 PASS`;
- federation suite: `2/2 PASS`;
- independent-instance suite: `2/2 PASS`;
- full `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- continuity: `3/3 PASS`;
- public smoke: `9/9 PASS`;
- sites build: `PASS`, 20 files;
- independent frontend privacy audit: `PASS`, 0 forbidden matches;
- `git diff --check`: `PASS`.

Strongest defensible claim: **an operator can now explicitly trust a source-signed peer descriptor and pull/catch up that peer's signed public-evidence chain from one or more declared mirrors without a central registry; mirror/URL count does not change evidence strength, and peer trust remains anchored in the pinned source key and signed snapshots.** This is still operator-mediated local validation, not autonomous Internet peer discovery or a live global network.

At that checkpoint the next Phase O gate was `SELF_HOST_RELEASE_PACKAGE`: package the already-independent same-origin runtime into a community-deployable release path with durable local instance volume, repeatable startup/upgrade/backup checks and a reverse-proxy/TLS boundary, without reintroducing reference-production dependency.

## SELF-HOST RELEASE PACKAGE RESULT — 2026-09-17

That gate has now also been implemented and locally validated.

### Implemented release/runtime contract

- `scripts/instance/self-host-server.mjs` bootstraps a missing independent instance, reuses the existing FileStore/domain model, supports an explicit self-host secure-cookie policy and exact Host allowlist, and refuses non-loopback binding unless invoked through the dedicated self-host container mode.
- `sites-app/src/server.mjs` gained an optional runtime Host allowlist. The accepted reference/local runtime leaves it disabled unless explicitly configured; the self-host layer enables it.
- `scripts/instance/healthcheck.mjs` verifies `/api/health` + `/api/config`, independent-instance identity, privacy capabilities and security headers without printing secrets.
- `scripts/instance/preflight.mjs` verifies instance/secrets permissions, Ed25519 public/private key correspondence, state schema, peer trust-store validity, federation export metadata and optionally a specific backup.
- `scripts/instance/backup.mjs` + `backup-lib.mjs` create an offline private backup with exact hashes/sizes/modes for `instance.json`, `secrets.json`, `data/state.json`, optional `peers.json` and optional `federation/export-state.json`. Existing output is never overwritten.
- `scripts/instance/restore.mjs` verifies every backup file then restores only into a missing/empty directory; non-empty target overwrite is rejected.
- `scripts/instance/build-self-host-release.mjs` creates a code-only self-host release with `SELF_HOST_RELEASE.json` file hashes/root. Generated `secrets.json`, state, peer store and `.ltp-instance` data are excluded.
- `deploy/self-host/Dockerfile`, `compose.yml`, `.env.example`, `Caddyfile` and `README.md` define the container/reverse-proxy path: app has only internal `8787`, persistent instance state is a volume, and Caddy is the host ingress/TLS boundary.
- CI now runs the self-host lifecycle test and validates the Docker Compose configuration.

### Upgrade / backup / restore evidence

The local self-host lifecycle test passed `1/1` and proved:

- first start creates an independent instance without any reference-production API/database/secret;
- exact Host allowlisting rejects an unexpected Host and normal same-origin requests remain usable;
- company/product/worker-signal state persists;
- stopped-service backup captures current instance ID, runtime secrets, state, peer trust and federation export metadata;
- corrupt backup content is rejected by hash/size validation;
- restore to a non-empty directory is rejected;
- restore to a clean directory preserves the exact instance ID, session/signing secrets, company/product state, peer trust and federation metadata;
- two separately built code-only releases (`rev-a` then `rev-b`) can replace one another while pointing at the same external instance directory; the identity and data do not rotate/disappear;
- generated instance secret values are not present in either release bundle.

### Real Caddy proxy failure and fix

The first real Caddy reverse-proxy test caught a security/compatibility regression: the supplied proxy config explicitly used `header_up Host {host}`. Caddy's `{host}` placeholder stripped the public port, while the browser Origin still contained `host:port`; the backend's strict Origin-vs-Host comparison therefore correctly rejected a legitimate CSRF mutation.

The fix did **not** weaken Origin/CSRF checking. The unnecessary Host rewrite was removed so Caddy preserves the original incoming Host header by default. The second real Caddy test then passed:

- same-origin CSRF mutation through Caddy;
- wrong Origin rejection;
- wrong Host `403`;
- `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` after the proxy.

Caddy 2.11.4 also validated the supplied production-domain configuration and confirmed automatic HTTPS plus HTTP->HTTPS redirects for a real hostname configuration.

### Docker validation boundary

Docker Desktop itself was started successfully (`29.2.1`, Linux/aarch64 backend), and `docker compose config` passes. A real image build was attempted, but no project build stage was reached because this machine's Docker Hub path timed out while fetching the anonymous registry token/base image metadata for `node:22-alpine`. A bounded retry downloaded several layers but then stalled in the registry transport path; the pull was terminated rather than allowed to hang indefinitely. Neither `node:22-alpine` nor `caddy:2-alpine` became a complete cached image.

Therefore the strongest container claim is intentionally limited: **the Dockerfile/Compose/Caddy release configuration is locally parsed/validated, but this machine has not completed an actual image build/run because the external Docker Hub base-image pull path is currently unavailable.** This is not called a Dockerfile PASS or a container E2E PASS.

### Combined regression evidence

- self-host lifecycle/backup/restore/release replacement: `1/1 PASS`;
- peer/mirror/federation/independent-instance aggregate: `8/8 PASS`;
- full `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- continuity + public smoke: `12/12 PASS`;
- sites build: `PASS`, 20 files;
- independent frontend privacy audit: `PASS`, 0 forbidden matches;
- `docker compose config`: `PASS`;
- Caddy production-domain config: `PASS`;
- real local Caddy proxy Host/Origin/CSRF/security flow: `PASS` after the retained/fixed Host rewrite failure;
- `git diff --check`: `PASS`.

Strongest defensible claim: **the project now has a locally validated community self-host release contract independent of reference production: code-only release bundles, persistent external instance identity/secrets/data, exact Host/Origin/CSRF boundaries, health/preflight, stopped-service backup/restore and release replacement all work.** Docker/Compose remains a configured packaging option whose real image build is still externally blocked by Docker Hub connectivity on this machine.

At this checkpoint the next Phase O gate was `PUBLIC_PROJECT_GOVERNANCE_AND_RELEASE_READINESS`: consolidate the already-existing non-commercial source-available license/data-license/contribution rules into clear public governance, privacy/security, branding/trademark and operator-responsibility documents; make the GitHub landing page explain the reference-instance/independent-instance/federation model and verified capabilities; then prepare a clean release candidate without calling the local candidate reference production until its separate release/deploy acceptance gate passes.

## PUBLIC PROJECT GOVERNANCE / RELEASE READINESS RESULT — 2026-09-17

That governance gate has now also been implemented and locally validated.

### Public governance surfaces

The existing `LICENSE`, `LICENSE-DATA.md` and contribution/evidence rules remain authoritative; they were not replaced with a second licensing/governance system. The missing public-facing operating surfaces were added as substantive top-level documents:

- `MISSION.md` — public-interest purpose and explicit non-goals;
- `OPERATING_MODEL.md` — Upstream / Reference Instance / Independent Instance / Public Evidence Network responsibility model;
- `NON_COMMERCIAL_POLICY.md` — plain-language interpretation of the existing non-commercial source-available license without modifying it;
- `GOVERNANCE.md` — decision authority/order, role boundaries, change acceptance and correction governance;
- `PRIVACY.md` — PUBLIC / LOCAL PSEUDONYMOUS / LOCAL PRIVATE boundaries and GitHub/federation privacy rules;
- `SECURITY.md` — fail-closed security policy, public-reporting boundary and self-host/federation threat model;
- `INSTANCE_OPERATORS.md` — downstream instance responsibility and explicit no-private-data-federation rule;
- `TRADEMARK.md` / `BRANDING.md` — truthful attribution allowed; unofficial forks may not imply official regional/reference status; no claim that project marks are registered;
- `AUTHORS.md` — durable public attribution to the current upstream GitHub account plus AI-managed contribution model, without inventing a legal entity or requiring contributor real names;
- `CODE_OF_CONDUCT.md`, `NOTICE`, `RELEASE_POLICY.md`.

`CONTRIBUTING.md` was updated to remove historical “local synthetic environment” wording, align review/export semantics with the current system, and route federation/branding contributions through the current privacy/evidence rules. Its `public-site/` copy is now synchronized with the root document, as are the existing LICENSE/data-license public copies.

### GitHub landing / collaboration model

`README.md` now puts the actual current state first:

- Reference production remains accepted `v0.8.8-rc.1`;
- Phase O is clearly labeled a locally validated candidate, not deployed Reference Instance production;
- Docker/Compose is described as config-validated while the real image build remains blocked by the retained Docker Hub pull-path failure;
- Upstream / Reference / Independent / Public Evidence Network are explained before historical engineering detail;
- Worker Perspective / General Community / Concrete Labour Claim evidence remain explicit separate lanes;
- independent bootstrap/self-host/federation entry paths and governance links are discoverable from the landing page;
- the mandatory `AGENTS.md -> PROJECT_CONTINUITY.md` cold-start route remains explicit.

GitHub collaboration entrypoints now include privacy/evidence-aware bug and feature templates plus a PR template. Public reports explicitly forbid secrets, real worker/case identity data and the use of emotion/popularity as factual evidence.

### Retained governance failures

The first governance-readiness run returned `3/4 PASS`: `INSTANCE_OPERATORS.md` had the intended private-data boundary but did not literally state that private/user data “不自动联邦”, which the machine check required. The document was made explicit; the check was not weakened.

A later combined regression caught that the README restructuring had removed the exact cold-start sentence required by the continuity contract. The sentence was restored; the continuity test was not changed.

The same final pass also found `public-site/CONTRIBUTING.md` still contained the historical local-synthetic-environment sentence after the root document had been corrected. The public copy was synchronized and the release-readiness check now asserts byte equality for `LICENSE`, `LICENSE-DATA.md` and `CONTRIBUTING.md` public-site policy mirrors.

### Machine readiness gate

Added:

- `scripts/public_project_governance.test.mjs`;
- `scripts/public_release_readiness.mjs`;
- CI execution of both checks;
- checks for 18 required public governance/license/state files, 4 GitHub governance templates, 3 synchronized public-site policy mirrors, forbidden tracked runtime/private files, accepted-production/local-candidate separation, Docker Hub gap preservation, privacy/security/brand/attribution/operator boundaries and GitHub sensitive-data gates.

Current machine result:

`PUBLIC_GOVERNANCE_READY_SOURCE_CANDIDATE`

with:

- `acceptedProduction = v0.8.8-rc.1`;
- `phaseOCandidateProductionAccepted = false`;
- no missing/placeholder governance files;
- no forbidden tracked runtime/private instance files;
- `dockerContainerE2E = BLOCKED_BY_EXTERNAL_DOCKER_HUB_PULL_PATH` retained as a gap rather than rewritten as PASS.

All GitHub YAML files were also parsed successfully with Ruby YAML on this machine. The absence of PyYAML during one optional check was not treated as project failure.

Strongest defensible governance claim: **the repository now has a machine-checked, public GitHub-facing governance/operating package that lets an external contributor/operator understand the non-commercial license, reference-vs-independent responsibility model, privacy/security boundaries, branding/official-identity limits, contribution paths and release status without relying on private project history.** This does not make the Phase O candidate production accepted or create a legal entity.

At this checkpoint the next gate was `CLEAN_SOURCE_RELEASE_CANDIDATE`: stage only the intended Phase O + governance/release files, explicitly exclude runtime/private artifacts and `history/subagents/`, generate an auditable source release note/manifest, push the source revision with “production not deployed” status, observe GitHub CI/public smoke, and only then consider a separate Reference Instance production release gate.

## CLEAN SOURCE CANDIDATE PUBLICATION RESULT — 2026-09-17

The Phase O source candidate has now been published to canonical GitHub `main` without deploying the Reference Instance runtime.

### Source revision

- base before candidate commit: `0035b2e8a35f09a6014b14622e730847232235e7`;
- published source commit: `ec453528b3e4cb89bb6f6c0d06db211092b878f4` (`feat: publish Phase O public-interest source candidate`);
- canonical remote: `HiddenFeng/labor-transparency-ai`, branch `main`;
- 77 precisely staged source/governance/release-evidence paths;
- `history/subagents/`, `.ltp-instance`, backups, generated Secret/state files and unrelated collaboration logs were excluded;
- source release note: `docs/v0_8/SOURCE-RELEASE-CANDIDATE-phase-o-2026-09-17.md`;
- machine manifest: `qa/v0_8/source-release-candidate-phase-o-2026-09-17.json`;
- source package/runtime version deliberately remained `0.8.8-rc.1` for this source-only commit; the manifest explicitly records `phaseOCandidateProductionAccepted=false` and no production action in this gate.

### Staged / local verification

Before commit/push:

- staged path list matched the machine manifest exactly;
- forbidden staged runtime/private paths: zero;
- real-secret signature scan: zero matches;
- Phase O/self-host/governance/public-smoke Node aggregate: `25/25 PASS`;
- `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- project `.venv` Python tests completed successfully. A first monolithic run was terminated by the local 180s command timeout with all executed tests still passing; the unfinished modules were then rerun explicitly: `test_platform 64/64`, `test_publication 17/17`, `test_research 67/67`, `test_resilience 3/3`, `test_runtime_backup 9/9`, `test_scheduler_cli 3/3`, `test_security 14/14`, all `PASS`;
- build / independent frontend / privacy / Compose / GitHub YAML / cached diff checks: `PASS`.

The system Python lacked FastAPI/httpx/cryptography, so it was not misreported as a project test failure; the project `.venv` had the required CI-equivalent dependencies and was used for the complete Python verification.

### GitHub push evidence for `ec45352...`

All push-triggered GitHub workflows for the candidate SHA completed successfully:

- `Validate release candidate (no deployment)` run `35181683052`: `success`;
- `Public non-Tencent deployment smoke` run `35181683073`: `success`;
- `Deploy public-interest site to GitHub Pages` run `35181683098`: `success`.

The CI run included successful `web_candidate` and `cloudflare_backend` jobs; Python 3.9 and 3.13 verification matrices also completed under the release-candidate workflow. The Pages run updated the read-only/public documentation surface because `public-site/CONTRIBUTING.md` changed.

The public smoke success means the **currently deployed Reference Instance** still satisfies its public semantic/security contract after the source push. It does **not** mean the Phase O code from `ec45352...` was deployed to Vercel/Cloudflare production.

No production Cloudflare/Vercel deploy was run, no manual production auto-research E2E was dispatched, and no production data/QA mutation was made by this source-candidate gate.

### Next production boundary

The accepted Reference Instance production remains `v0.8.8-rc.1`.

Because Phase O materially changes product behavior and architecture, a future Reference Instance promotion must first create a **new source/runtime version identity**; deploying the new code while continuing to call it the same accepted `0.8.8-rc.1` would make release/smoke evidence ambiguous. The next gate is therefore `REFERENCE_PRODUCTION_RELEASE_PREP`, followed only after a versioned candidate passes by the separate deploy -> production smoke -> manual post-deploy E2E -> exact cleanup -> acceptance gate.

## REFERENCE PRODUCTION RELEASE PREP RESULT — v0.9.0-rc.1

Status: `VERSIONED_SOURCE_CANDIDATE_PUBLISHED_CI_PASS / PRODUCTION_NOT_DEPLOYED`

### CURRENT

- accepted Reference production remains `v0.8.8-rc.1`;
- the versioned candidate is published at canonical `main@35dff048c1c89df4312335b62f9fedc95d5a527f`;
- current production `/api/config` still reports `0.8.8-rc.1 / CLOUDFLARE_WORKER_D1` with no browser page/network/console error;
- trusted production state now has 2 real companies (`富士康`, `星宇股份有限公司`) and no pending feedback/correction/appeal/source request;
- the new real `富士康` company completed Queue research in about four seconds and reached `AUTO_READY / CANDIDATES_ONLY` with 2 applicable source successes, 0 source errors and 9 `NOT_APPLICABLE` sources; `exactNameCandidateCount=0` and legal identity stayed `NO_VERIFIED_REFERENCE`;
- the current 18:00/19:00 LocalAgentRuntime tasks remain enabled, unblocked and `WAITING_NEXT_RUN`.

### PROPOSED

Assign Phase O the distinct source/runtime candidate identity **`v0.9.0-rc.1`** and prepare it for Reference Production promotion without changing current production acceptance. Package/runtime constants, local version assertions, release documentation and machine governance now distinguish:

`source/runtime candidate = v0.9.0-rc.1`

from:

`accepted Reference production = v0.8.8-rc.1`.

The separate release record is `docs/v0_8/RELEASE-CANDIDATE-v0.9.0-rc.1.md`.

### PRESERVE

- the historical v0.8.8 acceptance evidence remains unchanged;
- candidate/abbreviation/context similarity cannot upgrade company identity;
- `0 match` does not mean absence and unsupported jurisdictions remain `NOT_APPLICABLE`;
- community, worker perspective, concrete labour evidence, official lanes, machine references and source signals remain separate;
- Queue remains the new-company main path; Cron remains recovery/refresh;
- production E2E remains post-deploy manual-only and version-aware;
- QA cleanup, privacy, anonymous-advisory, federation and no-Tencent-gate boundaries remain unchanged.

### VALIDATION

The first combined governance run after the version assignment produced **`14/16 PASS`**. Two failures were retained:

1. `project_continuity.test.mjs` assumed the checked-out package version must equal the accepted production runtime;
2. `public_release_readiness.mjs` likewise treated package/source version as `acceptedProduction` and required the public docs to call it the current production baseline.

Those assumptions were valid only while candidate and accepted production happened to share a version. They contradict the existing release policy once a versioned undeployed candidate exists. The fix did not weaken acceptance: the machine contract was strengthened to require both an explicit source/runtime candidate and a separately recoverable accepted production version. The affected continuity/public-governance rerun then passed **`7/7`**, with readiness reporting:

- `version=v0.9.0-rc.1`;
- `acceptedProduction=v0.8.8-rc.1`;
- `phaseOCandidateProductionAccepted=false`;
- `nextGate=VERSIONED_SOURCE_CANDIDATE_PUBLICATION_AND_CI_BEFORE_REFERENCE_PRODUCTION_RELEASE_GATE`.

Other decisive checks:

- `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- `sites-app` build: `PASS`, 20 files, manifest `0.9.0-rc.1`;
- local Worker+D1 HTTP/restart smoke: `PASS` with backend/worker `0.9.0-rc.1`, Queue/autonomous research, official/community/advisory/privacy contracts and restart persistence;
- public smoke contract: `9/9 PASS`, including manual-only/version-aware production E2E semantics;
- normal frontend release-prep build: `PASS`, privacy audit `forbiddenMatches=0`;
- independent same-origin build: `PASS`, privacy audit `forbiddenMatches=0`;
- independent mode + remote upstream API: expected fail-closed rejection `PASS`;
- `git diff --check`: `PASS`.

Versioned source publication evidence:

- canonical push: `a8eca854f28fbd23deab8ce3b35be2470ec1fdcc -> 35dff048c1c89df4312335b62f9fedc95d5a527f` on `main`;
- `Validate release candidate (no deployment)` run `35185637735`: `success`;
- `Public non-Tencent deployment smoke` run `35185637750`: `success`;
- the manual-only production auto-research E2E was not source-push triggered, preserving the v0.8.8 race fix;
- accepted production remained `v0.8.8-rc.1`; no production deploy or data mutation occurred in the source-publication gate.

### ROLLBACK / ABORT CONDITION

- do not deploy if the versioned source candidate has not first been published and passed its decisive CI;
- if source publication CI fails, retain the failure and stop before Reference production deployment;
- if production preflight exposes a higher-priority feedback/privacy/security/core-path incident, pause release promotion and resolve that incident first;
- if candidate and accepted-production identities are again collapsed, treat release evidence as invalid until corrected;
- any evidence-lane, privacy, Queue, manual-E2E or exact-cleanup regression aborts promotion.

### NEXT GATE

`REFERENCE_PRODUCTION_RELEASE_GATE`.

This local release-prep milestone does not authorize or claim production deployment. After a versioned source publication passes CI, Reference production still requires the separate `REFERENCE_PRODUCTION_RELEASE_GATE`: deploy -> production smoke -> manual post-deploy auto-research E2E -> exact QA cleanup/residual=0 -> production acceptance.

### REQUEST WORK RECORD — dcnew_21a79410c864480ea219

- Goal/scope: cold-start takeover from current repository/runtime evidence, verify higher-priority production/community/daily-operation signals, then advance the existing Phase O `REFERENCE_PRODUCTION_RELEASE_PREP` gate without publishing or deploying production.
- Authoritative/current material inspected: `AGENTS.md`, `PROJECT_CONTINUITY.md`, latest v0.8.8 accepted QA section, this active change, release policy, current Git/runtime packages, canonical production config/company dossier, trusted community state/feedback queue, and current LocalAgentRuntime fixed-run projection.
- Runtime finding: accepted production remains `v0.8.8-rc.1`; current production has 2 real companies; `富士康` is real user data, not QA residue, and its Queue research completed with fail-closed identity semantics; feedback queue is empty and 18:00/19:00 tasks are unblocked.
- Implementation/result: assigned `v0.9.0-rc.1` to the Phase O source/runtime candidate, synchronized runtime assertions and local smoke contracts, fixed machine governance so source candidate and accepted production are modeled independently, and added the dedicated release record `docs/v0_8/RELEASE-CANDIDATE-v0.9.0-rc.1.md`.
- Evidence/result locations: this change record, `PROJECT_CONTINUITY.md`, `RELEASE_POLICY.md`, `README.md`, `qa/v0_8/verification.json -> candidate_v090_phase_o_reference_release_prep`, and the v0.9 release record above.
- Checks: `sites-app 31/31`, backend `24/24`, local Worker+D1 smoke PASS, public smoke contract `9/9`, final governance/public-smoke aggregate `16/16`, release readiness PASS, normal/independent frontend privacy audits 0 forbidden matches, remote-upstream independent-mode rejection PASS, QA JSON parse PASS, `git diff --check` PASS.
- Retained failure: the first post-version governance aggregate was `14/16`; both failures were retained and resolved by separating candidate and accepted-production state rather than changing production acceptance.
- Current conclusion: `REFERENCE_PRODUCTION_RELEASE_PREP_LOCAL_PASS`; no production deployment or production data mutation was performed by this release-prep work.
- Unresolved/next: `VERSIONED_SOURCE_CANDIDATE_PUBLICATION_AND_CI`; source publication is a separate external action, and Reference production deployment remains a later independent release gate.

### REQUEST WORK RECORD — dcnew_12e035d42e28429c9c90

- Goal/scope: cold-start takeover from current repository/runtime evidence, preserve the accepted v0.8.8 Reference Instance, and advance the already-authorized Phase O `VERSIONED_SOURCE_CANDIDATE_PUBLICATION_AND_CI` gate without crossing into production deployment.
- Current truth verified before mutation: `main@35dff048c1c89df4312335b62f9fedc95d5a527f` was one intended release-prep commit ahead of `origin/main`; package/runtime candidate was `0.9.0-rc.1`; canonical `/api/config` still returned accepted production `0.8.8-rc.1 / CLOUDFLARE_WORKER_D1` with the existing privacy/capability boundary; trusted state had 2 real companies and an empty feedback queue; 18:00/19:00 fixed tasks were enabled and unblocked.
- Pre-publication decisive checks: continuity `3/3`, public governance `4/4`, release-readiness PASS with candidate/accepted-production split, `sites-app 31/31` + 20-file `0.9.0-rc.1` build, backend `24/24`, QA JSON parse PASS and `git diff --check` PASS.
- Publication/result: pushed `35dff048c1c89df4312335b62f9fedc95d5a527f` to canonical `origin/main`; source CI run `35185637735` completed `success`; public smoke run `35185637750` completed `success`. The source push did not trigger the manual-only production E2E and did not deploy the Reference Instance.
- Observation boundary retained: a direct browser navigation to `/api/research/health` timed out on the local path and was not promoted to a production outage; independent canonical `/api/config`, trusted community state, GitHub-hosted public smoke and CI supplied the decisive cross-checks.
- Result/evidence locations: this change record, `PROJECT_CONTINUITY.md`, `README.md`, `RELEASE_POLICY.md`, `docs/v0_8/RELEASE-CANDIDATE-v0.9.0-rc.1.md`, and `qa/v0_8/verification.json -> candidate_v090_phase_o_reference_release_prep`.
- Current conclusion: `VERSIONED_SOURCE_CANDIDATE_PUBLISHED_CI_PASS / PRODUCTION_NOT_DEPLOYED`; accepted Reference production remains `v0.8.8-rc.1`.
- Unresolved/next: `REFERENCE_PRODUCTION_RELEASE_GATE` only. Production deployment remains a separate high-impact action: deploy -> production smoke -> manual post-deploy auto-research E2E -> exact QA cleanup/residual=0 -> production acceptance.
