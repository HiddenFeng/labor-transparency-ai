# CHANGE — v0.8.1 Tencent-free deployment policy

Date: 2026-09-15
ID: `LTP-V081-TENCENT-FREE`
Impact: `BEHAVIOR_DELTA / DEPLOYMENT_POLICY`
Approval: user explicitly accepted the non-Tencent route on 2026-09-15 and asked to continue improvement and testing.

## Problem

The application was already globally live on Vercel + Cloudflare, but current deployment governance still treated Tencent EdgeOne account completion, identity verification and payment-method setup as the next release gate. That is incompatible with the user's privacy requirement not to provide identity or payment information to Chinese-platform accounts.

## Current accepted production path

```text
Primary interactive site
  workermanifestfellowship.dpdns.org
        -> Vercel static frontend
        -> same-origin /api/* rewrite
        -> Cloudflare Worker
        -> D1

Platform fallback
  workermanifestfellowship.vercel.app
        -> same Vercel deployment / same Worker API

Read-only fallback
  GitHub Pages v0.6.1 mirror

Backend diagnostic origin
  labor-transparency-api.labor-transparency-public.workers.dev
```

## Proposed / accepted delta

- Tencent Cloud / EdgeOne is **not a production dependency and not a release gate**.
- No project Agent should request, enter or encourage the account owner to provide Tencent identity documents, real-name information, card information or payment-method data for the current deployment.
- Existing EdgeOne builds, tests and QA records are retained only as historical PoC evidence. They do not establish a current production route or a Mainland SLA.
- EdgeOne deployment scripts fail closed unless a future explicit human decision sets the legacy opt-in flag.
- Public availability verification moves to a provider-independent GitHub Actions smoke workflow that checks the custom domain, Vercel fallback, Cloudflare API and GitHub Pages from an external network.
- Stable Mainland-China availability remains **unclaimed**. If it becomes a future requirement, provider selection is a new architecture/privacy decision and must not silently reactivate Tencent.

## Preserved capabilities

- Global interactive frontend.
- Same-origin browser API path through Vercel rewrites.
- Cloudflare Worker + D1 persistence and scheduled research.
- Existing Origin/CSRF/Cookie/security boundaries.
- HiddenFeng public GitHub identity and CI/Pages path.
- Project-owned custom domain.
- Historical EdgeOne PoC evidence remains auditable.

## Removed from the current acceptance gate

- Tencent Cloud International account completion.
- Tencent payment method.
- EdgeOne real-name verification.
- EdgeOne custom-domain ownership/CNAME completion.
- EdgeOne no-preview-token Mainland acceptance.

## Risks and boundaries

- Vercel and Cloudflare are not a guaranteed Mainland-China SLA; current local Mainland-like network tests have timed out to their platform domains.
- A project-owned custom domain improves identity portability but does not by itself guarantee Mainland routing.
- GitHub Pages is read-only fallback, not the interactive Worker-backed application.
- Provider outages remain possible; the public smoke workflow detects reachability but does not itself provide failover routing.

## Validation

Required for this change:

1. Vercel project and custom-domain configuration remains valid.
2. DNS A + Vercel ownership TXT resolve from authoritative and public resolvers.
3. Full local application/unit/build/security regression remains green.
4. Default CI no longer treats EdgeOne as a current web-candidate requirement.
5. Legacy EdgeOne deploy scripts fail closed without explicit opt-in.
6. External GitHub Actions public smoke passes for the non-Tencent public path.
7. Public docs, QA state and Agent instructions contain no Tencent-account action as `NEXT_GATE`.

## Rollback / reactivation condition

EdgeOne may only return to an active deployment path after a new explicit user decision that accepts the provider/privacy implications. Reactivation must update this change record, the current verification state, deployment runbook and public smoke/acceptance criteria before any Tencent account action occurs.
