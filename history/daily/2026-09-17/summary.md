# 2026-09-17 Daily Community Operations Summary

Timezone: Asia/Shanghai
18:00 operator record: `history/daily/2026-09-17/18-operations.md`
19:00 independent review: `history/daily/2026-09-17/19-review.md`

## Source / data work

All seven currently approved daily collectors were completed under their applicability and exact-binding rules:

- CN_NMPA_UDI: 2 China companies, 2 official XML parts, 13,086 records scanned, 0 exact product-relation matches, 0 relations published.
- CN_SSE_LISTING: 2 China companies, 1 candidate security code / 1 official company-overview check, 0 exact full-name matches, 0 references published.
- CN_SZSE_LISTING: 2 China companies, 2,901 official stock-list rows scanned, 0 exact full-name matches, 0 references published.
- CN_SAMR_RECALL: 84 bounded recent index records, 0 exact company-title matches, 0 events published.
- CN_CSRC_PENALTY: 2 official-site searches, 0 results, 0 events published.
- EU_TED: 0 eligible EU/EEA companies, 0 requests, 0 relations published.
- JP_NTA_CORPORATE_NUMBER: 0 eligible Japan companies, 0 requests, 0 references published.

Final reviewed production counts remained 0 official references, 0 official relations and 0 official events. Zero matches and non-applicability were retained as bounded source/applicability results, never expanded into claims of absence.

## User feedback handling

The production community-feedback state/queue was checked during both daily phases and remained empty. No suggestion, appeal, correction or source request required a response. No private message text or sensitive advisory/account data entered daily history or the public announcement.

## Code / product work

The NMPA daily ZIP changed upstream from one XML member to two XML parts. The first 18:00 collection attempt failed closed before any official-relation write. A small compatibility repair in `scripts/community_agent/nmpa_udi_daily.py` now scans one or more XML parts and deterministically deduplicates relation identities while retaining the unchanged exact existing-company binding and narrow NMPA relation scope. `tests/test_nmpa_udi_daily.py` adds a multi-part/deduplication regression case.

The repair is implementation-only: no source registry, evidence lane, source threshold, identity rule, privacy boundary, production runtime or Phase O architecture changed.

## Production / company evidence review

The accepted public runtime remains `0.8.8-rc.1 / CLOUDFLARE_WORKER_D1`; checked-out source/runtime packages are `0.9.0-rc.1`. Canonical browser reads of `/api/config` and both real company detail endpoints had zero page/network/console errors.

- `富士康`: `AUTO_READY / CANDIDATES_ONLY`, `exactNameCandidateCount=0`, strict identity `NO_VERIFIED_REFERENCE`; related GLEIF/Wikidata results remain candidates.
- `星宇股份有限公司`: `AUTO_READY / OPEN_CONTEXT_READY`, strict identity `NO_VERIFIED_REFERENCE`; its bounded Wikidata context is explicitly not legal-identity evidence.

Both `chinaInvestigation` views preserve explicit gaps. No candidate, abbreviation, substring, contextual similarity, zero result or `NOT_APPLICABLE` source was promoted into an official/legal/company-wide conclusion.

## Public announcement

Announcement ID: `ann_895e2e3776dcbf19a9`.

The 19:00 review found the existing same-day announcement consistent with actual source results, source links and evidence boundaries, so it was not rewritten merely to create activity.

## Validation

Fresh 19:00 decisive checks:

- approved daily collector tests: `PASS` 27/27;
- NMPA targeted tests: `PASS` 3/3;
- targeted `git diff --check`: `PASS`;
- all seven daily result JSON files: valid `PASS` / `PASS_NO_ELIGIBLE_COMPANIES` states;
- production state/queue: 2 real companies, 0 pending feedback, 0 official references/relations/events;
- canonical runtime config and both company-detail browser reads: `PASS`, zero browser errors, evidence lanes/gaps preserved.

No unrelated full-suite repetition was performed because these checks are sufficient to establish the daily collector compatibility claim.

## Operations note

The LocalAgentRuntime 19:00 fixed occurrence was observed shortly after 19:00 in `RETRY_PENDING / CONVERSATION_NOT_READY`, with no current Send attempt yet. This takeover completed the same 19:00 project contract directly, so today's project operations are not blocked by that transport condition. No scheduler control or workaround was applied from this project task.

## Remaining legitimate gaps / next project gate

- China strict legal identity, broader listing/product/regulatory/procurement/labour/court/arbitration/supply-chain coverage remains partial where documented safe sources are unavailable.
- CAPTCHA/login/anti-bot official paths remain gaps rather than bypass targets.
- Phase O `v0.9.0-rc.1` remains source/runtime candidate only; accepted production remains `v0.8.8-rc.1`.
- The project-level next gate remains `REFERENCE_PRODUCTION_RELEASE_GATE`: intentional deploy -> production smoke -> manual post-deploy auto-research E2E -> exact QA cleanup/residual=0 -> production acceptance. This daily review did not cross that production-deployment boundary.

## Day verdict

`COMPLETED`.

Today's bounded operations are complete, the initial NMPA failure and its cause are retained, the compatibility repair is decisively validated, the feedback queue is empty, no unsupported official records were published, and no additional low-value work is justified by current evidence.
