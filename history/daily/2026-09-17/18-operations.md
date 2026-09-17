# 2026-09-17 18:00 Community Operations

Timezone: Asia/Shanghai
Agent role: `agents/DAILY_COMMUNITY_AGENT.md`
Project root: `/Users/wt/Downloads/labor_transparency_v0_6`
Git at run start: `main` / `a015722ff6eba11aad2d5822fd0fc2492929bd4d`

## Scope

Executed the bounded Beijing 18:00 community-operations pass under the current repository/runtime contracts. Before operating, read the current governance, continuity, daily-agent, official-source registry/expansion documents and `qa/v0_8/verification.json`. The accepted Reference production remains `v0.8.8-rc.1`; the local/source candidate is `v0.9.0-rc.1`. This daily run did not deploy or accept the Phase O candidate.

Pre-existing unrelated worktree changes were preserved. This run did not create or monitor another Agent and did not bypass CAPTCHA, login, anti-bot, paywall or undocumented source controls.

## Production state before collection

Trusted `community_api.py state` read:

- Real companies: 2 — `富士康` and `星宇股份有限公司`, both region `中国`.
- Pending community feedback: 0.
- Official references: 0.
- Official relations: 0.
- Official events: 0.
- Previous daily runs: 2026-09-16 phase 18 and phase 19 both `COMPLETED`.

No private feedback/advisory text, credentials, receipt codes or account/session identifiers were copied into this history.

## Official-source collection

### CN_NMPA_UDI

Command: `python3 scripts/community_agent/nmpa_udi_daily.py --publish --output history/daily/2026-09-17/nmpa-udi.json`

The first attempt failed closed before any relation write:

- Error: the official daily ZIP contained 2 XML files while the collector still required exactly 1 XML.
- Official release: `UDID_DAY_UPDATE_20260916.zip`.
- Direct bounded inspection confirmed two normal NMPA XML parts: `PART1_Of_2` and `PART2_Of_2`, both with the expected `udid` / `devices` structure.

A small reversible collector fix was made in `scripts/community_agent/nmpa_udi_daily.py` and covered by `tests/test_nmpa_udi_daily.py`:

- accept one or more XML parts instead of exactly one;
- scan every part through the unchanged exact-company binding logic;
- deduplicate relations across parts using the existing stable relation identity fields;
- fail closed if the ZIP contains no XML;
- expose `xmlParts` in metrics.

After the targeted test passed, the real collector was rerun successfully:

- Status: `PASS`.
- Companies considered: 2.
- XML parts: 2.
- Records scanned: 13,086.
- Exact matched devices: 0.
- Unique relations: 0.
- Published relations: 0.
- Source: https://udi.nmpa.gov.cn/

Boundary: zero exact matches means only that this NMPA daily release contained no record satisfying the exact existing-company binding rule. It does not mean either company has no products, medical-device relationship or other records outside this release/source scope.

### CN_SSE_LISTING

Command: `python3 scripts/community_agent/cn_sse_listing_daily.py --publish --output history/daily/2026-09-17/cn-sse-listing.json`

- Status: `PASS`.
- Eligible China companies: 2.
- Source requests: 2.
- Candidate security codes: 1.
- Official company-overview detail requests: 1.
- Exact full-name matches: 0.
- Published references: 0.
- Source: https://www.sse.com.cn/market/publicdata/

The candidate security code remained discovery only because the official full company name did not exactly equal the existing company-space name. No listing or legal-identity inference was made.

### CN_SZSE_LISTING

Command: `python3 scripts/community_agent/cn_szse_listing_daily.py --publish --output history/daily/2026-09-17/cn-szse-listing.json`

- Status: `PASS`.
- Eligible China companies: 2.
- Source requests: 1.
- Official stock-list rows scanned: 2,901.
- Exact full-name matches: 0.
- Published references: 0.
- Source: https://www.szse.cn/market/product/stock/list/index.html

No shortened-name, substring or contextual match was promoted to an official listing reference.

### CN_SAMR_RECALL

Command: `python3 scripts/community_agent/cn_samr_recall_daily.py --publish --output history/daily/2026-09-17/cn-samr-recall.json`

- Status: `PASS`.
- Eligible China companies: 2.
- Index requests: 4.
- Index records read: 84.
- Exact title matches: 0.
- Detail requests: 0.
- Published events: 0.
- Source: https://www.samrdprc.org.cn/

No exact match in the bounded recent indexes is not evidence that no recall, quality issue or safety issue exists elsewhere or in another period.

### CN_CSRC_PENALTY

Command: `python3 scripts/community_agent/cn_csrc_penalty_daily.py --publish --output history/daily/2026-09-17/cn-csrc-penalty.json`

- Status: `PASS`.
- Eligible China companies: 2.
- Official search requests: 2.
- Search results: 0.
- Detail requests: 0.
- Published events: 0.
- Source: https://www.csrc.gov.cn/csrc/c101928/common_list.shtml

Zero results do not establish company-wide legality, misconduct or absence of records in other regulators, periods or jurisdictions.

### EU_TED

Command: `python3 scripts/community_agent/eu_ted_daily.py --publish --output history/daily/2026-09-17/eu-ted.json`

- Status: `PASS`.
- Eligible EU/EEA companies: 0.
- Requests: 0.
- Window: 2026-09-10 through 2026-09-17.
- Published relations: 0.
- Source: https://docs.ted.europa.eu/api/latest/search.html

This is an applicability no-op, not evidence of absence.

### JP_NTA_CORPORATE_NUMBER

Command: `python3 scripts/community_agent/jp_nta_daily.py --publish --output history/daily/2026-09-17/jp-nta.json`

- Status: `PASS_NO_ELIGIBLE_COMPANIES`.
- Eligible Japan companies: 0.
- Source requests: 0.
- Published references: 0.
- Source: https://www.houjin-bangou.nta.go.jp/download/sabun/index.html

This is an applicability no-op and no legal-identity conclusion was drawn.

## Community feedback

`python3 scripts/community_agent/community_api.py queue` returned an empty queue. No suggestion, appeal, correction or source request required a response. No private feedback message was copied to this log or the public announcement.

## Real-company dossier / China-investigation gaps

Both real company detail endpoints were read through the canonical production domain in an AgentDock-managed browser; both reads had zero page/network errors.

### 富士康

- Autonomous research: `AUTO_READY` / `CANDIDATES_ONLY`.
- Strict machine legal identity: `NO_VERIFIED_REFERENCE`.
- Exact-name candidate count: 0.
- Applicable research sources succeeded: 2; source errors: 0; US-only sources `NOT_APPLICABLE`: 9.
- Official references / relations / events: 0 / 0 / 0.
- `chinaInvestigation` remains `PARTIAL_EVIDENCE` with explicit gaps for strict legal identity, listing/disclosure binding, limited product coverage, regulatory events, recalls and government procurement.
- Open-knowledge/GLEIF possibilities remain candidates only; none was promoted to legal identity or an official relation.

### 星宇股份有限公司

- Autonomous research: `AUTO_READY` / `OPEN_CONTEXT_READY`.
- Strict machine legal identity: `NO_VERIFIED_REFERENCE`.
- One bounded low/medium-confidence `OPEN_KNOWLEDGE_CONTEXT` remains available, explicitly not legal identity.
- Official references / relations / events: 0 / 0 / 0.
- `chinaInvestigation` remains `PARTIAL_EVIDENCE` with the same explicit source gaps.
- The SSE candidate discovered today did not pass the official full-name equality requirement and therefore remained unbound.

Community labour claims were observed only as aggregate presence in the public dossier. Their text was not copied into this history or announcement and was not promoted to an official or machine lane.

GSXT, CNIPA and China Government Procurement CAPTCHA/login/anti-bot paths remain explicit verification gaps and were not bypassed. BSE listing/disclosure remains a coverage gap rather than an inferred negative result.

## Code/data fixes

Application/source fix completed in this run:

- `scripts/community_agent/nmpa_udi_daily.py` — support official NMPA daily ZIPs split into multiple XML parts while retaining the same exact binding and deterministic dedupe semantics.
- `tests/test_nmpa_udi_daily.py` — added a two-part ZIP regression test including cross-part duplicate deduplication.

No evidence threshold, entity-binding rule, source tier or privacy rule was weakened. No unrelated dirty work was overwritten or cleaned. The fix remains in the current local worktree for independent 19:00 review/integration; this daily run did not perform a Phase O deployment or production release.

## Checks and evidence

- Targeted NMPA tests: `python3 -m unittest tests.test_nmpa_udi_daily` -> `PASS`, 3/3.
- Full approved daily-collector regression: NMPA + SSE + SZSE + SAMR + CSRC + TED + NTA -> `PASS`, 27/27.
- `git diff --check -- scripts/community_agent/nmpa_udi_daily.py tests/test_nmpa_udi_daily.py` -> `PASS`.
- All seven daily result JSON files parsed successfully and reported `PASS` or the legitimate `PASS_NO_ELIGIBLE_COMPANIES` state.
- Production dossier reads for both real companies completed without page/network errors and preserved strict candidate/reference boundaries.

These checks support the collector fix and today's bounded operation. They do not claim that the separate `v0.9.0-rc.1` source candidate has been deployed to the Reference production instance.

## Public announcement

- Day: `2026-09-17`.
- Announcement ID: `ann_895e2e3776dcbf19a9`.
- Payload: `history/daily/2026-09-17/announcement.json`.
- Published/updated at: `2026-09-17T10:19:21.736Z`.
- Production D1 revision after final announcement write: 91.
- Controlled write path: approved `WRANGLER_D1` fallback; no raw/ad-hoc SQL.

The announcement contains only completed non-sensitive work and official/public source links. It explicitly preserves the distinction between zero matches, inapplicability and actual absence.

## Unresolved items for 19:00 independent review

1. Independently review the NMPA two-part ZIP compatibility fix and its 27/27 collector regression evidence; retain the initial failed attempt as evidence of the real upstream format change.
2. Confirm the local NMPA fix is integrated durably without mixing or overwriting unrelated Phase O dirty work. No Reference production deployment is needed merely to run this local daily collector.
3. Recheck the private feedback queue, production official reference/relation/event counts, and today's announcement against actual state.
4. Preserve explicit China gaps: strict official legal identity, BSE/other listing coverage, broader product/regulatory/recall/procurement/labour coverage, and all CAPTCHA/login/anti-bot boundaries.

## 18:00 conclusion

All currently approved daily source collections were ultimately completed under their applicability and exact-binding rules, the private feedback queue was evaluated, both real China company dossiers/gaps were inspected, a real NMPA upstream-format compatibility defect was repaired and regression-tested without weakening evidence semantics, no unsupported official record was created, and the sourced daily announcement was published. Phase-18 controlled recording and final production readback follow below.

## Final controlled-write verification

- Phase-18 daily-run ID: `adr_df0105e7b2fafc15a7`.
- Stored phase/status: `18 / COMPLETED`.
- Daily-run updated at: `2026-09-17T10:20:25.153Z`.
- Production D1 revision after daily-run write: 92.
- Final `community_api.py state` readback showed the 2026-09-17 announcement as latest, showed this phase-18 run as `COMPLETED`, kept pending feedback at 0, and kept official reference/relation/event counts at 0 / 0 / 0.
