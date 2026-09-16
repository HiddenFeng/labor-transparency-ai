# v0.8.8-rc.1 — Production usability hardening

Date: 2026-09-16
Status: `PASS_LOCAL_RELEASE_CANDIDATE_NOT_PRODUCTION_DEPLOYED`

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

## Release gate

Current accepted production remains v0.8.7-rc.1 until v0.8.8 passes GitHub release CI and is deployed through the canonical Cloudflare Worker + Vercel path. After deployment:

1. verify canonical `/api/config` reports `0.8.8-rc.1`;
2. browser-check the new 中国大陆 resource group and the existing advisory/contribution/company flows;
3. manually run the production auto-research E2E only after runtime version matches the checked-out release;
4. precisely clean any QA company/research/ballot created by that E2E and verify production data hygiene;
5. record final acceptance evidence in `qa/v0_8/verification.json`.

The milestone should stop there unless the audit finds another concrete broken user path. BSE or other source-depth expansion is lower priority than a real usability/operations defect.
