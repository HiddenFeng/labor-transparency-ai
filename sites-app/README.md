# Labor Transparency v0.8 shared public web/domain app

This directory is the **shared public web UI + canonical JavaScript domain layer** for the Labor Transparency public-interest project. v0.8 no longer depends on ChatGPT Sites for production hosting.

It remains deliberately separate from the Python/FastAPI v0.6.1 research/back-office baseline. Production v0.8 serves the public UI as static assets and runs the interactive API on Cloudflare Worker + D1; the Node server in this directory remains a local/reference harness.

v0.7.2 keeps the v0.7.1 data and privacy contracts but completely reworks the public experience around ordinary workers rather than developers. The design language is **public service × public-interest editorial × warmth and strength**: a pain-first home page, step-by-step rights guidance, real public labor cases, curated official/union resources, plain-language evidence labels, supportive anonymous-advisory copy, responsive layout and reduced-motion support.

Public cases and external-resource links are educational navigation only. They do not become evidence records automatically, and listing an organization does **not** mean a partnership, endorsement, authorization or referral relationship exists.

## What v0.8 does

- Public company discussion spaces.
- Unique-account positive/negative company ballots. Community heat is never evidence.
- Public contributions for products, company facts, relationships, labor-practice claims and product claims.
- E0 publication without forcing attachments or source evidence.
- Server-controlled evidence review; users cannot set their own evidence grade.
- E2+ source requirement, E3+ scope/date/authenticity/source-ID requirements, and E5 formal-decision requirements.
- Separate redistribution review. A reviewed contribution is not automatically licensed for the public snapshot.
- Owner edit/withdraw flows. Editing resets evidence to E0 and revokes redistribution approval.
- Public corrections/flags; open corrections pause high-evidence display and public redistribution.
- **Anonymous advisory / task intake** for non-sensitive structured labor questions.
- A high-entropy anonymous receipt code shown once; persistent state stores only its SHA-256 hash.
- Same-session or receipt-code access to each user's own advisory result.
- A restricted advisory-Agent queue and a daily Agent runner that creates private per-case suggestions.
- Public advisory daily reports containing aggregate counts only; case text, company IDs and receipt codes never enter the report.
- Real local persistence with atomic JSON writes and restart recovery.
- An operator/Agent review workspace with separate evidence-review, redistribution-review, and advisory-Agent privileges.
- A machine-readable `/api/research/coverage` endpoint that tells the truth about automatic company-research coverage.

## Anonymous advisory boundary

The advisory feature is **not a private sensitive-information service** and is not a formal complaint-submission agent.

It accepts a de-identified summary, broad region, issue category, work relationship, desired outcome, steps already tried and urgency. It rejects obvious emails, phone-like long numbers, identity-document language, detailed-address hints, health/payment information and attachment-oriented submissions.

It does **not** accept or intentionally collect:

- real names or private contact details;
- ID/passport documents or numbers;
- home addresses;
- health/medical records;
- payment/bank-card data;
- sensitive file attachments;
- credentials for external institutions;
- employer retaliation lists or worker blacklists.

The UI and generated advice explicitly say that future fully automated follow-up would require a separate contact channel and a dedicated private-data protocol. The current site does not collect that contact information and does not pretend such a channel already exists.

## Daily Agent processing

When the web service is running, the daily Agent must use the restricted live Agent API so it cannot race an in-memory FileStore:

```sh
export LTP_ADVISORY_BASE_URL=http://127.0.0.1:8787
export LTP_SITES_ADVISORY_AGENT_TOKEN=advisory-local-only
npm run advisory:once
```

A supervised live loop can run at a fixed local time:

```sh
node scripts/advisory-agent.mjs --loop --base http://127.0.0.1:8787 --token advisory-local-only --timezone Asia/Shanghai --hour 9 --minute 0
```

Direct file processing is an offline maintenance path only and fails unless the caller explicitly confirms the service is stopped:

```sh
node scripts/advisory-agent.mjs --once --data .local/state.json --service-stopped --timezone Asia/Shanghai --day 2026-09-15
```

The runner logs aggregate counts only. It does not log case text or receipt codes. In v0.8 production, the equivalent daily operation is mapped to the Cloudflare Worker scheduled handler / Cron Trigger.

## Automatic company research: current truth

The evidence-grade research pipeline lives in the Python back office: persistent queueing, bounded requests, retry/lease/budget/cache controls, GLEIF-rooted identity disambiguation, provider-specific candidate binding, independent review, scheduled release and requester/follower notices. v0.8.1 also adds a Cloudflare Worker/D1 candidate-collection layer so production can refresh public-source candidates automatically without publishing them as facts.

Current automatic source coverage is **broad but partial and region-dependent**:

- GLEIF: legal-entity identity and accounting-consolidation parents.
- SEC EDGAR + Wikidata: U.S. public-company disclosures plus contextual industry/product/brand/HQ/company-relation metadata after explicit binding.
- NLRB, OSHA, DOL WHD, FMCS F-7/work stoppages, NLRB voluntary-recognition and DOL OLMS: U.S. labor-case/enforcement/representation/disclosure records with source-specific semantic boundaries.
- USAspending: specific U.S. federal award/customer relationships; never the complete supply chain.
- OpenCorporates and Open Supply Hub: optional adapters that remain disabled until required token/subscription and license/provenance gates are satisfied.
- formal complaint channels remain jurisdiction-specific; an official website is only a navigation entry, not proof of a labor-complaint endpoint.

Do not describe this as “all company information is automatically collected.” `/api/research/coverage`, `docs/v0_8/source-registry.json`, `docs/v0_8/COMPANY_DATA_AUTOMATION.md` and the `qa/v0_8/*company*` evidence files define the current claim boundary.

## Local run

Node 20+ is sufficient. There are no third-party runtime dependencies.

```sh
cd sites-app
export LTP_SITES_SESSION_SECRET="$(openssl rand -hex 32)"
export LTP_SITES_REVIEW_TOKEN="review-local-only"
export LTP_SITES_EXPORT_TOKEN="export-local-only"
export LTP_SITES_ADVISORY_AGENT_TOKEN="advisory-local-only"
export LTP_SITES_SEED=true
# For an HTTPS deployment that retains the local cookie identity adapter:
export LTP_SITES_SECURE_COOKIE=true
npm run dev
```

Default URL: `http://127.0.0.1:8787`.

The local file store defaults to `sites-app/.local/state.json` and is ignored by Git. It is only a QA/reference adapter. Production v0.8 uses `cloudflare-backend/src/d1-store.mjs` with D1.

## Test

```sh
npm test
npm run build
```

The suite covers real loopback HTTP, complete company/community/contribution/review/correction/redistribution/advisory/Agent/report flow, CSRF/origin checks, role denial, privacy projection, receipt hashing, public-report non-leakage, body limits, persistence and restart recovery.

## Storage seam

`src/storage.mjs` intentionally exposes only `init()`, `read()` and `transaction(mutator)` for the local harness. v0.8 preserves that transaction-shaped domain contract through the D1 adapter; every accepted write increments `state.revision`.

Current logical collections are:

- `companies`
- `contributions`
- `reviews`
- `exportReviews`
- `ballots`
- `flags`
- `advisoryCases`
- `advisoryAdvice`
- `advisoryDailyReports`

The receipt code must remain a secret bearer credential: store only its hash. Never put the receipt code in a public URL, analytics event or public log.

## Identity and role seam

The public app uses an anonymous HttpOnly same-site cookie and derives an opaque owner hash. For split hosting, prefer a same-origin `/api` proxy or `www.example.org` + `api.example.org` so `SameSite=Strict` remains usable without third-party cookies.

Map three independent privileged actions to real owner/operator roles:

1. evidence review;
2. redistribution/privacy-rights review;
3. advisory-Agent processing.

Do not ship local bearer tokens into browser code.

## License

Project-authored material remains under `LicenseRef-LTP-Public-Interest-1.0`: source-available for non-commercial public-interest use, not OSI open source. Third-party material keeps its own rights.
