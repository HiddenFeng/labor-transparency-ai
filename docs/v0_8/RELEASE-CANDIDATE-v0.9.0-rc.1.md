# Reference Production Release Candidate — v0.9.0-rc.1

Date: 2026-09-17
Status: `REFERENCE_PRODUCTION_ACCEPTED`
Active change: `docs/v0_8/CHANGE-federated-public-interest-network-and-product-labor-signals.md`
Accepted Reference production: `v0.9.0-rc.1`
Candidate source/runtime: `v0.9.0-rc.1`

## Status

`v0.9.0-rc.1` began as the first versioned Reference Production release-prep candidate for Phase O, assigning a distinct source/runtime identity to the locally validated Phase O behavior and architecture instead of deploying materially different code under the earlier `v0.8.8-rc.1` identity.

The versioned source candidate was published at canonical `main@35dff048c1c89df4312335b62f9fedc95d5a527f`; the release gate was later reconciled against a live v0.9 deployment, a bounded smoke/footer repair was published at `main@93222cba64a203dd72d7d7b4ac57274f70c6ffea`, and the full post-deploy smoke -> manual E2E -> exact QA cleanup chain passed. `v0.9.0-rc.1` is therefore now the accepted Reference production baseline. This acceptance still does **not** claim a stable public multi-node federation network or any of the known non-production gaps below.

## Reference production preflight

The preflight was re-run against current volatile state before version promotion work:

- canonical `/api/config` still reports `version=0.8.8-rc.1`, `domainVersion=0.8.8-rc.1`, `mode=CLOUDFLARE_WORKER_D1`; the browser read had no page/network/console error;
- trusted production state currently contains 2 real companies: `富士康` and `星宇股份有限公司`;
- pending feedback/correction/appeal/source-request queue is empty; official reference/relation/event counts are all 0;
- the real `富士康` company created on 2026-09-17 entered Queue research at `02:42:43.501Z` and reached `AUTO_READY / CANDIDATES_ONLY` at `02:42:47.015Z`;
- that run had 2 applicable-source successes, 0 source errors and 9 `NOT_APPLICABLE` sources; `exactNameCandidateCount=0`, legal identity remained `NO_VERIFIED_REFERENCE`, and related Foxconn/Hon Hai records stayed candidates rather than being promoted by abbreviation/context similarity;
- the latest persisted 2026-09-16 Beijing 18:00 and 19:00 daily runs are `COMPLETED`;
- current LocalAgentRuntime 18:00/19:00 fixed tasks are both `WAITING_NEXT_RUN` with no blocker.

This new production state does not rewrite the historical v0.8.8 acceptance hygiene snapshot, which correctly recorded one real company at the time of that acceptance.

## Reference Instance upgrade scope

If later deployed and accepted, `v0.9.0-rc.1` would promote the already validated Phase O candidate surfaces into the Reference Instance, including:

- product/company consumer-choice views with separate worker-perspective, general-community and concrete labour-claim evidence lanes;
- worker-perspective ballot persistence that remains separate from legacy/general community ballots;
- public `/api/product-market` semantics;
- independent-instance same-origin/fork-safety behavior;
- the locally validated independent-instance bootstrap, signed public-evidence federation, content-addressed mirrors, explicit peer trust/pull and self-host release contract where those code paths are part of the source release.

The release does not change the project's non-commercial public-interest purpose and does not create a central authority over downstream instances.

## Privacy and security boundary

No release-prep change widens sensitive-data intake. The following remain protected:

- private feedback/advisory, contacts, IPs, raw sensitive evidence, attachments and account/session linkage are not federation payloads;
- worker/community sentiment is not identity verification or a factual employer-quality conclusion;
- independent instances cannot silently point to the Reference production API in independent mode;
- Host/HTTPS/Origin/CSRF and existing fail-closed security controls remain unchanged;
- no Tencent Cloud / EdgeOne identity, payment or account-completion requirement is introduced.

## Evidence semantics

The candidate preserves the existing distinct lanes:

`MACHINE_VERIFIED_REFERENCE / OPEN_KNOWLEDGE_CONTEXT / SOURCE_SIGNAL / SOURCE_EVENT_CANDIDATE / CONTEXT_CANDIDATE / OFFICIAL_SOURCE_REFERENCE / OFFICIAL_SOURCE_RELATION / OFFICIAL_SOURCE_EVENT / GENERAL_COMMUNITY_SIGNAL / WORKER_PERSPECTIVE_SIGNAL / Community E0+ labour_claim`.

`0 match` remains bounded source evidence only; it is not absence. Unsupported jurisdictions remain `NOT_APPLICABLE`. Candidate/abbreviation/context similarity does not upgrade legal identity.

## Local release-prep validation

Versioned runtime checks:

- `sites-app`: `31/31 PASS`;
- `cloudflare-backend`: `24/24 PASS`;
- `sites-app` build: `PASS`, 20 files, manifest version `0.9.0-rc.1`;
- local Worker + D1 HTTP/restart smoke: `PASS`, backend/worker `0.9.0-rc.1`, CORS/CSRF/D1/company flow/Queue/autonomous research/community-Agent/official lanes/advisory/privacy checks passed and restart persistence retained worker/product state;
- public smoke contract: `9/9 PASS`, including the manual-only, checked-out-release-aware production E2E contract;
- continuity + public-governance rerun after dual-version correction: `7/7 PASS`;
- machine release-readiness: `PUBLIC_GOVERNANCE_READY_SOURCE_CANDIDATE`, candidate `v0.9.0-rc.1`, accepted production `v0.8.8-rc.1`, `phaseOCandidateProductionAccepted=false`;
- normal frontend release-prep build: `PASS`, 8 files; privacy audit `forbiddenMatches=0`;
- independent same-origin frontend build: `PASS`, 8 files; privacy audit `forbiddenMatches=0`;
- independent mode with remote upstream API: expected fail-closed rejection `PASS`;
- `git diff --check`: `PASS`.

### Retained failure evidence

The first combined governance run after assigning `0.9.0-rc.1` returned `14/16 PASS`:

1. `project_continuity.test.mjs` incorrectly required the package/source version to equal the accepted production version;
2. `public_release_readiness.mjs` likewise reported the package version as `acceptedProduction` and expected README/continuity/release policy to call that same value the current baseline.

Those were release-governance model defects exposed by the required source/production version split, not production failures. The acceptance standard was not weakened. The machine contract was corrected to track `source/runtime candidate` and `accepted production` independently, documentation was synchronized, and the affected continuity/governance suite then passed `7/7` with readiness explicitly reporting `v0.9.0-rc.1` versus `v0.8.8-rc.1`.

## Versioned source publication / CI evidence

- published branch/head: `main@35dff048c1c89df4312335b62f9fedc95d5a527f`;
- `Validate release candidate (no deployment)` run `35185637735`: `success`;
- `Public non-Tencent deployment smoke` run `35185637750`: `success`;
- the push-triggered CI has no production credentials and performs no Reference Instance deployment;
- `Manual production auto-research E2E` remains `workflow_dispatch` only and was not triggered by this source publication;
- canonical production remained `v0.8.8-rc.1` when rechecked before publication.

## Known gaps

The existing non-blocking gaps remain:

- no Mainland-China stable-access SLA;
- Dockerfile/Compose configuration is validated, but a real container image build/run remains unverified on this machine because the external Docker Hub base-image pull path timed out;
- no real external Git/object-storage/IPFS mirror network or automated availability monitoring is operating yet;
- federation v1 still exports only evidence already approved under the existing public redistribution gate; official/machine/provider lanes need source-by-source redistribution review;
- no trustworthy cross-instance worker/community aggregate is claimed without anti-Sybil design;
- broader company/labour/court/arbitration/product/factory/supply-chain coverage remains partial.

## Reference production acceptance

The independent production gate is complete.

- accepted source/release head: `main@93222cba64a203dd72d7d7b4ac57274f70c6ffea`;
- exact-head release CI run `35258813226`: `success`;
- exact-head public smoke run `35258813340`: `success`;
- observed Cloudflare Worker deployment version: `36f77442-2fdc-4917-9f27-384d804c813e`, runtime `0.9.0-rc.1`;
- corrected Vercel production deployment: `workermanifestfellowship-bgkwzhjhr-hiddenfeng.vercel.app`, canonical alias retained;
- canonical browser smoke: corrected footer + Phase O product/labor-signal surface + runtime `0.9.0-rc.1`, zero page/network/console errors;
- manual post-deploy auto-research E2E run `35259826835`: `success`, `workflow_dispatch`, head `93222cba64a203dd72d7d7b4ac57274f70c6ffea`;
- E2E artifact status: `PASS_PRODUCTION_AUTONOMOUS_COMPANY_INTELLIGENCE_AND_INTERACTION`; QA company `co_73c201af0e6945a9a5`, QA region `US · production-auto-research-e2e-g74sgib`, research `AUTO_READY_WITH_SOURCE_GAPS`, dossier `REFERENCE_READY`, identity `AUTO_BOUND_REFERENCE`;
- exact cleanup preflight: only company + companyResearch + ballot matched the QA identity;
- controlled cleanup: production `ltp_write_lock`, revision `97 -> 98`, exactly 3 QA rows deleted, `residual=0`, lock released;
- post-cleanup production: 2 real companies, 2 companyResearch records, real data preserved; canonical research health `HEALTHY`; canonical config still `0.9.0-rc.1 / CLOUDFLARE_WORKER_D1`.

Acceptance status: `PASS_DEPLOYED_BROWSER_SMOKE_MANUAL_E2E_EXACT_CLEANUP_V090`.

There is no remaining v0.9 release gate. Future material source/runtime changes require their own bounded change/release evidence. Until real user/operations evidence justifies new work, the project returns to the existing priority order rather than inventing a new version or framework.

Rollback after acceptance only for a real regression/incident supported by production evidence; do not downgrade the accepted ledger merely because a local CLI path times out.
