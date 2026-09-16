# v0.8.7-rc.1 — China SZSE listing/disclosure depth

Date: 2026-09-16
Status: `PASS_LOCAL_RELEASE_CANDIDATE_NOT_PRODUCTION_DEPLOYED`

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

## Release boundary

This milestone is not yet production-deployed. Current accepted production remains v0.8.6-rc.1. Before production acceptance, require the full Python suite/CI, integrate the isolated branch into local `main`, push through the existing GitHub release gate, deploy through the canonical Cloudflare/Vercel path, run the real production SZSE collector, and verify the current real company remains fail-closed with zero forced reference.

## Remaining listing/disclosure gap

After SZSE, Beijing Stock Exchange coverage remains the primary exchange-listing gap. It should only be automated when an official, reproducible public interface can be documented without CAPTCHA/login/anti-bot bypass or undocumented access. If that path is not safely available, BSE remains an explicit coverage gap rather than a target for brittle scraping.
