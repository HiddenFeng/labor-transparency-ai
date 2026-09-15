> **Historical v0.7.2 artifact. v0.8 production no longer uses ChatGPT Sites. See `DEPLOYMENT_HANDOFF.md`.**

# Historical ChatGPT Sites handoff — superseded by v0.8 independent deployment

> This file is retained as project history. Production direction changed after v0.7.2: use `DEPLOYMENT_HANDOFF.md` plus `docs/v0_8/` for the current Cloudflare Worker/D1 + independent static-frontend architecture. Do not use this document as the current deployment plan.

Status: `SITES_READY_LOCAL_VERIFIED` after the accompanying QA gates pass. This is a deployment handoff, **not** a claim that a ChatGPT Site or its database/scheduler has already been created.

## Recommended Sites task

Use `sites-app/` as the authoritative v0.7.2 source. Preserve `src/domain.mjs` behavior, the v0.7.2 worker-facing public information architecture, the curated case/resource source boundaries and the anonymous-advisory privacy boundary. Adapt only runtime-specific storage, identity, privileged roles and scheduling to capabilities actually exposed by the current ChatGPT Sites environment.

Suggested instruction to Codex/Sites:

> Import Labor Transparency v0.7.2 from this directory as a lightweight full-stack ChatGPT Site. Preserve the public-facing design and content hierarchy: worker pain points and three primary actions first, then rights guidance, sourced public cases, external official/union resource navigation, company/community views, and plain-language evidence explanations. Preserve evidence-vs-popularity separation, correction/withdrawal rules, rights review and the anonymous-advisory boundary exactly. Do not replace the public UI with a generic developer dashboard. Replace local FileStore with a Sites-supported persistent DB/storage layer while keeping transactional revision semantics. Use Sign in with ChatGPT for stable users if available; otherwise retain anonymous same-site identity. Keep evidence review, redistribution review and advisory-Agent processing as three restricted operator capabilities and never expose credentials to visitors. The advisory form may store only de-identified non-sensitive text; do not add names, private contact fields, ID documents, detailed home addresses, health/payment data or file uploads. Store only a hash of each anonymous receipt code. Keep `public/editorial-content.js` links and case summaries as curated educational content: listing an organization is not a partnership, and a news/case item must not automatically become a project evidence record. Map the daily advisory runner to a Sites-supported scheduled/background mechanism if one is actually available; otherwise expose a restricted finite operator action and mark scheduling as not installed. First deploy privately and replay the complete company → ballot → contribution → review → redistribution → correction → re-review → anonymous advisory → Agent advice → public aggregate report → restart/persistence flow before public launch.

## Runtime mapping

| Local candidate | Sites target |
| --- | --- |
| `src/domain.mjs` | Keep as canonical domain/privacy rules |
| `FileStore` JSON file | Replace with Sites-supported persistent DB/storage |
| `state.revision` | Transaction or optimistic compare-and-swap guard |
| anonymous cookie owner hash | Prefer Sign in with ChatGPT Site user ID if available; otherwise secure anonymous identity |
| `LTP_SITES_REVIEW_TOKEN` | Owner/operator evidence-review role |
| `LTP_SITES_EXPORT_TOKEN` | Separate privacy/rights redistribution-review role |
| `LTP_SITES_ADVISORY_AGENT_TOKEN` | Separate advisory Agent/operator role |
| `scripts/advisory-agent.mjs` | Sites scheduler/background action if supported; otherwise restricted finite action |
| `public/` | Sites frontend assets |
| Node HTTP routes | Translate to supported Sites server/API pattern if required |
| Python GLEIF back office | Keep external/back-office until a supported network research runtime is intentionally integrated |

## Data contract

Persist these logical collections:

- `companies`
- `contributions`
- `reviews`
- `exportReviews`
- `ballots`
- `flags`
- `advisoryCases`
- `advisoryAdvice`
- `advisoryDailyReports`

For `advisoryCases`, the database stores only `receiptHash`, never the plaintext `ADV-...` receipt. The plaintext receipt is returned once to the submitter. A valid receipt is a bearer credential and must not appear in URL query strings, public logs, analytics or public daily reports.

## Access rules that must survive porting

1. Anyone may read public company/contribution/showcase/research-coverage and advisory aggregate-report data.
2. A visitor may edit/withdraw only their own public contributions and withdraw only their own anonymous advisory record.
3. A visitor may see their same-session advisory items; a valid receipt code may retrieve only the matching advisory item.
4. Visitors cannot enumerate another user's advisory items or the Agent queue.
5. Evidence review, redistribution review and advisory-Agent processing are separate privileged actions.
6. Visitors cannot set `evidence`, `status`, `exportApproved`, advice records, review records or report counters.
7. Open correction flags pause high-evidence display and public-data redistribution for that contribution.
8. Public projections must not expose owner IDs, receipt hashes, session tokens, privileged tokens, private rights notes or advisory case text inside aggregate reports.
9. Do not add attachment, real-name, contact, health, payment, ID-document or external-credential fields to the advisory workflow.

## Daily advisory operation

The local finite operation processes unadvised pending records, creates a private advice record for each and regenerates the day's aggregate public report. A report contains counts only; categories with fewer than three requests are merged as a small-sample bucket.

Target behavior:

`anonymous intake → persistent queue → daily Agent/operator processing → private advice → receipt/session retrieval → aggregate public report`

If Sites cannot run a scheduled job, do **not** claim daily automation. Keep the restricted finite `run` action and execute it from an authorized external Agent/scheduler until a platform-native scheduler is verified.

## Company research boundary

`/api/research/coverage` is the canonical v0.7.2 statement for automatic-company-research coverage:

- the existing Python back office has a complete queue/collector/retry/identity-review/release pipeline for supported GLEIF data;
- automated legal-entity identity is supported;
- accounting-parent retrieval is partial;
- products/business, facilities, complete supply chain, labor conditions and official complaint/contact channels do not yet have approved automatic sources;
- labor-condition facts remain community/evidence-review driven.

Do not invent a crawler or describe missing source coverage as complete during Sites import.

## Platform-specific acceptance before public Sites launch

1. Persistent DB survives Site version update/restart.
2. Concurrent writes do not silently overwrite state.
3. User identity/session isolation works across devices according to the chosen identity model.
4. Receipt hashes remain server-only and receipt lookup is rate-limited appropriately by the target runtime.
5. Three operator roles are server-side only.
6. Daily Agent processing is either demonstrably scheduled or explicitly marked manual/external.
7. Public report inspection proves no case text/company/receipt/user identifier leakage.
8. Deletion/retention behavior for anonymous advisory records is documented and tested.
9. Complete flow is replayed on the private Site before switching audience to public.

Current Sites runtime capabilities vary by account/workspace. Do not infer database, identity or scheduler features that the deployment environment does not actually expose.
