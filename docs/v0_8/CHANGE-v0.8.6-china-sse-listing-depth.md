# v0.8.6-rc.1 — China SSE listing/disclosure depth

Date: 2026-09-16
Status: `PASS_LOCAL_RELEASE_CANDIDATE_NOT_PRODUCTION_DEPLOYED`

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

## Production status and decision gate

This change is intentionally **not yet production-deployed**. Current accepted production remains v0.8.5-rc.1 at main `367501b141beb118dbeb44589221ed45e6f1ebc6` until an explicit production-release decision is made.

If deployment is approved, the acceptance sequence is:

1. push the locally accepted v0.8.6 candidate and require CI to pass;
2. deploy Cloudflare Worker and Vercel frontend through the existing canonical GitHub/Vercel/Cloudflare path;
3. verify `/api/config` reports `0.8.6-rc.1` and the canonical company-detail projection exposes the updated SSE source coverage;
4. run the SSE daily collector against real production company spaces through the controlled Agent path;
5. verify the current `星宇股份有限公司` still produces zero SSE official references unless its company-space identity is independently corrected by stronger evidence;
6. clean all QA-only state and record final production evidence before accepting v0.8.6.

## Next source-depth work after this milestone

SSE coverage does not close China listing/disclosure coverage. Remaining high-value source depth is, in order:

1. document and implement equivalent strict official binding for SZSE and BSE where public supported interfaces permit it;
2. add approved procurement award-detail paths that do not require CAPTCHA/anti-bot bypass;
3. deepen SAMR/CSRC source-specific records where provenance and party binding are machine-verifiable;
4. add trustworthy China labor/public-enforcement sources when a legal, reproducible public access path exists.

GSXT, CNIPA and government-procurement paths that require CAPTCHA, login, anti-bot handling or undocumented interfaces remain official verification gaps, not bypass targets.
