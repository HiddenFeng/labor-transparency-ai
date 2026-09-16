# CHANGE v0.8.8 — Agent continuity / cold-start governance

Date: 2026-09-16
Impact: `AGENT_GOVERNANCE_DELTA`
Runtime impact: `NONE`
Status: `PASS_AGENT_CONTINUITY_GOVERNANCE`

## PROBLEM

The product had reached an accepted v0.8.8 production baseline, but a new Agent could still recover the wrong project state because continuity evidence was fragmented:

- root `HANDOFF_MANIFEST.json` still contained a v0.8.1-era `next_gate` and v0.6 integrity hashes;
- `README.md` still mixed v0.6/v0.8.2/v0.8.3 statements, including an obsolete "not publicly deployed" Python-production section;
- `qa/v0_8/verification.json` is a cumulative evidence ledger, so older candidate sections precede the current accepted v0.8.8 section;
- `agents/PROJECT_MANAGER_AGENT.md` did not route a cold-start Agent through v0.8.6-v0.8.8 history;
- there was no single live artifact explaining the user's goal, requirement evolution, current truth, recurring failure modes and governance write-back rules.

This created a real continuity risk: an Agent could restart planning, reactivate superseded deployment gates, treat historical gaps as current blockers, or repeat already-fixed semantic errors.

## CURRENT

Current product/runtime truth remains the accepted v0.8.8 baseline. This change does not alter user-facing product behavior, evidence semantics, deployment architecture, source binding, privacy boundaries, daily operations or release acceptance.

## PROPOSED

Create one live `PROJECT_CONTINUITY.md` as the cold-start router and project cognition summary, then make existing governance files point to it. Preserve the old handoff manifest only as archived integrity/history, not current state.

Every substantive Agent round must update the existing canonical artifact appropriate to the change; Agents must not create parallel memory/TODO/governance systems.

## ADDED

- `PROJECT_CONTINUITY.md` containing:
  - root purpose / final objective;
  - requirement evolution and the reasons for each major architecture change;
  - current accepted production snapshot and architecture;
  - evidence/data lane semantics;
  - protected capabilities and privacy/commercial boundaries;
  - recurring historical failures and their prevention rules;
  - current blockers/gaps/NEXT_GATE;
  - cold-start procedure and project-document write-back matrix.
- mandatory cold-start takeover protocol in `AGENTS.md`.
- CI governance regression test that checks the continuity pointer/version/current-release routing.

## MODIFIED

- `README.md` current-state header and handoff routing;
- `agents/PROJECT_MANAGER_AGENT.md` recovery inputs;
- optional local `HANDOFF_MANIFEST.json`, when present, reduced to a pointer rather than a competing state summary;
- `.github/workflows/ci.yml`, adding the continuity regression test to the web candidate gate.

## REMOVED / ARCHIVED

No historical evidence is deleted. On this Mac, the former ignored local handoff manifest is moved to ignored local `archive/HANDOFF_MANIFEST_v0_6_integrity.json` and replaced by a pointer. These local compatibility files are not required in a fresh Git clone; versioned `PROJECT_CONTINUITY.md` is the canonical continuity source.

## WHY

Conversation memory is not project truth. A long-running Agent-managed project needs a cold-start path that lets a fresh Agent reconstruct current purpose, accepted state and next safe action without trusting stale prose or old chat history.

The design deliberately uses one live continuity summary plus existing evidence/change/source documents rather than copying the whole project into another governance framework.

## PRESERVED_CAPABILITIES

All current product capabilities and invariants in `AGENTS.md`, including:

- non-commercial public-interest scope;
- E0 discussion and popularity/evidence separation;
- evidence/source lane separation;
- fail-closed automated research without named-human production dependency;
- China source-specific exact binding rules;
- anonymous-advisory privacy boundaries;
- Vercel + Cloudflare canonical production and Tencent/EdgeOne historical-only policy;
- post-deploy manual production auto-research E2E and exact QA cleanup;
- 18:00/19:00 daily Agent operating contract.

## AFFECTED_CONTRACTS

Agent recovery, project continuity, documentation governance and CI documentation integrity only. No public API or D1 schema change.

## ALTERNATIVES_CONSIDERED

1. Keep using `HANDOFF_MANIFEST.json` as the current state file — rejected because it contains a large historical integrity hash map and had already accumulated stale current fields.
2. Put all state in `qa/v0_8/verification.json` — rejected because that file is an evidence ledger containing many historical candidate sections, not a readable user-intent/decision map.
3. Make every Agent read the entire repository/history — rejected as slow, error-prone and likely to over-weight old facts.
4. Create a new task database/spec framework — rejected as duplicate governance. Existing AGENTS/change/QA/source/daily structures are sufficient.

## RISKS

- The continuity file can itself become stale if Agents do not update it after accepted semantic/release/NEXT_GATE changes.
- Over-detailed continuity can become another duplicate documentation tree.

Mitigation: continuity stores routing/current cognition only; detailed evidence remains in QA/change/source/history files. CI checks key version/release pointers, and `AGENTS.md` makes continuity write-back mandatory when current state actually changes.

## MIGRATION_OR_COMPATIBILITY

No runtime migration. Existing historical documents remain readable. On workspaces that still have the ignored local `HANDOFF_MANIFEST.json`, it redirects to `PROJECT_CONTINUITY.md` and the current evidence ledger; fresh clones use the versioned continuity file directly.

## VALIDATION

Required before marking this change accepted:

1. continuity test passes and verifies runtime version + current release pointers;
2. when the ignored local `HANDOFF_MANIFEST.json` exists, it parses, is pointer-only and points to existing current files; fresh-clone validation does not depend on it;
3. `git diff --check` passes;
4. a cold-start audit using only `AGENTS.md` + `PROJECT_CONTINUITY.md` + routed current evidence can answer: project purpose, current accepted state, protected invariants, historical traps, current NEXT_GATE and next safe action;
5. current canonical `/api/config` remains `0.8.8-rc.1` and this docs/governance-only change makes no production claim beyond the already accepted runtime.

Validation result on 2026-09-16:

- `node --test scripts/project_continuity.test.mjs` — 3/3 PASS;
- same continuity test with the ignored local `HANDOFF_MANIFEST.json` temporarily absent — 3/3 PASS, proving fresh-clone mode does not depend on the local handoff;
- `node --test scripts/deployment/public_smoke.test.mjs` — 9/9 PASS;
- `git diff --check` — PASS;
- deterministic cold-start content check — PASS for purpose/current runtime/NEXT_GATE/recurring-errors/governance-writeback/fixed-takeover-instruction sections;
- canonical browser `/api/config` during recovery — `0.8.8-rc.1`, `CLOUDFLARE_WORKER_D1`, expected core capability flags, zero page/network/console errors.

## ABORT_OR_ROLLBACK_CONDITION

Rollback if the new continuity layer contradicts current accepted v0.8.8 evidence, causes two competing current-state sources, deletes historical evidence, or makes cold-start recovery less deterministic.

## APPROVAL_REQUIRED

User explicitly requested a fixed cross-conversation takeover instruction and durable Agent/project governance so any fresh Agent can recover the project's full state and continue work. No additional product-semantic approval is required for this governance-only implementation.
