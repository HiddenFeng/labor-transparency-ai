# v0.8.4 Official-source expansion plan

Date: 2026-09-16

## Goal

Expand useful company dossiers without turning search hits into facts. China is first priority; other jurisdictions are enabled only through documented official interfaces or explicit token/application gates.

## China source policy

### NMPA UDI — automated first source

The National Medical Products Administration UDI database explicitly offers public query, bulk downloads, RSS feeds and an authorized REST sharing interface. The project uses the keyless official RSS/bulk release for daily local-Agent collection. It stores only bounded records matching an existing project company by exact registrant name or unified social credit code.

Public meaning: an NMPA UDI record supports a specific registrant/filing ↔ medical-device product relationship, identifier, registration/filing reference and bounded product fields. It does not establish overall product quality, company-wide safety, or a complete product portfolio.

Official entry points:
- https://udi.nmpa.gov.cn/
- https://udi.nmpa.gov.cn/download.html
- https://udi.nmpa.gov.cn/rss/download.html?files=daily
- https://udi.nmpa.gov.cn/toDetail.html?CatalogId=3&infoId=40

### GSXT — official verification, no bypass

The National Enterprise Credit Information Publicity System remains the primary official public enterprise-credit query surface. The project may link users/Agents to it for verification, but it must not bypass CAPTCHA, anti-bot controls, login requirements, or undocumented interfaces.

Official entry: https://www.gsxt.gov.cn/

### CNIPA trademark search — brand verification, no undocumented automation

Trademark relationships can be verified through the CNIPA/Trademark Office public query system. Until a documented reusable interface is approved, the project treats it as an official lookup source rather than automating hidden/private endpoints.

Official entry: https://sbj.cnipa.gov.cn/

### SAMR query hub — navigation

SAMR's government-service query directory is registered as an official navigation source. Individual datasets are activated only after their own access/reuse conditions are understood.

Official entry: https://zwfw.samr.gov.cn/wyc/

## Other jurisdictions

- EU TED Search API: implemented keyless daily collector (`scripts/community_agent/eu_ted_daily.py`). It queries a rolling 8-day window for EU/EEA company spaces, uses at most two API requests per eligible company (winner/buyer), and publishes only exact post-filtered participant-name matches as scoped `PUBLIC_PROCUREMENT_RELATION` records. Live API validation on 2026-09-16 returned exact Airbus Defence and Space GmbH award notices; the current real production company set has zero EU/EEA companies, so its daily production path is currently a zero-request no-op.
- UK Companies House: official REST API; requires API authentication, so adapter is fail-closed until a project credential exists.
- Korea OpenDART: official FSS disclosure API; requires a certification key.
- Japan NTA Corporate Number: official bulk downloads are public; Web API requires a free application ID and imposes an attribution statement for public services.
- Japan gBizINFO: official REST API; use application required.

## Relationship tiers

Automated/project data must keep these separate:

1. `OFFICIAL_SOURCE_RELATION` — a specific official record directly links two scoped entities, e.g. NMPA registrant → product.
2. `MACHINE_VERIFIED_REFERENCE` — existing fail-closed identity/reference facts.
3. `OPEN_KNOWLEDGE_CONTEXT` — deterministic contextual binding, not legal identity.
4. `COMMUNITY_RELATION_CLAIM` — user-contributed relationship at its explicit evidence/status level.
5. `RELATION_CANDIDATE` — ambiguous or insufficiently bound relationship.

No relationship tier automatically implies labor quality, product quality, legality, ownership beyond the recorded scope, or endorsement.

## Daily collection rule

Daily automation must prefer documented official feeds/APIs and exact entity keys. When automation is not legitimately available, the daily Agent may add an official-source link/candidate or leave a gap; it must not solve the gap by scraping around access controls.
