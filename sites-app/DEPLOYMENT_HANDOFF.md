# v0.8.1 Independent deployment handoff

Status: `GLOBAL_PUBLIC_DEPLOYMENT_LIVE / NON_CHINA_CLOUD_CANONICAL_PATH / MAINLAND_SLA_UNCLAIMED`.

## Production shape

- Public UI/domain source: `sites-app/public/` + `sites-app/src/domain.mjs`
- Cloudflare API: `cloudflare-backend/src/worker.mjs`
- Persistence: Cloudflare D1 through `cloudflare-backend/src/d1-store.mjs`
- Company-source candidate collector: `cloudflare-backend/src/company-research.mjs`
- Evidence-grade company research/back office: `app/company_intelligence.py` + `app/research.py`
- Schema: `cloudflare-backend/migrations/`
- Frontend build: `deploy/frontend/build.mjs`
- EdgeOne build + buffered same-origin API relay: `deploy/edgeone/build.mjs` + `deploy/edgeone/proxy-template.mjs`
- Preferred Vercel mode: same-origin `/api/*` rewrite to the Cloudflare API
- Alternate static hosts: any HTTPS static host using a same-site API domain or an approved proxy; EdgeOne is historical/optional only

Current public global endpoints:

- frontend: `https://workermanifestfellowship.vercel.app`
- backend: `https://labor-transparency-api.labor-transparency-public.workers.dev`

The current Mainland network cannot reliably connect to those two platform domains directly. A temporary anonymous EdgeOne preview has therefore been used to prove the full `EdgeOne -> Edge Function -> Worker -> D1` path from the current Mainland network. That temporary preview is evidence, not a permanent public URL.

The Node server and FileStore remain local/reference adapters only. Do not deploy the FileStore as the production database.

## Invariants that must survive deployment

1. Community popularity and evidence grade remain independent.
2. Company/product/labor-practice evidence scopes remain separate.
3. Users cannot assign evidence/status/export approval to themselves.
4. Editing resets evidence to E0 and revokes redistribution approval.
5. Open corrections pause high-evidence display and public redistribution.
6. Evidence review, redistribution review, advisory-Agent processing, and company-research Agent processing use independent server-side credentials.
7. Anonymous advisory accepts only de-identified, non-sensitive text. No names, private contacts, ID documents, home addresses, health/payment data, or attachments.
8. Plaintext `ADV-...` receipt codes are returned once; persistent data stores only their SHA-256 hashes.
9. Public daily advisory reports contain aggregate counts only.
10. Public cases/resources are educational navigation, not partnership claims and not automatic evidence records.
11. Automatic company research keeps source discovery, provider-specific binding, independent review, and publication separate. Raw research candidates are operator-only; the public API gets aggregate status only.

## Preferred frontend/API relationship

For Vercel, build with `LTP_PROXY_API_ORIGIN=https://api.example.org`. The generated `vercel.json` proxies browser `/api/*` calls to Cloudflare while browser cookies remain first-party on the frontend origin. The Worker must still allow that exact frontend Origin.

For direct browser calls, use an exact HTTPS frontend origin and preferably sibling custom domains such as `www.example.org` + `api.example.org`. Do not rely on a long-term cross-site `*.vercel.app` -> `*.workers.dev` cookie design.

## Manual platform prerequisites still remaining

There is **no Tencent Cloud / EdgeOne account-completion prerequisite** for the canonical release path. The production path is GitHub + Vercel + Cloudflare Worker/D1 + DigitalPlat DNS. Historical EdgeOne projects and preview results remain evidence only and must not be treated as a blocker.

Mainland-China stable access is deliberately unclaimed. If the account owner later chooses a Mainland-local or China-cloud acceleration provider, that becomes a new privacy/compliance decision and must not be inferred from this handoff.

Never paste platform passwords or DNS credentials into project files or chat. OAuth/browser login and provider-native authorization are preferred.

## Acceptance after deployment

Replay at minimum:

`health -> company -> ballot -> public contribution -> evidence review -> redistribution -> correction pause -> anonymous advisory -> Agent advice -> aggregate report -> restricted company-research collection -> public aggregate research status -> new Worker version/restart persistence`

Additionally verify wrong Origin and missing CSRF are 403, cookies are `HttpOnly; Secure`, privileged tokens are absent from the frontend, static privacy audit passes, and actual Mainland-China reachability is measured rather than inferred from DNS.

Global Vercel/Cloudflare acceptance has been exercised. The historical temporary EdgeOne preview also passed homepage/API/mutation and Chrome checks with zero final console/network/page errors, but no permanent EdgeOne replay is required for release acceptance.
