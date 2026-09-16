# v0.8.4 — Community growth, official relationship sources, and daily Agent operations

Date: 2026-09-16

Status: `PASS_PRODUCTION_COMMUNITY_GROWTH_AND_DAILY_AGENT_INFRASTRUCTURE`

## Product objective

v0.8.3 made company dossiers usable. v0.8.4 focuses on making the project easier to join and easier to keep healthy every day:

- a normal user should be able to contribute without understanding evidence taxonomy, licenses, redistribution controls or research-provider internals;
- official company/brand/product/procurement relationships must remain source-scoped and visibly separate from community claims;
- China-first official sources should expand without bypassing CAPTCHA, anti-bot, login, payment or undocumented interfaces;
- public announcements and private suggestions/appeals should have a predictable daily handling loop;
- LocalAgentRuntime should invoke a bounded 18:00 Beijing-time operations Agent and an independent 19:00 review/continuation Agent without the platform monitoring whether either Agent is actively working between invocations.

## Simplified contribution flow

The public contribution page now defaults to three visible decisions:

1. choose a company;
2. choose what kind of information this is;
3. write one sentence describing the useful point.

Source URL, source type, time range, scope, relationship type, direction and public credit are inside progressive disclosure under “I have a public source, date, or more detail”. The UI no longer asks normal users to understand or choose internal `rights`, `shareConsent`, `rightsNote`, evidence level, review state or export state.

Safe defaults are deterministic:

- no external source URL -> `own_summary`, no redistribution grant, initial `E0`;
- public source URL -> `reference_only`, no redistribution grant, initial `E0`;
- positive/negative labor-practice choices map to scoped labor claims;
- product experience still requires an explicit positive/negative direction because it is a claim rather than neutral product metadata.

The company-space creation form now requires only company name and country/region; public website is optional. Creating a company space remains a discussion/data container and is not a rating.

Production desktop browser acceptance and independent 390×844 system-Chrome rendering both pass. Advanced `<details>` sections are closed by default on the narrow viewport.

## Relationship model

v0.8.4 introduces a persistent `officialRelations` collection and keeps it separate from community contributions.

Public tiers include:

- `OFFICIAL_SOURCE_RELATION` — a specific official record directly supports a scoped relationship;
- community `brand`, `product`, and typed `relationship` contributions — still start at `E0` unless independently reviewed;
- existing `MACHINE_VERIFIED_REFERENCE`, `OPEN_KNOWLEDGE_CONTEXT`, `SOURCE_SIGNAL`, `SOURCE_EVENT_CANDIDATE`, and `CONTEXT_CANDIDATE` tiers remain unchanged.

Official relationship records carry provider, jurisdiction, relation type, subject/object, source-of-record URL, source record ID, date, confidence, scope, caveat, and bounded allowlisted attributes. Official numeric identifiers such as UDI-DI use a separate trusted-structured-field validator; ordinary user text continues to use the stricter personal-information filters.

Company detail pages render official relationships in their own section. They do not merge them with community brand/product/relationship claims.

## China official-source expansion

### NMPA UDI

`CN_NMPA_UDI` is the first automated China official relationship source.

Implementation: `scripts/community_agent/nmpa_udi_daily.py`

The collector uses the National Medical Products Administration UDI official daily RSS/bulk release. It scans the daily XML transiently, matches only existing project companies by exact registrant name, and stores only the bounded matching relationship records. The bulk XML is not copied into D1 or the repository.

Live validation on 2026-09-16:

- official daily file: `UDID_DAY_UPDATE_20260915.zip`;
- records scanned: `8350`;
- current production companies considered: `1`;
- exact relations matched: `0`;
- published relations: `0`.

Zero matches are a valid completed result. The platform must not force a relationship merely to increase coverage.

NMPA UDI relationships support only the specific registrant/filing ↔ medical-device record. They do not prove overall product quality, safety, efficacy, labor quality, or the company's complete product portfolio.

### GSXT / CNIPA / SAMR

The National Enterprise Credit Information Publicity System, CNIPA trademark search, and SAMR query hub are registered as official lookup/navigation sources where appropriate. No undocumented endpoint, CAPTCHA bypass, anti-bot bypass or login circumvention is permitted.

## EU official-source expansion

`EU_TED` is the second automated official relationship source.

Implementation: `scripts/community_agent/eu_ted_daily.py`

The collector uses the keyless published TED Search API. It applies a rolling 8-day publication window, makes at most two requests per eligible EU/EEA company space (`winner` and `buyer`), and then requires an exact normalized participant-name match locally before storing any relation. Search results with department/address/division suffixes are rejected when they are not exact.

Live API validation confirmed exact procurement notices for `Airbus Defence and Space GmbH`. The current real production company set contains no EU/EEA company, so the normal production daily path makes zero TED requests and adds zero TED relationships; this is deliberate request minimization.

TED relations support only the company's role in the specific published procurement notice. They do not establish a complete customer/supplier network, product quality, labor quality, legality beyond the notice, or endorsement.

## Japan official-source expansion

`JP_NTA_CORPORATE_NUMBER` is the first automated official registry-reference source that is intentionally weaker than the autonomous identity engine.

Implementation: `scripts/community_agent/jp_nta_daily.py`

The collector uses the Japan National Tax Agency Corporate Number Publication Site's public daily-delta download page. It first reads the official HTML page, obtains the current CSRF token and XML/Unicode file number, and submits the site's normal `event=download` form. It does not call an undocumented private API and does not bypass the Web API's free application-ID requirement.

The 2026-09-16 live download returned `diff_20260916.zip` (about 189 KB), containing `diff_20260916.xml` (about 2.55 MB) and `diff_20260916.xml.asc`. The XML contained 2,273 corporation records in the isolated validation. The official PGP key fingerprint is recorded in source governance; the current collector records signature-file presence but does not claim cryptographic signature verification.

For a company to receive a reference, the project must already contain a Japan company space and the daily delta must contain an exact normalized legal-name match. If one exact name maps to more than one Corporate Number in that delta, every match is withheld as ambiguous. A successful match publishes only `OFFICIAL_SOURCE_REFERENCE / MEDIUM` with bounded Corporate Number/basic-register fields. It does **not** upgrade `MACHINE_VERIFIED_REFERENCE` or the `auto-intelligence-0.8.3` legal-identity state, because a daily delta is not a nationwide uniqueness search.

The current production company set contains no Japan company space, so the production dry-run returns `PASS_NO_ELIGIBLE_COMPANIES` with `sourceRequests=0`. An isolated live official-ZIP test using the real daily record for `株式会社中村工業商会` scanned 2,273 records and produced one bounded exact-name reference without publishing it to production.

## Other jurisdictions

The source registry currently contains 22 governed sources. Additional official integrations are registered with explicit gates:

- UK Companies House — adapter ready; requires API key;
- Korea OpenDART — adapter ready; requires certification key;
- Japan gBizINFO — adapter ready; requires use approval.

These remain fail-closed until the required credential/application/reuse conditions are satisfied.

## Community suggestions and announcements

New persistent collections:

- `communityFeedback`;
- `communityFeedbackResponses`;
- `publicAnnouncements`;
- `agentDailyRuns`.

Users can submit a suggestion, source request, correction, appeal, or other short message. Only the submitting browser/session and the trusted community Agent interface can read the feedback text. Public announcements never automatically expose the feedback message.

The home page now shows:

- “Today, what changed?” public announcements with source links;
- a short feedback form with one text area;
- the current user's own Agent response status.

The production 2026-09-16 announcement explains the simplified contribution flow, NMPA UDI, EU TED, daily Agent schedule and the company-selection refresh fix, with source links.

## Daily Agent operations

Governance:

- `agents/DAILY_COMMUNITY_AGENT.md` — 18:00 Asia/Shanghai operations pass;
- `agents/DAILY_COMMUNITY_REVIEW_AGENT.md` — 19:00 independent completion/review pass;
- `docs/v0_8/DAILY_AGENT_OPERATIONS.md` — durable schedule and command contract;
- `history/daily/YYYY-MM-DD/` — project-local daily evidence.

Installed LocalAgentRuntime fixed runs:

- 18:00 conversation: `https://chatgpt.com/c/6aaa3b01-bf7c-83ea-a3ae-2a33b1e06de3`
- 18:00 fixed run: `fx_0ae10ddc598947738441`
- first scheduled trigger: `2026-09-16T10:00:00.479Z` = 18:00:00.479 Asia/Shanghai
- 19:00 conversation: `https://chatgpt.com/c/6aaa3bc2-5d90-83ea-ac3d-b28f397abdc0`
- 19:00 fixed run: `fx_061391ba3d304dea8a8d`
- first scheduled trigger: `2026-09-16T11:00:00.495Z` = 19:00:00.495 Asia/Shanghai
- interval: 86,400 seconds for both.

At production acceptance time both current tasks are `READY / enabled=true / displayStage=SCHEDULED`. Two earlier sub-second-misaligned tasks are `STOPPED` and cannot trigger.

The platform does not poll Agent activity. The 19:00 pass judges completion from project files, database state, tests and source evidence, then continues safe unfinished work directly.

The trusted production community-Agent credential is stored as a Cloudflare Worker secret and in the local macOS Keychain service `labor-transparency-community-agent`; the value is never committed or printed into project evidence.

## Production validation

Runtime: `0.8.4-rc.2`

Runtime code head: `7324d859e53e90e334d4cd3d53451c04c6a4dd00`

Production endpoints:

- primary: `https://workermanifestfellowship.dpdns.org`
- Vercel fallback: `https://workermanifestfellowship.vercel.app`
- Worker/API: `https://labor-transparency-api.labor-transparency-public.workers.dev`

Current Cloudflare Worker version receiving 100% traffic: `1f161f2f-c30b-418a-9f9e-65a8cfb73595`.

GitHub-hosted acceptance for `7324d859`:

- Release Candidate CI: `35069581626` — success;
- Production auto-research E2E: `35069581755` — success;
- Public non-Tencent deployment smoke: `35069581745` — success.

Current local deterministic gates:

- Cloudflare backend: `24/24 PASS`;
- Sites/API/UI: `25/25 PASS`;
- Python: `296/296 PASS`;
- public-smoke contract: `6/6 PASS`;
- local Worker + D1 + CSRF/CORS + community Agent + official relations + feedback + announcements + restart persistence: PASS.

An earlier Production E2E for the first EU-TED runtime commit `399e18c` failed. Subsequent fixes were deployed and the final `7324d859` Release CI, Production E2E and Public smoke all pass. The failed run is retained as evidence rather than hidden.

Remote D1 post-E2E inspection contains one real company, one real ballot, one research record, one real contribution, one public announcement and the existing advisory report. There are no QA Starbucks companies, QA feedback records or QA official relations left in production.

## Remaining boundaries

- China/global official coverage is still partial and jurisdiction-dependent.
- A source record never automatically proves misconduct, legality, labor quality or product quality outside its exact scope.
- Stable Mainland-China access SLA remains unclaimed.
- Credential/application-gated sources remain disabled until their access/reuse conditions are satisfied.
- The first scheduled 18:00/19:00 occurrences have not happened yet at the time of this acceptance record; installation/readiness is verified without falsely claiming those future scheduled runs have already executed.
