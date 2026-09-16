# CHANGE — v0.8.2 autonomous company intelligence

Date: 2026-09-16
ID: `LTP-V082-AUTONOMOUS-COMPANY-INTELLIGENCE`
Impact: `BEHAVIOR_DELTA / CAPABILITY_DELTA`
Approval: user explicitly requires the project to operate without a named human/operator and asks the automatic collection chain to become fully automated.

## PROBLEM

Production already performs `company create -> D1 QUEUED -> Cloudflare Queue -> multi-source candidate collection -> safe candidate display`, but it still stops semantically at `REVIEW_REQUIRED*`. The legacy Python path additionally requires manual identity/source binding and a named independent reviewer before publication. That is incompatible with a project whose normal operation must not depend on a specific person.

## CURRENT

- Production collection and retry are automatic.
- Source hits remain bounded candidates and are safely visible.
- No production machine fact layer exists beyond candidate previews.
- Manual Python review is an offline back-office path and is not suitable as a production availability dependency.

## PROPOSED

Production gains a deterministic autonomous trust layer computed on every successful collection. It never guesses through ambiguity. Instead it classifies information into three public trust tiers:

1. `MACHINE_VERIFIED_REFERENCE` — narrow objective reference facts automatically supported by a unique exact authoritative match under explicit identity/region rules. Initial source: GLEIF legal-entity reference data; SEC exact-name reference may be linked only when compatible with an already machine-bound US identity.
2. `SOURCE_SIGNAL` — an authoritative/public source returned records under an exact normalized organization/employer name, but entity-level attribution or legal meaning is not strong enough for a company fact. It may state only that the source contains matching records/counts and must retain procedural caveats.
3. `CONTEXT_CANDIDATE` — ambiguous, secondary, partial or conflicting candidates. These remain candidates/unknown and are never silently promoted.

No human approval is required for the normal production path. Ambiguity is handled by non-publication/downgrade rather than waiting for a reviewer.

## ADDED

- Automatic GLEIF identity decision: exactly one exact legal-name match **and** a usable country hint from the submitted region that agrees with the GLEIF legal-address country -> machine-bound reference identity. Missing country hint, multiple exact matches, or country conflict -> ambiguous/candidate-only.
- Automatic SEC reference linking only under compatible machine-bound US identity and a unique exact SEC name candidate.
- Automatic source-signal aggregation for labor/public-record providers using exact normalized organization-name matches without turning cases/inspections/notices into misconduct conclusions.
- Deterministic de-duplication and stable fingerprints.
- Autonomous output states `AUTO_READY` / `AUTO_READY_WITH_SOURCE_GAPS` and `reviewRequired=false` for the production record.
- Recompute-on-refresh semantics: facts/signals disappear or downgrade automatically when current sources no longer support them.
- Public machine-intelligence projection with explicit tier, confidence class, source, scope and caveat.
- Public `/api/research/health` plus health/observability fields for missing research, stale queue/collection leases, retry-eligible failures, machine-intelligence coverage/conflicts and latest successful collection.

## MODIFIED

- Company research completion no longer means “wait for a named reviewer” in production.
- Public company cards separate machine-verified references, source signals, contextual candidates and community opinion.
- Queue refresh is authoritative: each completed run replaces the previous machine-derived intelligence rather than accumulating stale assertions.
- Legacy Python binding/review remains available for offline audit/research but is not required for website operation.

## REMOVED

- Named human/operator approval as a required production step for bounded machine-derived company intelligence.
- Any implication that ambiguous candidates must be manually resolved before the company page can remain useful.

## PRESERVED_CAPABILITIES

- Search hits are not automatically converted into broad company claims.
- Community popularity remains separate from evidence strength.
- NLRB/OSHA/WHD/FMCS/OLMS records retain their procedural/event-specific meaning.
- Missing source data remains unknown, not “none exists”.
- Raw provider records, private queues, tokens and review-only material remain non-public.
- Exact Origin/CSRF/Cookie/privacy/deployment boundaries remain unchanged.
- Optional human/offline audit may still inspect machine output, but production does not wait for it.

## AFFECTED_CONTRACTS

- `companyResearch` lifecycle and persisted record shape.
- `GET /api/companies` safe research projection.
- `GET /api/research/status` aggregate counts and new `GET /api/research/health` autonomous-operations health contract.
- Company-card UI language and evidence presentation.
- Queue refresh/retry semantics and production E2E acceptance.

## ALTERNATIVES_CONSIDERED

### Auto-publish every exact-name candidate
Rejected. Exact names can collide across subsidiaries, establishments and legal entities, and several labor sources describe events rather than legal conclusions.

### Keep human review as the final gate
Rejected for the production normal path because it creates a named-operator dependency contrary to the project operating model.

### Use an LLM as the factual authority
Rejected. The initial autonomous publication rule is deterministic and source-bounded so results are reproducible, testable and retractable. Models may later improve summarization only if they cannot widen the underlying evidence scope.

## RISKS

- Exact legal names can still collide; unique authoritative match and country compatibility reduce but do not eliminate that risk. Public wording therefore remains “reference identity”, not omniscient entity resolution.
- Public-record name matches can refer to establishments/subsidiaries. They remain `SOURCE_SIGNAL`, not machine-verified misconduct facts.
- Source outages can temporarily remove support. Recompute-on-refresh must downgrade rather than preserve stale certainty.
- Bad provider schema changes can generate malformed candidates; fail closed and expose a source gap.

## MIGRATION_OR_COMPATIBILITY

No SQL migration is required; D1 stores JSON collection records. Existing completed records without the current autonomous-policy output are automatically considered refresh-eligible, so migration does not depend on a person explicitly re-enqueuing them. Old clients tolerate the added `intelligence` object and status strings; UI/tests are updated in the same release.

## VALIDATION

1. Deterministic exact-match + country-agreement, missing-country, ambiguity and country-conflict tests.
2. Duplicate candidates/events collapse to stable machine facts/signals.
3. Refresh removes previously supported machine facts when support disappears.
4. Source failures preserve successful results and lower status to source-gap without creating false facts.
5. Public projection contains no raw records/private fields.
6. Worker+D1+Queue end-to-end proves no reviewer/operator call is required.
7. Production E2E uses a real company create and verifies machine-intelligence output; QA rows are removed afterward.
8. Existing real interactions are observed after deployment and defects are repaired before declaring completion.

## ABORT_OR_ROLLBACK_CONDITION

Rollback automatic publication if it produces cross-entity attribution, turns procedural records into legal/quality conclusions, leaks restricted fields, fails to retract unsupported facts, or creates an availability dependency worse than the current candidate-only system. Candidate collection/display remains the safe fallback.

## APPROVAL_REQUIRED

No additional approval is required for this change: it directly implements the user’s explicit no-human-operator requirement while preserving the project’s evidence/privacy invariants. Expanding to sensitive/private data, paid/licensed sources, legal conclusions, or automated external complaints would require a separate decision.
