# v0.8.7-rc.1 — China SZSE listing/disclosure depth

Date: 2026-09-16
Status: `PASS_PRODUCTION_SZSE_LISTING_DEPTH_V087`

## Why this is the next milestone

v0.8.6 closed the first exchange-listing coverage gap with a strict Shanghai Stock Exchange reference path. The next highest-value gap is the Shenzhen Stock Exchange because it extends the same evidence-scoped China company investigation without changing the trust model, collecting private data, or inventing a parallel research framework.

## What changed

- Added `CN_SZSE_LISTING` to `docs/v0_8/source-registry.json` as a keyless official exchange listing/disclosure source.
- Added `scripts/community_agent/cn_szse_listing_daily.py` to the approved China-first daily Agent workflow.
- The collector performs one official `ShowReport` XLSX request (`CATALOGID=1110`, A-share stock list) when at least one China company exists.
- The official report itself contains full company names and security codes. A record becomes `OFFICIAL_SOURCE_REFERENCE` only when exactly one report row's full company name matches the existing company-space name after conservative Unicode/whitespace normalization.
- Shortened names, security abbreviations, substring matches and duplicate exact rows do not bind. Duplicate exact rows fail closed.
- Published fields are bounded to listing/disclosure context: exchange, security code/abbreviation, full/English name, board, listing date, industry, registered address/province/city and public company website.
- A SZSE reference never upgrades `MACHINE_VERIFIED_REFERENCE` or GSXT legal identity, and cannot support broad compliance, labor, product-quality, credit or investment conclusions.
- Company dossier/research-status/UI/governance/daily-Agent instructions now describe SSE and SZSE as separate strict official-reference providers.

## Real-source boundary checks

Official SZSE probing on 2026-09-16 returned an XLSX stock-list report with 2,901 issuer rows.

- Positive control: `平安银行股份有限公司` -> exact official full-name row -> security code `000001`, abbreviation `平安银行`, board `主板` -> one valid bounded listing reference.
- Current real project company: `星宇股份有限公司` -> zero exact full-name rows -> zero SZSE references.

The zero result is a coverage result only. It does not mean the company is unlisted or has no other disclosure records; SSE already demonstrates why shortened-name context must not be converted into legal identity or listing facts without the provider-specific strict rule.

## Validation performed so far

- New SZSE collector unit tests: `5/5 PASS`.
- China/jurisdiction collector regression set including SSE + SZSE + NMPA + SAMR + CSRC + TED + Japan NTA: `26/26 PASS`.
- `sites-app`: `29/29 PASS`, including explicit SZSE dossier/evidence-lane coverage.
- `cloudflare-backend`: `24/24 PASS`.
- public smoke contract tests: `8/8 PASS`.
- local Worker+D1 HTTP/restart smoke: `PASS`, version `0.8.7-rc.1`.
- sites build: `PASS`, 17 files, version `0.8.7-rc.1`.
- frontend candidate build + privacy audit: `PASS`, 0 forbidden matches.
- source registry parse: `PASS`, 26 sources including `CN_SZSE_LISTING`.
- `git diff --check`: `PASS`.

The raw system Python cannot load the project's FastAPI/httpx/cryptography dependencies, so that failed discovery attempt is an environment mismatch and is not counted as product validation. A duplicate long-running virtualenv-wide local sweep was stopped after the decisive collector/UI/backend/Worker checks above passed; the repository's GitHub CI remains the required full Python release gate before deployment.

## Production acceptance

Accepted on 2026-09-16 after the user continued the approved source-depth/release workflow.

- Feature head: `d402a1e1e79ab1dec555ee52e26a4f2d324c72e3` (`main == origin/main` before this acceptance-evidence commit).
- GitHub release-candidate CI run `35099735327`: `PASS`, including the repository's full Python release gate and Web/Worker checks.
- GitHub public non-Tencent smoke run `35099735221`: `PASS` on the same feature head.
- Cloudflare Worker version: `975f2c7a-bfd6-41fc-a355-230f2a3b29e6`.
- Vercel production deployment: `https://workermanifestfellowship-e1dtesru0-hiddenfeng.vercel.app`, aliased to `https://workermanifestfellowship.dpdns.org`.
- Canonical `/api/config`: `version=0.8.7-rc.1`, `domainVersion=0.8.7-rc.1`, `mode=CLOUDFLARE_WORKER_D1`.
- Production SZSE run: 1 official report request, 2,901 rows scanned, 1 eligible China company, 0 exact full-name matches, 0 references published. The current `星宇股份有限公司` space therefore remains fail-closed rather than being forced into an unrelated/shortened listing identity.
- Canonical company detail exposes `CN_SZSE_LISTING` alongside `CN_SSE_LISTING`, while `officialReferences=[]`, `officialRelations=[]`, `officialEvents=[]` and strict legal identity remains unresolved.
- Production state after the run: 1 real company, 0 pending feedback, 0 official references, 0 official relations and 0 official events; the existing negative community signal/labour claim is preserved.
- Canonical browser verification completed with zero page/network/console errors. The public footer reports `0.8.7-rc.1` and states that SSE/SZSE listing/disclosure use strict subject binding.
- The normal deployment wrapper's `wrangler whoami` preflight can hang on this Mac's already documented command-line network path. The release used the same checked-in production config, secrets file and exact deployment variables through direct `wrangler deploy`; production version/config and browser behavior were then independently verified. This is recorded as a local network-path limitation, not as weakened deployment or evidence policy.

Production gate: `PASS_DEPLOYED_CI_PUBLIC_SMOKE_BROWSER_SZSE_FAIL_CLOSED_V087`.

## Remaining listing/disclosure gap

After SZSE, Beijing Stock Exchange coverage remains the primary exchange-listing gap. It should only be automated when an official, reproducible public interface can be documented without CAPTCHA/login/anti-bot bypass or undocumented access. If that path is not safely available, BSE remains an explicit coverage gap rather than a target for brittle scraping.
