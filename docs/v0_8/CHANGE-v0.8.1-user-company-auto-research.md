# CHANGE — v0.8.1 user-added company automatic research and display

Date: 2026-09-16
ID: `LTP-V081-USER-COMPANY-AUTO-RESEARCH`
Impact: `BEHAVIOR_DELTA / CAPABILITY_DELTA`
Approval: user explicitly requested the next phase to ensure newly added companies automatically trigger information collection and display.

## Problem

The current production Worker can collect multi-source company research and persist it in D1, but a newly created company only becomes implicitly eligible for the existing daily batch. Users can therefore create a company and see “first research not completed” without a durable queue state, near-term automatic execution, or useful source-level public feedback. Existing public company cards expose only aggregate candidate/error counts.

## Current

- `POST /api/companies` creates the company only.
- The scheduled research batch selects unresearched/oldest companies, currently on the daily Worker cron.
- The private research-Agent endpoint can run the batch manually.
- Raw multi-source candidates are persisted in `companyResearch` and remain review-required.
- Public company projection exposes only research status/counts and never raw records.

## Proposed

1. Creating a new non-synthetic company atomically creates a durable `QUEUED` research lifecycle record.
2. A dedicated frequent Worker cron consumes queued companies automatically; the existing daily cron remains a bounded fallback/refresh path.
3. Research lifecycle becomes explicit and recoverable: `QUEUED -> COLLECTING -> REVIEW_REQUIRED` or `REVIEW_REQUIRED_WITH_SOURCE_GAPS`; unexpected collection failure becomes `COLLECTION_FAILED` and remains retryable.
4. Selection prioritizes queued/unresearched work, retries stale failed/collecting work, and avoids re-collecting completed companies on every frequent cron.
5. Public company projection exposes only a safe research projection: lifecycle timestamps, provider/source status, candidate counts, official source links, and bounded candidate previews. Raw source records, private Agent queue material and review-only data remain hidden.
6. UI shows automatic research progress and source-level candidate previews clearly labeled as “待核对候选”, and polls boundedly while a newly added company is queued/collecting.
7. Duplicate company creation stays idempotent and must not fan out duplicate automatic research work.

## Why

This closes the actual user-facing loop:

`user creates company -> durable automatic queue -> scheduled collection -> persisted source outcomes -> safe public display`

without weakening the existing evidence rule that source hits are candidates rather than facts.

## Added

- Durable per-company automatic-research lifecycle state.
- Dedicated scheduled consumer for newly queued research.
- Safe source/candidate public projection.
- User-visible progress and bounded live refresh.
- Deterministic creation-to-collection-to-display tests.

## Modified

- Company creation response includes safe research queue state.
- Research scheduler prioritization/retry behavior.
- Worker cron routing and production cron configuration.
- Company-card research presentation.
- Global public research-status counts.

## Removed

Nothing. Existing authenticated research-Agent execution and daily research fallback remain available.

## Preserved capabilities / invariants

- Candidate discovery is not fact publication.
- Community heat remains independent of evidence grade.
- Raw candidate records do not enter ordinary public company/API projections.
- Independent entity binding/review remains required before a source candidate can support a company fact.
- Existing Origin/CSRF/Cookie/privacy controls remain unchanged.
- Missing/failed research never blocks the company discussion space or anonymous assistance.
- Research stays bounded per run and failure is represented explicitly rather than fabricated as success.

## Affected contracts

- `POST /api/companies`
- `GET /api/companies`
- `GET /api/research/status`
- Cloudflare scheduled handler / Wrangler cron configuration
- `companyResearch` persisted records
- Public company-card UI

## Alternatives considered

### Keep the daily batch only
Rejected: technically automatic but too slow and opaque for a newly added company.

### Perform all external research synchronously inside `POST /api/companies`
Rejected: makes user-facing company creation depend on multiple external providers and turns provider latency/outages into intake failures.

### Automatically convert exact-name source hits into company facts
Rejected: violates the project’s discovery/binding/review/publication separation and creates false-association risk.

### Introduce a new external queue service
Deferred: a D1-backed lifecycle plus Worker scheduled consumer is sufficient for the present scale and avoids new infrastructure.

## Risks

- Frequent research scheduling increases outbound requests; completed records therefore need refresh intervals instead of running on every tick.
- Source APIs can be unavailable or rate-limited; provider-level gaps must remain visible and isolated.
- Company-name matching can produce false positives; public previews must stay explicitly candidate-labeled.
- A Worker interrupted mid-collection must not remain permanently stuck; stale `COLLECTING` records must become eligible for retry.

## Migration / compatibility

Existing companies without a research record remain eligible and will be queued/claimed by the scheduler. Existing completed `companyResearch` records remain readable. No D1 SQL schema migration is required because records are stored in the existing collection JSON envelope.

## Validation

1. Deterministic test: create company -> queue record -> automatic background/scheduled research -> safe public projection.
2. Duplicate company creation does not create a second research record or duplicate immediate dispatch.
3. Provider failure produces a source gap while other provider results survive.
4. Public projection contains no raw `records` or source-private data.
5. `QUEUED` and stale `COLLECTING` are selected before ordinary refresh work.
6. UI/tests demonstrate progress plus safe candidate preview rendering contract.
7. Cloudflare Worker+D1 local integration and full existing regression remain green.
8. Final GitHub CI and public deployment smoke remain green after deployment.

## Abort / rollback condition

Rollback the automatic trigger/cron frequency if it causes repeated duplicate collection, unexpected source load, user-facing intake latency, privacy leakage, or any weakening of candidate-vs-fact semantics. The previous daily/manual research path remains the safe fallback.

## Approval required

No additional approval is required for this implementation because it directly implements the user-requested capability using the existing approved research sources and privacy/evidence model. Any future automatic fact publication, new licensed source, or new sensitive/private-data processing would require a separate decision.
