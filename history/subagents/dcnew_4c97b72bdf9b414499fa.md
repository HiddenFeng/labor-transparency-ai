# Work record — dcnew_4c97b72bdf9b414499fa

## Objective and scope

Cold-start take over `/Users/wt/Downloads/labor_transparency_v0_6` from repository/runtime evidence, verify the accepted Reference production and current operations state, prioritize any real feedback/privacy/security/core-path/daily-operation issue, and otherwise avoid manufacturing a new version/framework/collector. Preserve all `AGENTS.md` evidence-lane, privacy, Queue/Cron, production-E2E and exact-cleanup invariants.

## Authoritative/current material inspected

- `AGENTS.md`
- `PROJECT_CONTINUITY.md`
- `qa/v0_8/verification.json`, especially `candidate_v090_phase_o_reference_production_acceptance`
- `docs/v0_8/CHANGE-federated-public-interest-network-and-product-labor-signals.md`
- `docs/v0_8/RELEASE-CANDIDATE-v0.9.0-rc.1.md`
- current Git branch/HEAD/worktree and runtime package manifests
- `scripts/project_continuity.test.mjs`
- `scripts/public_release_readiness.mjs`
- canonical Reference production `/`, `/api/config`, `/api/companies`, `/api/research/health`
- aggregate-only `scripts/community_agent/community_api.py state`
- LocalAgentRuntime `/healthz` and `/api/lightweight-tasks`

## Recovered current truth

- Git root: `/Users/wt/Downloads/labor_transparency_v0_6`; branch `main`; HEAD/origin-main `ba858bc0a24bac0eedb0d4c0098b777093946480` before this request's edits.
- Runtime packages: `sites-app=0.9.0-rc.1`, `cloudflare-backend=0.9.0-rc.1`; local Node `v22.22.1`.
- Latest accepted production evidence remains `PASS_DEPLOYED_BROWSER_SMOKE_MANUAL_E2E_EXACT_CLEANUP_V090`, accepted Reference production `0.9.0-rc.1`, accepted release head `93222cba64a203dd72d7d7b4ac57274f70c6ffea`, next gate `REAL_USER_OR_OPERATIONS_EVIDENCE_FIRST`.
- Live canonical config independently reports `0.9.0-rc.1 / CLOUDFLARE_WORKER_D1`, expected core capabilities, `attachments=false`, `privateSensitiveInfo=false`, with zero page/network/console errors on the AgentDock browser path.
- Live research health is `HEALTHY`: 2 real companies / 2 research records, no missing/stale/failed/dead-letter/source-gap records, Queue and scheduled recovery enabled.
- `富士康` remains `AUTO_READY / CANDIDATES_ONLY`, `exactNameCandidateCount=0`, `NO_VERIFIED_REFERENCE`; related/open-knowledge/GLEIF matches remain candidates, preserving fail-closed subject binding.
- Aggregate community state has 2 companies, `pendingFeedback` count 0 and official reference/relation/event counts `0/0/0`; no private feedback body or credential was copied into this record.
- Current fixed tasks `fx_0ae10ddc598947738441` and `fx_061391ba3d304dea8a8d` are enabled, unblocked `WAITING_NEXT_RUN`, requested/effective next runs anchored to 2026-09-18 18:00 and 19:00 Asia/Shanghai respectively. Recent persisted phase 18/19 daily runs are `COMPLETED`.
- Canonical homepage smoke exposed the expected worker-facing paths, Phase O product/labor-signal entry and Mainland-China external resource links without browser errors.

## Real issue found and repair

A current continuity/evidence-routing inconsistency was found. `PROJECT_CONTINUITY.md` explicitly says cold-start conclusions use the latest accepted QA section together with the QA top-level `next_gate` / `strongest_claim`, but those two top-level fields still described the pre-acceptance v0.8.8 state and `REFERENCE_PRODUCTION_RELEASE_GATE` while `candidate_v090_phase_o_reference_production_acceptance` already recorded accepted v0.9.0 and `REAL_USER_OR_OPERATIONS_EVIDENCE_FIRST`.

Impact classification: implementation-only governance/evidence-routing correction; no product/runtime/data/evidence-lane semantics changed.

CURRENT -> top-level QA current-route fields stale behind the accepted v0.9 production section.

PROPOSED -> synchronize only top-level `next_gate` and `strongest_claim` to the latest accepted production section and add one deterministic continuity regression that fails if they diverge again.

PRESERVE -> all historical QA/candidate/failed evidence; accepted production evidence itself; product behavior; privacy/security boundaries; evidence lanes; Queue as main new-company path; Cron recovery/refresh; manual post-deploy production E2E; exact QA cleanup rules; current `PROJECT_CONTINUITY.md` and `AGENTS.md` invariants.

ROLLBACK / ABORT CONDITION -> do not rewrite historical QA evidence or acceptance criteria; abort/revert this routing correction if the latest production-acceptance section is not the accepted authority or if current continuity/release-readiness no longer identifies v0.9.0-rc.1 as accepted production.

Modified:
- `qa/v0_8/verification.json`: top-level `next_gate` and `strongest_claim` now match the latest accepted v0.9 production section.
- `scripts/project_continuity.test.mjs`: added a current-QA-summary consistency regression.

## Decisive validation

- `node scripts/project_continuity.test.mjs` -> `4/4 PASS`; the new QA-summary/current-acceptance route check passes.
- `node scripts/public_release_readiness.mjs` -> `PUBLIC_GOVERNANCE_READY_ACCEPTED_PRODUCTION`, accepted `v0.9.0-rc.1`, `productionAcceptancePassed=true`, failures `[]`, `nextGate=REAL_USER_OR_OPERATIONS_EVIDENCE_FIRST`; Docker container E2E remains the bounded external Docker Hub pull gap.
- direct QA parse/compare -> `next_gate_equal=True`, `strongest_claim_equal=True`.
- `git diff --check` -> PASS.
- The four request-local changes were isolated from the pre-existing concurrent dirty work and integrated as the local commit `fix: align current QA acceptance routing`; an independent detached clean checkout of that commit repeated the continuity `4/4`, release-readiness, QA-route equality and diff checks successfully.

## Current conclusion / unresolved / next

The highest-value concrete issue found during takeover was the stale QA current-route summary; it is repaired locally with a regression guard. No real user feedback, privacy/security incident, production/core-path failure, Queue problem, scheduled-operation blocker, or newly verified high-value coverage gap is currently evidenced. Therefore no new version, source collector, framework, production deployment or production data mutation is justified by this round.

Known non-blocking gaps remain those already recorded by `PROJECT_CONTINUITY.md`: real Docker container build/run, public external federation/mirror operations, Mainland-China stable-access SLA, source-by-source redistribution clearance for additional federation lanes, and trustworthy anti-Sybil cross-instance worker/community aggregation.

Next operational gate remains `REAL_USER_OR_OPERATIONS_EVIDENCE_FIRST`, including today's existing 18:00/19:00 Asia/Shanghai operations. No project goal, invariant or runtime acceptance state changed.
