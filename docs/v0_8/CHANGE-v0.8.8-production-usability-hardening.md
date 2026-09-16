# v0.8.8-rc.1 — Production usability hardening

Date: 2026-09-16
Status: `PASS_PRODUCTION_USABILITY_HARDENING_V088`

## Why this milestone

The v0.8.7 production runtime already has the core worker-facing product, unattended company research, China evidence-scoped investigation, daily community operations and SSE/SZSE listing depth. The next highest-value work is therefore not another source collector. It is to remove concrete production usability/operations defects discovered by walking the real site as a worker and checking the release machinery that protects those flows.

## Production audit findings

Browser validation on the canonical domain confirmed these primary surfaces load and remain usable with zero page/network/console errors:

- home / worker guidance;
- company discovery and dossier detail;
- anonymous advisory form, receipt lookup and public aggregate report;
- low-friction public contribution form and company creation entry;
- “我的提交” correction/withdrawal surface;
- rights guide and external-resource directory;
- runtime/service status.

Two material gaps were found.

1. `.github/workflows/production-auto-research-e2e.yml` was also triggered by a push that modified the workflow. The v0.8.7 source push therefore started production E2E before v0.8.7 had been deployed and failed immediately while production still reported v0.8.6. That is an invalid pre-deploy race, not a useful runtime signal.
2. The public product is Chinese and currently China-first, but the external resource directory exposed only global, U.S., U.K., Australian and EU routes. A China worker could use the company investigation but then had no clearly labeled Mainland China official next-step resources.

## What changed

### Post-deploy production E2E

- Production auto-research E2E is now `workflow_dispatch` only. It no longer auto-runs from a source push.
- The workflow derives its expected production version from the checked-out `sites-app/package.json` rather than embedding a release number that must be edited each time.
- The artifact and cleanup-boundary steps use `if: always()` so failure evidence/cleanup instructions are not silently skipped.
- Governance and the deployment runbook now state the correct sequence: CI -> deploy -> production E2E -> exact QA cleanup -> final acceptance.
- The historical v0.8.7 pre-deploy failure remains evidence; it is not rewritten as success.

### Mainland China worker resources

Added a dedicated `中国大陆` group to the public resource directory with official, non-commercial navigation links:

- 全国人社政务服务平台（12333） — `https://www.12333.gov.cn/`;
- 全国就业公共服务平台劳动关系服务 — `https://www.12333.gov.cn/job/`;
- 中国法律服务网（12348） — `https://www.12348.gov.cn/`;
- 全国根治欠薪线索反映平台 — `https://liuyan.www.gov.cn/hudong/atwls/rmqz.htm`.

The resource copy preserves the platform privacy boundary. Formal external channels may require real identity/contact data; users are told to provide that only to the official service and not paste those sensitive details into this site's anonymous advisory or public-contribution fields. Resource inclusion remains navigation, not partnership, authorization, legal representation or guaranteed acceptance.

## Local validation

- public-smoke contract tests: `9/9 PASS`, including the new post-deploy/manual E2E regression guard;
- `sites-app`: `30/30 PASS`, including a China-resource/privacy-boundary test;
- `cloudflare-backend`: `24/24 PASS`;
- local Worker+D1 HTTP/restart smoke: `PASS`, version `0.8.8-rc.1`;
- sites build: `PASS`, 17 files, version `0.8.8-rc.1`;
- frontend candidate build + privacy audit: `PASS`, 0 forbidden matches;
- `git diff --check`: `PASS`.

## Production acceptance

Accepted on 2026-09-16 after release and post-deploy verification.

- Release feature head: `cf1067a4d30485baf22258072d51bb3fc5348c5e`.
- GitHub release CI run `35103315352`: `PASS`.
- Push-triggered public semantic smoke run `35103315270`: `PASS`.
- Cloudflare Worker version: `a7f6e635-a5b5-4bff-9171-b47a0ba8b26e`.
- Vercel production deployment: `https://workermanifestfellowship-hx68r01vs-hiddenfeng.vercel.app`, aliased to `https://workermanifestfellowship.dpdns.org`.
- Canonical `/api/config`: `version=0.8.8-rc.1`, `domainVersion=0.8.8-rc.1`, `mode=CLOUDFLARE_WORKER_D1`.
- Canonical browser verification: the 中国大陆 resource filter exposes 12333, the 12333 labour-service route, 12348 and the national wage-arrears route; advisory, contribution and company discovery/detail navigation still works with zero page/network/console errors.
- Manual **post-deploy** production auto-research E2E run `35104087790`: `PASS`. The workflow created `Starbucks Corporation` in the unique QA region `US · production-auto-research-e2e-g4k2fhq`, observed the real Cloudflare Queue consumer reach `AUTO_READY_WITH_SOURCE_GAPS`, and completed the negative-ballot interaction without invoking a private research run/review endpoint.
- Exact cleanup preflight found only three QA-related D1 rows: the QA company, its companyResearch record and its ballot. Those rows were removed under the production `ltp_write_lock`; D1 revision advanced `77 -> 78` and no QA row remained.
- Post-cleanup production state: 1 real company (`星宇股份有限公司`), 1 real ballot, 1 companyResearch record, 1 contribution, 0 pending community feedback, 0 official references, 0 official relations and 0 official events; real community evidence remained intact.
- Manual **post-deploy** public semantic smoke run `35104628662`: `PASS`.

Production gate: `PASS_DEPLOYED_CI_BROWSER_POSTDEPLOY_E2E_CLEANUP_PUBLIC_SMOKE_V088`.

No material broken core user path was found after the fixes above. Remaining work is normal source/coverage growth (for example BSE only if an official reproducible public interface is available) and future product iteration; it is not a blocker to the current product being usable.
