# v0.8.3 — Usable company dossiers and region-adapted unattended research

Date: 2026-09-16

Status: `PASS_PRODUCTION_USABLE_COMPANY_DOSSIERS`

## Product problem

v0.8.2 proved that a newly created company could be queued, researched, trust-classified, refreshed and recovered without a named operator. That was necessary but not sufficient for normal visitors: the company list still exposed too much provider/debug detail, there was no coherent company-detail interaction, and non-US companies were sent through US-only sources. A real Chinese company such as `星宇股份有限公司` therefore had a technically healthy research record but almost no useful public context.

v0.8.3 changes the release criterion from “the research queue completes” to “a visitor can understand what the system knows, what it only suspects, what remains unknown, and where each statement comes from.”

## Public dossier model

The public product keeps these tiers distinct:

- `MACHINE_VERIFIED_REFERENCE`: narrow, fail-closed source-of-record reference fields. The existing GLEIF legal-identity rule remains strict; this tier is not widened for usability.
- `OPEN_KNOWLEDGE_CONTEXT`: bounded structured context from Wikidata. It may bind only through deterministic context rules and is never treated as legal identity, a legal finding, or a quality rating.
- `SOURCE_SIGNAL`: bounded source-level signal whose wording preserves the upstream record's procedural meaning.
- `SOURCE_EVENT_CANDIDATE`: allowlisted public-record timeline entry. Only event date/range, title, location, status, bounded detail/reference/link and the provider-specific caveat are public; raw provider records stay restricted.
- `CONTEXT_CANDIDATE`: ambiguous or unbound contextual result. It may be useful to the visitor but is explicitly not selected as fact.
- community feedback and user contributions remain separate from every automatic tier.

Dossier readiness is summarized as `REFERENCE_READY`, `CONTEXT_READY`, `SIGNALS_READY`, or `LIMITED_DATA`, with explicit gaps, freshness and source coverage.

## Region applicability

Research now runs source adapters only where they are applicable. GLEIF and Wikidata are global adapters. SEC EDGAR, NLRB, OSHA, DOL WHD, FMCS, OLMS and USAspending are currently US-only adapters. For a non-US company these providers are stored as `NOT_APPLICABLE / US_ONLY_SOURCE`; that state is not counted as a success, an error, or evidence that no record exists.

This removes misleading “9 successful US sources with zero results” behavior for Chinese and other non-US companies and reduces unnecessary third-party requests.

## Multilingual open context

Wikidata discovery now uses the company's region to choose a primary language and retains an English fallback. Search variants are bounded and deterministic: full input, a company-form-preserving shorthand such as `股份有限公司 -> 股份`, and a stripped name where useful. Hydration is allowlisted to public structured context such as description, official website, inception, industry, headquarters, parent organization, products/output, exchange, legal form and public encyclopedia link.

An `OPEN_KNOWLEDGE_CONTEXT` may be selected only if exactly one candidate satisfies one of these rules:

1. exact company name + matching country;
2. user-provided public website domain == Wikidata official website domain;
3. unique corporate-shorthand result + matching country + explicit organization-structure signals (official website plus at least one of legal form, industry, exchange, headquarters or product/output).

Rule 3 is deliberately `LOW_MEDIUM` confidence and carries a visible caveat that it identifies a possible corresponding open-knowledge entry, not a confirmed legal entity.

## Company detail product

`GET /api/companies/:id` returns a safe public dossier combining:

- company container fields;
- independent community positive/negative/participant counts;
- the safe automatic research projection;
- grouped public contributions (`products`, `companyFacts`, `relationships`, `labourClaims`, `productClaims`);
- freshness and an explicit evidence boundary.

The public UI adds a shareable `#company/<id>` company-detail dialog. The company list now shows a concise dossier teaser instead of provider/debug output. The detail interaction shows community voice, automatic evidence tiers, open context, event timeline, source provenance, gaps/unknowns, public contributions and update freshness in separate sections. Responsive CSS turns the dialog into a single-column full-screen interaction on small screens.

## Unattended refresh and product observability

The autonomous policy version is `auto-intelligence-0.8.3`; runtime is `0.8.3-rc.1`. Existing v0.8.2 records therefore become immediately refresh-eligible without a private/manual research call. The dossier exposes `INITIAL / UPDATED / UNCHANGED` refresh state.

`/api/research/status` now reports not just queue health, but product usefulness: dossier-ready count, limited-dossier count, machine reference fields, open-context bindings, source signals, public event candidates, source errors and region-not-applicable counts.

The public semantic smoke contract is extended to select an existing non-synthetic company and validate `/api/companies/:id`, current policy version, dossier status, community separation, grouped contributions and the absence of restricted fields.

## Current pre-production evidence

Deterministic/local:

- Cloudflare autonomous research / Queue / DLQ tests: `24/24 PASS`.
- Sites/API/UI tests: `21/21 PASS`.
- Python full suite: `291/291 PASS`.
- local Worker + D1 / CORS / CSRF / concurrent writes / restart persistence: `PASS`.
- frontend build + privacy audit: `PASS / 0 forbidden matches`.
- public-smoke validator unit tests: `6/6 PASS`.

Real-source local Wrangler + D1 + Queue:

- Starbucks Corporation progressed through the normal Queue path to `AUTO_READY_WITH_SOURCE_GAPS`.
- policy: `auto-intelligence-0.8.3`.
- dossier: `REFERENCE_READY`.
- machine reference facts: `6`.
- source signals: `4`.
- safe public-record event candidates: `24`.
- detail endpoint: `PASS`.
- restart persistence: `PASS`.
- current source gaps in that run: Wikidata timeout, SEC access denied, USAspending network/runtime error. These remain explicit source gaps rather than invalidating successful sources.

Real non-US source probe:

- input: `星宇股份有限公司 / 中国`, no website supplied.
- applicable source successes: `2` (GLEIF + Wikidata); US-only providers: `9 NOT_APPLICABLE`; source errors: `0` in the successful probe.
- legal identity remains `NO_VERIFIED_REFERENCE`.
- Wikidata corporate shorthand `星宇股份` returns `Q106240022 常州星宇车灯股份有限公司`.
- the unique shorthand + China match + organization signals produce `OPEN_KNOWLEDGE_CONTEXT / LOW_MEDIUM`, not a legal-identity fact.
- bounded public context includes the Wikidata description, 1993 inception, `股份有限公司`, `中华人民共和国`, headquarters context, manufacturing industry, automotive-lighting products/output, Shanghai Stock Exchange context, xyl.cn and encyclopedia/source links.

A local browser deep-link dossier using that real-source record displayed the existing negative community feedback, open context, public contribution, gaps and region applicability with zero page/console/network errors. AgentDock did not conclusively provide a true narrow mobile viewport in the attached external browser, so responsive behavior is currently covered by CSS/UI contracts rather than claimed as production mobile-browser evidence.

## Production acceptance

The production gate was closed on 2026-09-16 against runtime commit `bb6ff338ffe3bcf6723d65d2dd5f89b97d1c437b` on the canonical non-Tencent stack. Acceptance required all of the following:

1. candidate GitHub CI passes;
2. the exact clean candidate commit is deployed to Cloudflare Worker/D1/Queue and the canonical Vercel project;
3. the existing real company record self-migrates to `auto-intelligence-0.8.3` without a private research run, while preserving its real community feedback;
4. production browser validation confirms the company list/detail product and evidence wording;
5. GitHub-hosted production E2E validates Queue -> dossier -> event timeline -> company-detail API -> normal ballot mutation;
6. QA company/research/ballot rows created by the E2E are precisely removed after evidence capture;
7. final release CI and public semantic smoke pass.

### Acceptance evidence

All seven conditions above passed. GitHub-hosted evidence for the exact runtime commit is:

- release-candidate CI: run `35056094843` — PASS;
- production Queue/dossier E2E: run `35056094846` — PASS;
- public non-Tencent semantic smoke: run `35056094856` — PASS.

The existing non-QA production company `星宇股份有限公司 / 中国` self-migrated to `auto-intelligence-0.8.3` through normal scheduled refresh/Queue processing. Its current machine state is `AUTO_READY / CONTEXT_READY`; strict legal identity remains `NO_VERIFIED_REFERENCE`, while the bounded open-context reference is `Q106240022 常州星宇车灯股份有限公司` through `UNIQUE_CORPORATE_SHORTHAND_AND_COUNTRY`. Its existing real community ballot remains present. Canonical-browser validation opened the public `#company/<id>` dossier and showed the open-context official website, encyclopedia link and Wikidata provenance with zero console/network/page errors.

Post-E2E remote D1 inspection found zero QA company/research/ballot rows and preserved the non-QA company plus its ballot. The machine-readable acceptance artifact is `qa/v0_8/usable-company-dossiers-v083-production.json`.

This acceptance does **not** widen the claim boundary: global source coverage is still partial, open-knowledge context is not official legal identity, event candidates do not establish misconduct/liability/company-wide labor conditions, and no stable Mainland-China availability SLA is claimed.
