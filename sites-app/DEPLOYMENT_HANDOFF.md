# v0.8.1 Independent deployment handoff

Status: `GLOBAL_PUBLIC_DEPLOYMENT_LIVE / MAINLAND_STABLE_EDGEONE_ACCOUNT_DOMAIN_PENDING`.

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
- Alternate static hosts: EdgeOne or any HTTPS static host using a same-site API domain or an approved proxy

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

Cloudflare, Vercel and EdgeOne account authentication are complete. The EdgeOne anonymous project was claimed, and an account-owned global project named `labor-transparency-public` has been deployed successfully. The project-owned domain `workermanifestfellowship.dpdns.org` is now configured and verified on HiddenFeng Vercel. A second `labor-transparency-overseas` EdgeOne project was deployed to test the non-Mainland area; it accepted the domain and its ownership TXT is live, but final verification is gated by Tencent Cloud International account completion/payment-method requirements. The default `edgeone.cool` project hostname is still not a permanent Mainland public entry.

After the account owner completes the Tencent Cloud account-information/payment-method gate (and real-name/ICP requirements if a Mainland-inclusive area is selected), the Agent can resume the already-created EdgeOne domain flow, finish ownership/CNAME DNS changes where supported, verify HTTPS/exact Cloudflare Origin allowlists, and repeat no-preview-token public QA. A stable Mainland-China claim additionally remains gated by actual ICP/provider eligibility and measured reachability.

Never paste platform passwords or DNS credentials into project files or chat. OAuth/browser login and provider-native authorization are preferred.

## Acceptance after deployment

Replay at minimum:

`health -> company -> ballot -> public contribution -> evidence review -> redistribution -> correction pause -> anonymous advisory -> Agent advice -> aggregate report -> restricted company-research collection -> public aggregate research status -> new Worker version/restart persistence`

Additionally verify wrong Origin and missing CSRF are 403, cookies are `HttpOnly; Secure`, privileged tokens are absent from the frontend, static privacy audit passes, and actual Mainland-China reachability is measured rather than inferred from DNS.

Global Vercel/Cloudflare acceptance has been exercised. The temporary EdgeOne preview also passed homepage/API/mutation and Chrome checks with zero final console/network/page errors. Final acceptance still needs one replay on the permanent EdgeOne/custom-domain URL after the account/domain step above.
