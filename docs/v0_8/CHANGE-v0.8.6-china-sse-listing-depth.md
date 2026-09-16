# v0.8.6-rc.1 — China SSE listing/disclosure depth

Date: 2026-09-16
Status: `PASS_PRODUCTION_SSE_LISTING_DEPTH_V086`

## Why this is the next milestone

The accepted v0.8.5 production state already exposes a source-scoped China enterprise investigation but explicitly leaves listing/disclosure binding unresolved. The highest-value next step is therefore source depth, not another framework or queue refactor. This milestone adds a bounded Shanghai Stock Exchange listing/disclosure reference while preserving the project's existing evidence lanes and fail-closed identity rules.

## What changed

- Added `CN_SSE_LISTING` to `docs/v0_8/source-registry.json` as a keyless official exchange disclosure source.
- Added `scripts/community_agent/cn_sse_listing_daily.py` to the approved daily China-source workflow.
- Candidate discovery reads the SSE public security directory. Directory rows and security abbreviations are **not evidence**.
- For every candidate security code, the collector reads the official SSE company overview and publishes an `OFFICIAL_SOURCE_REFERENCE` only when its `FULL_NAME` exactly matches the existing company-space name after the project's conservative Unicode/whitespace normalization.
- Multiple exact official rows fail closed. A zero match stays zero/unknown.
- Published fields are bounded to exchange/listing/disclosure context: security code, abbreviation, full legal name, security type, listing date/status, industry, registered area and source snapshot date.
- An SSE reference does not upgrade `MACHINE_VERIFIED_REFERENCE` or GSXT legal identity, and cannot support a company-wide compliance, labor, product-quality, credit or investment conclusion.
- China dossier/UI now surfaces strict listing/disclosure references and their metadata while keeping official references, official relations, official events, research context and community claims separate.
- Daily Agent/governance documentation now includes SSE as a China-first collector with the same evidence boundary.

## Real-source boundary checks

Official SSE source probing on 2026-09-16 returned a 2,377-row public security directory.

- Positive control: `贵州茅台酒股份有限公司` -> candidate `600519` -> official overview `FULL_NAME=贵州茅台酒股份有限公司` -> one valid bounded listing reference.
- Current real project company: `星宇股份有限公司` -> candidate `601799` -> official overview `FULL_NAME=常州星宇车灯股份有限公司` -> **no reference published** because the full legal name is not an exact match.

The second case is intentional negative evidence for the binding rule: the existing Wikidata shortened-name context and SSE security abbreviation are useful discovery hints, but neither is sufficient to rewrite the company-space identity or force a listing/identity assertion.

## Local validation

- Python full project suite, split into bounded batches after the single aggregate command exceeded the tool time limit: `315/315 PASS` (`117 + 177 + 21`).
- China/jurisdiction collector regression subset: `21/21 PASS`, including new SSE strict-binding tests.
- `sites-app`: `28/28 PASS`.
- `cloudflare-backend`: `24/24 PASS`.
- public smoke contract: `8/8 PASS`.
- local Worker+D1 HTTP/restart smoke: `PASS`, version `0.8.6-rc.1`, official reference/relation/event lanes and restart persistence intact.
- sites build: `PASS`, 17 files, version `0.8.6-rc.1`.
- Vercel-proxy frontend candidate build: `PASS`; static privacy audit: `PASS`, 0 forbidden matches.
- source registry parse: `PASS`, 25 sources including `CN_SSE_LISTING`.
- `git diff --check`: `PASS`.

## Production acceptance

Accepted on 2026-09-16 after the user continued at the explicit production-release gate.

- Production source/behavior commit chain includes `e2639a5` (SSE listing depth) and final UI alignment `b5477db18b868d675fa892218e29c2ce9b618910`; `main == origin/main == b5477db18b868d675fa892218e29c2ce9b618910` at final release verification.
- Release-candidate CI run `35092376390` for the v0.8.6 release chain: `PASS`; follow-up CI run `35093466380` for the footer alignment commit: `PASS`.
- Public deployment smoke run `35093466385` for `b5477db`: `PASS`.
- Cloudflare Worker version: `bfb8d01a-df40-4079-a9ff-4bdfdebb035b`.
- Final Vercel production deployment: `https://workermanifestfellowship-ceyrdo8ip-hiddenfeng.vercel.app`, aliased to `https://workermanifestfellowship.dpdns.org`.
- Canonical `/api/config`: `version=0.8.6-rc.1`, `domainVersion=0.8.6-rc.1`, `mode=CLOUDFLARE_WORKER_D1`.
- Canonical production company detail exposes `CN_SSE_LISTING` in `chinaInvestigation.sourceCoverage`, while the real `星宇股份有限公司` remains `NO_VERIFIED_REFERENCE` with `officialReferences=[]`, `officialRelations=[]`, and `officialEvents=[]`.
- Real production SSE publish pass: 1 eligible China company, 1 candidate code, 1 official detail request, 0 exact `FULL_NAME` matches, 0 references published. The official `601799` company overview is `常州星宇车灯股份有限公司`, so the shortened current company-space name is intentionally not auto-bound.
- Production browser checks on the canonical domain and company dossier completed with zero browser console/network/page errors. The final footer now identifies v0.8.6 and the SSE listing/disclosure depth rather than stale v0.8.5 copy.
- Production community state after the SSE pass remains clean: 1 real company, 0 pending feedback, 0 official references, 0 official relations, 0 official events; the existing real negative community ballot/claim is preserved.
- A direct local Node/curl public-smoke attempt still fails on this Mac's already documented command-line network path, while browser production access and GitHub-hosted public smoke pass. This is retained as an environment-path limitation, not hidden as a product success/failure.

Production gate: `PASS_DEPLOYED_CI_PUBLIC_SMOKE_BROWSER_SSE_FAIL_CLOSED_V086`.

## Next source-depth work after this milestone

SSE coverage does not close China listing/disclosure coverage. Remaining high-value source depth is, in order:

1. document and implement equivalent strict official binding for SZSE and BSE where public supported interfaces permit it;
2. add approved procurement award-detail paths that do not require CAPTCHA/anti-bot bypass;
3. deepen SAMR/CSRC source-specific records where provenance and party binding are machine-verifiable;
4. add trustworthy China labor/public-enforcement sources when a legal, reproducible public access path exists.

GSXT, CNIPA and government-procurement paths that require CAPTCHA, login, anti-bot handling or undocumented interfaces remain official verification gaps, not bypass targets.
