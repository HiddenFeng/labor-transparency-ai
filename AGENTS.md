# Labor Transparency — AI Agent Operations Contract

This repository is intentionally operated as an **AI-built, AI-managed public-interest project**. Routine engineering, testing, release preparation, documentation, public status reporting, issue triage and announcement drafting are delegated to project agents.

The GitHub account holder and any infrastructure account holder remain the legal/account owner where a third-party service requires a human or organization. Agents are operators, not a legal entity, regulator, court, lawyer, employer, union, or factual authority.

## Agent roles

- `agents/PROJECT_MANAGER_AGENT.md` — canonical routine project operator and release manager.
- `agents/SOCIAL_ANNOUNCEMENT_AGENT.md` — public information, announcements, release notes and social copy.
- `agents/DAILY_COMMUNITY_AGENT.md` — Beijing 18:00 official-source/community operations pass invoked by LocalAgentRuntime.
- `agents/DAILY_COMMUNITY_REVIEW_AGENT.md` — Beijing 19:00 independent review/continuation pass.

## Non-negotiable invariants

1. Never fabricate a source, review, worker experience, legal conclusion, external receipt or institution response.
2. Community popularity and evidence strength are separate signals.
3. Company, product and labor-practice claims keep separate evidence scopes.
4. Missing a company dossier must not block already-open community or private-help capabilities.
5. Private cases, attachments, account data, secrets and runtime databases never enter the public repository or static site.
6. Public redistribution rights and publication rights are independent and must remain explicit.
7. The project is source-available for non-commercial public-interest use under `LICENSE`; it is not OSI open source.
8. No paid ranking, paid deletion, employer retaliation, worker blacklisting, commercial resale or commercial model training.
9. Claims about readiness must match machine-verifiable evidence. `qa/v0_6/verification.json` is the stable v0.6 baseline; `qa/v0_7/verification.json` governs the historical v0.7 candidate; `qa/v0_8/verification.json` governs the current independent-deployment candidate. Current runtime evidence outranks prose.
10. Security controls must fail closed. Never weaken Host/HTTPS/Origin/CSRF, admin-network, attachment scanning or privacy boundaries merely to make deployment easier.
11. Anonymous advisory is a non-sensitive assistance queue, not a private-data inbox. Never solicit names, private contacts, identity documents, detailed home addresses, health/payment data or attachments there. Plaintext receipt codes are bearer credentials: never store them in persistent state or publish/log them.
12. Advisory public reports may contain aggregate counts only; individual case text, company association, owner/session identifiers, receipt hashes/codes and private advice stay non-public.
13. Company-research automation must remain useful without collapsing evidence tiers. Production does not depend on a named reviewer. `MACHINE_VERIFIED_REFERENCE` is reserved for narrow fail-closed source-of-record fields (initial identity root: GLEIF); `OFFICIAL_SOURCE_REFERENCE` may attach a bounded official registry/disclosure reference without upgrading machine legal identity when global/full-registry uniqueness is not proven; `OFFICIAL_SOURCE_RELATION` preserves a specific official relationship scope; `OFFICIAL_SOURCE_EVENT` preserves a specific dated official regulatory/recall/enforcement event scope; `OPEN_KNOWLEDGE_CONTEXT` may bind only under deterministic context rules and is never equivalent to legal identity; `SOURCE_SIGNAL` and `SOURCE_EVENT_CANDIDATE` preserve each public record's procedural meaning; ambiguous `CONTEXT_CANDIDATE` data stays candidate/unknown. Research adapters must be region-applicable: a source skipped outside its supported jurisdiction is `NOT_APPLICABLE`/no-op, not success, failure, or evidence of absence. The public product must expose a coherent company dossier (community voice, known context, official references/relations/events, gaps, freshness, provenance and public contributions) rather than making users interpret provider/debug status. A search hit is never a broad company fact, legal conclusion or quality rating. Independent human review may exist as optional audit, not a production availability gate.
14. The current production deployment is GitHub + Vercel + Cloudflare Worker/D1 + project DNS. Tencent Cloud / EdgeOne is historical optional PoC evidence only. Do not request, enter or treat Tencent real-name, identity-document, account-completion or payment-method steps as required project work. Reactivation requires a new explicit user decision and a corresponding deployment-policy update.
15. Official registry/disclosure references, official company/brand/product/procurement relationships, official regulatory/recall events, and community claims are distinct data lanes. `OFFICIAL_SOURCE_REFERENCE`, `OFFICIAL_SOURCE_RELATION`, and `OFFICIAL_SOURCE_EVENT` require a specific approved official record and narrow scope; user-contributed brands/products/relationships/labor claims remain contribution evidence with their own E-level/status. Do not promote a community claim to an official lane because it is popular or plausible, and do not promote a daily-delta reference or single event to machine legal identity, overall credit, misconduct, labor-quality or product-quality conclusions.
16. Daily community operations follow `docs/v0_8/DAILY_AGENT_OPERATIONS.md`. LocalAgentRuntime invokes the 18:00 and 19:00 Beijing-time Agents; the platform does not monitor whether an Agent is actively working between invocations. User suggestions/appeals remain private to the submitting session and trusted community Agent interface. Public announcements report only completed non-sensitive work, aggregate themes and source links—never private feedback/advisory text or credentials.
17. China-company investigation is source-first and fail-closed. Approved automated China collectors may publish exact NMPA UDI relations, strict SSE/SZSE listing-disclosure references, and exact SAMR recall / CSRC administrative-penalty events. SSE stock-directory rows are candidate discovery only: a reference requires the candidate security code's official company-overview `FULL_NAME` to exactly match the existing company-space name. SZSE references require one exact full-company-name row in the official stock-list report and duplicate exact rows fail closed. Exchange references do not upgrade GSXT legal identity. GSXT, CNIPA and China Government Procurement search paths that require CAPTCHA, login, anti-bot handling or undocumented interfaces remain official verification gaps; never bypass them. A shortened company name, contextual knowledge-graph match, recall title, search snippet or exchange hint is not enough to upgrade legal identity/listing/ownership. `chinaInvestigation` is an evidence/gap index, never a company score, blacklist, legal-risk rating or product/labor-quality rating.

## Git/release policy

- Canonical branch: `main`.
- Public releases use semantic tags such as `v0.6.0`.
- Every push/PR runs CI. The public static site is deployed automatically from `public-site/` through GitHub Pages.
- A release note must state whether a feature is public, local-only, staging-only, or unverified.
- Routine agent changes may proceed without human approval when reversible and inside these invariants.
- Human/account-owner action is required only when a third-party platform demands identity/consent, a legal policy decision is needed, or an irreversible/high-risk change falls outside this contract.
