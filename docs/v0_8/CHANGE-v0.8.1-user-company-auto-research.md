# CHANGE — v0.8.1 user-added company automatic research and display

Date: 2026-09-16
ID: `LTP-V081-USER-COMPANY-AUTO-RESEARCH`
Impact: `BEHAVIOR_DELTA / CAPABILITY_DELTA`
Approval: user explicitly requested the next phase to ensure newly added companies automatically trigger information collection and display.

## Problem

The production Worker can collect multi-source company research and persist it in D1, but the original implementation only made a newly created company eligible for scheduled batches. Production acceptance then exposed a second reliability problem: the D1 `QUEUED` record was created correctly, while the Cron-based collector did not advance it within the acceptance window. A scheduled trigger is therefore retained only as a recovery/refresh signal, not as the primary executor for user-triggered research.

## Current

- `POST /api/companies` now atomically creates the company plus a durable `QUEUED` research record.
- Direct external research must not run inside the user request.
- Cron can discover eligible/stale work, but is not trusted as the primary long-running collector.
- The private research-Agent endpoint can run the batch manually.
- Raw multi-source candidates are persisted in `companyResearch` and remain review-required.
- Public company projection exposes only safe lifecycle/source/candidate previews and never raw records.

## Proposed

1. Creating a new non-synthetic company atomically creates a durable `QUEUED` research lifecycle record.
2. The create request immediately sends a compact company-id message to Cloudflare Queue `labor-transparency-company-research`; successful `send()` is returned as `researchDispatch=QUEUE_SENT`.
3. The same Worker is the Queue consumer. Consumer batch size and concurrency are both fixed to 1 so public data providers are not burst-loaded; failed messages use bounded delayed retries and then a dedicated DLQ.
4. The 5-minute and daily Cron paths only re-enqueue eligible/stale/refresh work. They no longer perform multi-source collection directly.
5. Research lifecycle remains explicit and recoverable: `QUEUED -> COLLECTING -> REVIEW_REQUIRED` or `REVIEW_REQUIRED_WITH_SOURCE_GAPS`; unexpected collection failure becomes `COLLECTION_FAILED` and remains retryable.
6. Public company projection exposes only a safe research projection: lifecycle timestamps, provider/source status, candidate counts, official source links, and bounded candidate previews. Raw source records, private Agent queue material and review-only data remain hidden.
7. UI shows automatic research progress and source-level candidate previews clearly labeled as “待核对候选”, and polls boundedly while a newly added company is queued/collecting.
8. Duplicate Queue delivery is idempotent: a completed fresh research record is ACKed as a no-op rather than re-collected.

## Why

This closes the actual user-facing loop:

`user creates company -> durable D1 QUEUED -> Cloudflare Queue -> Queue consumer collection -> persisted source outcomes -> safe public display`

without weakening the existing evidence rule that source hits are candidates rather than facts.

## Added

- Durable per-company automatic-research lifecycle state.
- Cloudflare Queue producer binding, push consumer, bounded retries and dead-letter queue.
- Direct create-time queue dispatch with D1/Cron recovery if Queue send is unavailable.
- Safe source/candidate public projection.
- User-visible progress and bounded live refresh.
- Deterministic creation-to-collection-to-display tests.

## Modified

- Company creation response includes safe research queue state.
- Research scheduler prioritization/retry behavior.
- Worker Queue handler, producer/consumer bindings, and Cron fallback routing.
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
- Cloudflare Queue producer/consumer bindings and `queue()` handler
- Cloudflare scheduled handler / Wrangler cron fallback configuration
- `companyResearch` persisted records
- Public company-card UI

## Alternatives considered

### Keep the daily batch only
Rejected: technically automatic but too slow and opaque for a newly added company.

### Perform all external research synchronously inside `POST /api/companies`
Rejected: makes user-facing company creation depend on multiple external providers and turns provider latency/outages into intake failures.

### Automatically convert exact-name source hits into company facts
Rejected: violates the project’s discovery/binding/review/publication separation and creates false-association risk.

### D1 lifecycle + Cron only
Rejected as the primary trigger after production acceptance: D1 correctly preserved `QUEUED`, but Cron did not provide the near-term user-triggered execution guarantee required here. D1 remains the source of lifecycle truth while Cloudflare Queue provides delivery/execution.

## Risks

- Queue delivery can be duplicated; lifecycle claiming must therefore remain idempotent.
- Public providers can rate-limit burst traffic; Queue consumer concurrency stays fixed at 1 and provider requests stay serial with per-source timeouts.
- Queue messages that exhaust retries move to the DLQ rather than disappearing silently.
- Source APIs can be unavailable or rate-limited; provider-level gaps must remain visible and isolated.
- Company-name matching can produce false positives; public previews must stay explicitly candidate-labeled.
- A Worker interrupted mid-collection must not remain permanently stuck; stale `COLLECTING` records must become eligible for retry.

## Migration / compatibility

Existing companies without a research record remain eligible and can be re-enqueued by the scheduled fallback. Existing completed `companyResearch` records remain readable. No D1 SQL schema migration is required because lifecycle records remain in the existing JSON collection. Production adds Cloudflare Queue resources/bindings only.

## Validation

1. Deterministic test: create company -> D1 queue record -> Queue send -> Queue consumer -> safe public projection.
2. Duplicate company creation does not create a second research record or duplicate immediate dispatch.
3. Provider failure produces a source gap while other provider results survive.
4. Public projection contains no raw `records` or source-private data.
5. Duplicate Queue delivery after completion becomes an ACK/no-op; `QUEUED` and stale `COLLECTING` are selected before ordinary refresh work.
6. UI/tests demonstrate progress plus safe candidate preview rendering contract.
7. Real local Wrangler Queue integration proves HTTP create -> `QUEUE_SENT` -> `queue()` consumer -> D1 -> safe public projection -> restart persistence.
8. Production E2E from GitHub-hosted infrastructure must prove create -> `QUEUE_SENT` -> Queue consumer -> safe `/api/companies` projection without calling the private research-Agent run endpoint.
9. Final GitHub CI and public deployment smoke remain green after deployment.

## Abort / rollback condition

Rollback Queue dispatch/consumer binding if it causes repeated duplicate collection, unexpected source load, user-facing intake latency, privacy leakage, or any weakening of candidate-vs-fact semantics. The durable D1 `QUEUED` state, scheduled re-enqueue path and authenticated manual research endpoint remain recovery mechanisms.

## Approval required

No additional approval is required for this implementation because it directly implements the user-requested capability using the existing approved research sources and privacy/evidence model. Any future automatic fact publication, new licensed source, or new sensitive/private-data processing would require a separate decision.
