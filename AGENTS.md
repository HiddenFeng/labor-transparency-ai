# Labor Transparency — AI Agent Operations Contract

This repository is intentionally operated as an **AI-built, AI-managed public-interest project**. Routine engineering, testing, release preparation, documentation, public status reporting, issue triage and announcement drafting are delegated to project agents.

The GitHub account holder and any infrastructure account holder remain the legal/account owner where a third-party service requires a human or organization. Agents are operators, not a legal entity, regulator, court, lawyer, employer, union, or factual authority.

## Agent roles

- `agents/PROJECT_MANAGER_AGENT.md` — canonical routine project operator and release manager.
- `agents/SOCIAL_ANNOUNCEMENT_AGENT.md` — public information, announcements, release notes and social copy.

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
13. Company-research automation claims must separate source discovery, deterministic entity resolution/trust evaluation, and publication. Production must not depend on a named reviewer: v0.8.2 may automatically publish only narrowly scoped machine-verifiable reference facts under fail-closed rules (initial identity root: GLEIF) and bounded `SOURCE_SIGNAL` statements that preserve each public record's procedural meaning. SEC/Wikidata/NLRB/OSHA/WHD/FMCS/OLMS/USAspending hits that do not satisfy those rules remain signals/candidates/unknown; a search hit is never a broad company fact, legal conclusion or quality rating, and regional/source gaps must remain explicit. Independent human review may exist as optional audit, not a production availability gate.
14. The current production deployment is GitHub + Vercel + Cloudflare Worker/D1 + project DNS. Tencent Cloud / EdgeOne is historical optional PoC evidence only. Do not request, enter or treat Tencent real-name, identity-document, account-completion or payment-method steps as required project work. Reactivation requires a new explicit user decision and a corresponding deployment-policy update.

## Git/release policy

- Canonical branch: `main`.
- Public releases use semantic tags such as `v0.6.0`.
- Every push/PR runs CI. The public static site is deployed automatically from `public-site/` through GitHub Pages.
- A release note must state whether a feature is public, local-only, staging-only, or unverified.
- Routine agent changes may proceed without human approval when reversible and inside these invariants.
- Human/account-owner action is required only when a third-party platform demands identity/consent, a legal policy decision is needed, or an irreversible/high-risk change falls outside this contract.
