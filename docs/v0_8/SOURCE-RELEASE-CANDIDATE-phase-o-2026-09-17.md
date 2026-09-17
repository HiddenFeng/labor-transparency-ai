# Source Release Candidate — Phase O public-interest federation transition

Date: 2026-09-17
Candidate ID: `phase-o-source-candidate-2026-09-17`
Base Git HEAD before candidate commit: `0035b2e8a35f09a6014b14622e730847232235e7`
Package/runtime version in source tree: `0.8.8-rc.1`
Reference Instance accepted production: `v0.8.8-rc.1`
Status: `SOURCE_CANDIDATE_PRODUCTION_NOT_DEPLOYED`

## What this candidate is

This is a **source revision candidate** for the Phase O architecture/product/governance work. It is intended to publish the validated code and public operating model to the canonical GitHub repository so other public-interest communities can inspect, fork, run and improve it.

It is **not** a claim that the Worker Manifest Fellowship Reference Instance already runs these Phase O features. A later Reference Instance upgrade remains a separate release -> deploy -> post-deploy smoke/E2E/cleanup/acceptance gate.

## Included product behavior

- shopping-style `产品与劳工信号` surface;
- independent `WORKER_PERSPECTIVE_SIGNAL`, `GENERAL_COMMUNITY_SIGNAL`, and concrete `labour_claim` evidence lanes;
- local “劳工愤怒榜 / 劳工支持榜 / 证据较强的劳动实践 / 社区关注” views with explicit non-factual/non-product-quality boundaries;
- backward-compatible D1 ballot keys; legacy community votes are not migrated/overwritten;
- public `/api/product-market` and separated company dossier projections.

## Included independent-instance / federation behavior

- fail-closed same-origin independent frontend mode;
- independent instance bootstrap with stable instance ID, Ed25519 key, private Secrets and local state;
- signed redistribution-approved public-evidence full snapshots + explicit delta;
- key pinning, hash/signature/chain verification, idempotency, correction/retraction/tombstone and no automatic re-export of imported evidence;
- content-addressed byte-identical mirror packaging, verification and recovery;
- signed peer descriptor, explicit operator trust and bounded peer pull/catch-up without a central registry;
- no federation of user/session identity, community/worker ballot identity linkage, private feedback/advisory, contacts/IP/private attachments or unreviewed provider/official lanes.

## Included self-host behavior

- code-only self-host release bundle; generated instance identity/Secrets/state stay outside the release;
- optional exact Host allowlist, same-origin Origin/CSRF and security headers preserved;
- health/preflight checks;
- stopped-service backup/restore with hash/size/mode manifest;
- persistent instance identity/data across code release replacement;
- Caddy reverse-proxy/TLS boundary and Docker/Compose packaging templates.

A real Docker image build/run is **not** accepted evidence in this candidate: Docker Desktop was available, but the machine's Docker Hub path timed out/stalled while fetching `node:22-alpine`/registry data before project build stages completed. Compose/Caddy configuration is validated; container E2E remains an external-registry gap.

## Included public governance

- mission and public operating model;
- non-commercial source-available interpretation consistent with the existing `LICENSE`;
- governance, privacy, security and independent operator responsibility;
- branding/trademark/official-instance boundaries without claiming registered trademark rights;
- authors/attribution without requiring contributor real-name disclosure or inventing a legal entity;
- code of conduct, notice and release-status policy;
- GitHub issue/PR templates that reject sensitive worker data/secrets and require production/candidate/evidence-scope clarity;
- machine governance/release-readiness checks.

## Validation evidence before staging

Decisive checks passed during this workstream:

- product-focused tests: `13/13 PASS` after retaining/fixing the expected UI-label contract failure;
- `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- public smoke contract: `9/9 PASS`;
- project continuity: `3/3 PASS`;
- independent instance: `2/2 PASS`;
- signed federation: `2/2 PASS`;
- multi-mirror: `2/2 PASS`;
- signed peer/trust/pull: `2/2 PASS`;
- self-host lifecycle/backup/restore/release replacement: `1/1 PASS`;
- public governance/release readiness: `4/4 PASS`, machine status `PUBLIC_GOVERNANCE_READY_SOURCE_CANDIDATE`;
- local Wrangler Worker + D1 smoke: `PASS` after Phase O data-model/API changes;
- real local Caddy Host/Origin/CSRF/security proxy flow: `PASS` after retaining/fixing the initial Host rewrite failure;
- independent frontend privacy audit: `0 forbidden matches`;
- GitHub YAML parsing: `PASS`;
- `git diff --check`: `PASS`.

## Known gaps / non-claims

- Phase O is not Reference Instance accepted production yet;
- no real external Git/object-storage/IPFS mirror network is operating from this local work;
- no automatic global peer registry/crawler;
- no cross-instance community/worker aggregate or anti-Sybil global score;
- no source-specific federation of official/machine/provider lanes until redistribution terms are reviewed;
- Docker image build/run remains unverified on this machine due the retained Docker Hub connectivity failure;
- FileStore self-host does not include the Reference Instance Cloudflare Queue/Cron automatic company-research runtime;
- no Mainland China availability SLA;
- no sensitive private-case hosting or automatic external complaint filing.

## Release/publishing boundary

This source candidate may be committed/pushed to canonical `main` after staged-content checks pass. The push may run CI, public semantic smoke against the **existing** Reference Instance, and GitHub Pages for changed read-only public-site files. It must not manually invoke the production auto-research E2E or deploy Cloudflare/Vercel runtime as part of this source-candidate gate.

A later Git tag/GitHub Release must follow `RELEASE_POLICY.md` and state clearly whether it is source-only candidate/stable and whether Reference Instance deployment acceptance has occurred.

## Excluded from source staging

- `.ltp-instance/` and all runtime instance data;
- `secrets.json`, `peers.json`, `state.json`, private backups and generated `.env`;
- all `history/subagents/` direct-conversation work logs, including this request's internal handoff record;
- generated build/dist directories ignored by the repository;
- any unrelated collaboration artifact not required by this Phase O source candidate.

## Post-publish evidence

The source candidate was committed as:

`ec453528b3e4cb89bb6f6c0d06db211092b878f4` — `feat: publish Phase O public-interest source candidate`

and pushed to canonical GitHub `main`.

For that exact SHA, GitHub completed:

- `Validate release candidate (no deployment)` — run `35181683052` — `success`;
- `Public non-Tencent deployment smoke` — run `35181683073` — `success`;
- `Deploy public-interest site to GitHub Pages` — run `35181683098` — `success`.

The public smoke result validates the currently deployed Reference Instance path; it does not state that Phase O is deployed. No Cloudflare/Vercel production runtime deployment or manual production auto-research E2E was performed in this source-candidate gate.

Reference Instance accepted production therefore remains `v0.8.8-rc.1`. A production promotion must first assign a new source/runtime version identity and pass a separate deployment/acceptance gate.
