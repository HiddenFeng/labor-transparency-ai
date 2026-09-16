# v0.8.5 China enterprise investigation

Date: 2026-09-16
Status: CANDIDATE_LOCAL_PASS_AWAITING_PRODUCTION_DEPLOYMENT
Runtime: `0.8.5-rc.1`
Company-intelligence policy: `auto-intelligence-0.8.3` (unchanged)

## Goal

Make a China company page useful for investigation without turning partial public records into a score or verdict. The page should answer: what official records are actually connected, what happened and when, what the record proves, what it does not prove, and which important areas remain unknown.

## Evidence model

v0.8.5 keeps four materially different layers separate:

1. `MACHINE_VERIFIED_REFERENCE` / autonomous intelligence — existing strict fail-closed identity/reference facts.
2. `OFFICIAL_SOURCE_REFERENCE` — bounded registry/disclosure references that do not necessarily upgrade the identity engine.
3. `OFFICIAL_SOURCE_RELATION` — a specific official record directly supports a scoped company↔product/brand/procurement relation.
4. `OFFICIAL_SOURCE_EVENT` — a specific official regulatory/recall event with event date, source record, scope and caveat.
5. Community E0+ contributions remain independent from every official layer.

`OFFICIAL_SOURCE_EVENT` currently supports `PRODUCT_RECALL`, `ADMINISTRATIVE_PENALTY`, `REGULATORY_MEASURE`, and `OTHER_OFFICIAL_EVENT`. An event does not create a company-wide rating, misconduct label, product-quality score or labor-quality score.

## China automated sources

### CN_NMPA_UDI

Existing daily official product relationship collector. Exact existing-company registrant/filing match only. Supports a specific medical-device registrant/filing ↔ UDI/product record.

### CN_SAMR_RECALL

Implementation: `scripts/community_agent/cn_samr_recall_daily.py`

Official source: 国家市场监督管理总局缺陷产品召回技术中心.

Daily strategy:
- scan only a bounded number of recent vehicle and consumer-product recall index pages;
- require the platform company full name to match one producer segment before `召回` in the official title;
- only then fetch the detail page;
- when detail exposes `生产者名称`, require exact producer-name equality again;
- publish a scoped `PRODUCT_RECALL` event only after both gates pass.

The detail parser keeps bounded recall number/date/count/defect/remedy fields. It does not infer product-wide or company-wide quality/safety.

Important live boundary check: two recent Xiaomi recall titles matched `小米汽车科技有限公司`. One detail listed the producer as exactly `小米汽车科技有限公司` and was accepted. The other listed `北京汽车集团越野车有限公司（委托小米汽车科技有限公司）` and was rejected for Xiaomi producer binding. The title alone therefore cannot override the more specific detail producer field.

### CN_CSRC_PENALTY

Implementation: `scripts/community_agent/cn_csrc_penalty_daily.py`

Official source: 中国证券监督管理委员会行政处罚决定.

Daily strategy:
- one official-site search per eligible China company;
- accept only `www.csrc.gov.cn/csrc/c101928/.../content.shtml` decision pages;
- require the full company name in the official search result summary before fetching detail;
- require an exact `当事人：<完整公司名>` party boundary in the decision body;
- publish a scoped `ADMINISTRATIVE_PENALTY` event only after both gates pass.

A unit test initially exposed that arbitrary substring matching could bind a shorter name inside a longer legal name. That logic was rejected before deployment and replaced by exact party-boundary matching.

The public event summary is project-authored and deliberately does not copy the official search excerpt containing other natural-person names/addresses. Specific facts, disposition and later review/litigation/correction status remain at the official source URL.

## China official sources kept as non-automated verification gaps

- `CN_GSXT` — official enterprise-credit query; no CAPTCHA/anti-bot/login bypass.
- `CN_CNIPA_TRADEMARK` — official trademark query; no undocumented/private API automation.
- SAMR query directory — navigation/source discovery only unless a source-specific public interface is separately approved.
- China Government Procurement — useful for procurement relations, but search paths requiring CAPTCHA are not bypassed.
- Exchange/listing disclosure — not auto-bound from a shortened company name. Stock code/legal-name corroboration is required before producing an official listing/disclosure reference.

## China company-detail synthesis

`GET /api/companies/:id` now exposes `chinaInvestigation` for China company spaces. It summarizes, without scoring:

- strict legal-identity/reference state;
- listing/disclosure reference coverage;
- official + community brand/product evidence;
- administrative penalties/regulatory measures;
- product recalls;
- official procurement relationships;
- community labor claims and the explicit limit of current official labor-data automation;
- source-coverage modes;
- explicit gaps/unknowns.

The Web company detail renders a `中国企业调查概览` followed by scoped official references, relations, and an `官方监管 / 召回事件` timeline. Missing results remain unknown/gaps rather than “no problem”.

## Current real production-company dry runs before deployment

Existing real company: `星宇股份有限公司` / `中国`.

- NMPA UDI: 8,350 current daily records scanned; 0 exact product relations.
- SAMR recalls: 4 bounded recent index requests; 84 index records; 0 full-name title matches; 0 detail requests; 0 events.
- CSRC penalties: 1 official company search; 0 results; 0 detail requests; 0 events.
- No company identity/listing claim was upgraded from the Wikidata shortened-name context.

These zero-match results prove only the connected source/query scope. They are not statements that the company has no products, recalls, penalties, procurement relationships, labor disputes or other regulatory records.

## Daily Agent behavior

The 18:00 Asia/Shanghai Agent now prioritizes China company spaces and runs NMPA UDI, SAMR recall and CSRC penalty collectors before jurisdiction-applicable EU/Japan collectors. It inspects `chinaInvestigation` gaps, handles community source requests, updates sourced announcements, and records reference/relation/event counts.

The 19:00 review Agent verifies that these China collectors actually ran from durable evidence, reviews event scope/caveats, continues unfinished safe work, and keeps CAPTCHA/login/anti-bot sources as explicit gaps rather than bypass targets.

The platform still does not monitor whether the 18:00 Agent remains active; the 19:00 pass reads the project/database evidence as the source of truth.

## Local validation before deployment

- China collector unit tests: 6/6 PASS.
- Sites/API/UI: 27/27 PASS.
- Cloudflare backend: 24/24 PASS.
- Public-smoke contract: 7/7 PASS.
- Full Python project environment: 310/310 PASS.
- Local Worker+D1 HTTP/restart smoke: PASS including `officialEvents` trusted write and public company-detail projection.
- Sites build: PASS, 17 files, `0.8.5-rc.1`.
- Built-site privacy audit: PASS, 0 forbidden matches.
- `git diff --check`: PASS.

## Production gate

Not yet accepted at this point in the file history. Production acceptance requires:
- Worker and Vercel deployment of `0.8.5-rc.1`;
- canonical public config exposing `officialEvents`;
- real China company detail exposing `chinaInvestigation` + `officialEvents` array;
- browser validation of the China investigation UI;
- public smoke / release CI / production E2E passing;
- remote D1 inspection showing no QA company/event residue and preserving real community data.
